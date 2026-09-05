/**
 * iCloud Sync engine (iOS).
 *
 * Every synced collection stays device-local and offline-first. This module
 * mirrors those collections into one CloudKit private-database zone:
 *
 * - Local writes mark a record dirty; the engine pushes dirty records as
 *   whole JSON payloads (see `records.ts`).
 * - Pulls use CloudKit's zone change tokens (persisted by expo-cloudkit) so
 *   only records changed since the last sync are transferred.
 * - Conflicts resolve last-write-wins on the device `updatedAt` timestamp
 *   (`merge.ts`). Deletes are tombstones so they take part in that ordering
 *   and are purged from both sides after `TOMBSTONE_RETENTION_MS`.
 * - Chat photos travel as `ChatImage` asset records and are re-materialized
 *   under the receiving device's managed image directory.
 *
 * Sync runs on activation, when the app returns to the foreground, shortly
 * after local writes, on a slow timer while active, and on demand. Push
 * notifications are not wired up, so there is no background wake-up.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from "react-native";
// Deep imports: the package barrel also pulls in the web/Android loaders,
// which reference an optional peer dependency that Metro cannot resolve.
import { CloudKitError, CloudKitErrorCode } from "expo-cloudkit/build/errors";
import {
  addAccountStatusListener,
  configure,
  createZone,
  deleteRecords,
  fetchAllZoneChanges,
  getAccountStatus,
  isNativeModuleAvailable,
  saveRecords,
  setZoneChangeToken,
} from "expo-cloudkit/build/ExpoCloudKit";
import type {
  AccountStatus,
  CloudKitRecord,
  RecordField,
  RecordToSave,
  Subscription,
} from "expo-cloudkit/build/types";
import {
  chatImageDirectoryUri,
  chatImageExists,
  chatImageFileUri,
  importChatImage,
} from "@/lib/chat-image-storage.native";
import {
  chatImageRecordName,
  collectManagedImageNames,
  fromPortableImageRef,
  rewriteSessionImages,
  toPortableImageRef,
} from "@/lib/cloud-sync/image-refs";
import { isTombstone, pickLatest } from "@/lib/cloud-sync/merge";
import {
  CHAT_IMAGE_RECORD_TYPE,
  CLOUD_SYNC_CONTAINER_ID,
  CLOUD_SYNC_ZONE,
  entityFromRecordFields,
  entityToRecordFields,
  parseRecordName,
  recordNameFor,
} from "@/lib/cloud-sync/records";
import type {
  CloudSyncAccountStatus,
  CloudSyncSnapshot,
  RawStore,
  SyncedEntity,
  SyncedStoreDefinition,
} from "@/lib/cloud-sync/types";
import { TOMBSTONE_RETENTION_MS } from "@/types/tombstone";
import type { ChatSession } from "@/types/chat-session";

export interface SyncedStoreHandle<TEntity extends SyncedEntity> {
  markDirty: (entity: TEntity) => void;
}

const STATE_KEY = "chefness:cloud-sync";
const CHAT_SESSIONS_STORE = "chat-sessions";
const WRITE_DEBOUNCE_MS = 2500;
const PERIODIC_SYNC_MS = 2 * 60 * 1000;
const IMAGE_UPLOAD_BATCH = 10;

interface PersistedState {
  enabled: boolean;
  lastSyncedAt: string | null;
  /** store → record id → `updatedAt` when the record was marked dirty. */
  dirty: Record<string, Record<string, string>>;
  /** Managed image file names known to exist in iCloud. */
  uploadedImages: string[];
}

interface RegisteredStore {
  definition: SyncedStoreDefinition<SyncedEntity>;
  store: RawStore<SyncedEntity>;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const stores = new Map<string, RegisteredStore>();
const listeners = new Set<() => void>();
const changeListeners = new Set<(storeNames: string[]) => void>();

let snapshot: CloudSyncSnapshot = {
  isAvailable: isNativeModuleAvailable(),
  isEntitled: false,
  isEnabled: false,
  accountStatus: "unknown",
  isSyncing: false,
  lastSyncedAt: null,
  error: null,
};

let statePromise: Promise<PersistedState> | null = null;
let configured = false;
let resetTokenOnConfigure = false;
let zoneReady = false;
let active = false;
let syncPromise: Promise<void> | null = null;
let syncRequested = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let accountSubscription: Subscription | null = null;

function patchSnapshot(patch: Partial<CloudSyncSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

function emitChanges(storeNames: string[]): void {
  if (storeNames.length === 0) return;
  for (const listener of changeListeners) listener(storeNames);
}

async function loadState(): Promise<PersistedState> {
  const empty: PersistedState = {
    enabled: false,
    lastSyncedAt: null,
    dirty: {},
    uploadedImages: [],
  };
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      enabled: parsed.enabled === true,
      lastSyncedAt:
        typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
      dirty: typeof parsed.dirty === "object" ? (parsed.dirty ?? {}) : {},
      uploadedImages: Array.isArray(parsed.uploadedImages)
        ? parsed.uploadedImages.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    };
  } catch {
    return empty;
  }
}

function getState(): Promise<PersistedState> {
  statePromise ??= loadState().then((state) => {
    patchSnapshot({
      isEnabled: state.enabled,
      lastSyncedAt: state.lastSyncedAt,
    });
    return state;
  });
  return statePromise;
}

async function persistState(state: PersistedState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getCloudSyncSnapshot(): CloudSyncSnapshot {
  return snapshot;
}

export function subscribeCloudSync(listener: () => void): () => void {
  listeners.add(listener);
  void getState();
  return () => listeners.delete(listener);
}

export function subscribeCloudSyncChanges(
  listener: (storeNames: string[]) => void,
): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function setCloudSyncEntitled(entitled: boolean): void {
  if (snapshot.isEntitled === entitled) return;
  patchSnapshot({ isEntitled: entitled });
  void reconcileActivation();
}

export async function setCloudSyncEnabled(enabled: boolean): Promise<void> {
  const state = await getState();
  if (state.enabled === enabled) return;
  state.enabled = enabled;
  if (enabled) {
    // Everything on this device is a candidate for upload, and the remote
    // zone must be pulled from the start so the two sides can be merged.
    await markAllDirty(state);
    state.uploadedImages = [];
    if (configured) setZoneChangeToken(CLOUD_SYNC_ZONE, "private", null);
    else resetTokenOnConfigure = true;
  } else {
    state.dirty = {};
  }
  await persistState(state);
  patchSnapshot({ isEnabled: enabled, error: null });
  await reconcileActivation();
}

export async function syncNow(): Promise<void> {
  await getState();
  if (!snapshot.isAvailable) return;
  if (!snapshot.isEntitled || !snapshot.isEnabled) return;
  await requestSync();
}

export function registerSyncedStore<TEntity extends SyncedEntity>(
  definition: SyncedStoreDefinition<TEntity>,
  store: RawStore<TEntity>,
): SyncedStoreHandle<TEntity> {
  stores.set(definition.storeName, {
    definition,
    store,
  } as unknown as RegisteredStore);
  return {
    markDirty: (entity) => {
      void markDirty(definition.storeName, entity);
    },
  };
}

// ---------------------------------------------------------------------------
// Activation & triggers
// ---------------------------------------------------------------------------

function ensureConfigured(): void {
  if (configured || !snapshot.isAvailable) return;
  configure(CLOUD_SYNC_CONTAINER_ID);
  configured = true;
  if (resetTokenOnConfigure) {
    resetTokenOnConfigure = false;
    setZoneChangeToken(CLOUD_SYNC_ZONE, "private", null);
  }
}

async function reconcileActivation(): Promise<void> {
  const state = await getState();
  const shouldBeActive =
    snapshot.isAvailable && snapshot.isEntitled && state.enabled;
  if (shouldBeActive === active) return;
  active = shouldBeActive;
  if (active) {
    ensureConfigured();
    accountSubscription = addAccountStatusListener((status) => {
      patchSnapshot({ accountStatus: toAccountStatus(status) });
      if (status === "available") void requestSync();
    });
    appStateSubscription = AppState.addEventListener("change", onAppState);
    periodicTimer = setInterval(() => {
      if (AppState.currentState === "active") void requestSync();
    }, PERIODIC_SYNC_MS);
    void requestSync();
  } else {
    accountSubscription?.remove();
    accountSubscription = null;
    appStateSubscription?.remove();
    appStateSubscription = null;
    if (periodicTimer) clearInterval(periodicTimer);
    periodicTimer = null;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
  }
}

function onAppState(status: AppStateStatus): void {
  if (status === "active") void requestSync();
}

async function markDirty(
  storeName: string,
  entity: SyncedEntity,
): Promise<void> {
  const state = await getState();
  if (!state.enabled) return;
  state.dirty[storeName] = {
    ...state.dirty[storeName],
    [entity.id]: entity.updatedAt,
  };
  await persistState(state);
  if (!active) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void requestSync();
  }, WRITE_DEBOUNCE_MS);
}

async function markAllDirty(state: PersistedState): Promise<void> {
  for (const [storeName, registered] of stores) {
    const entities = await registered.store.readAll();
    const dirty: Record<string, string> = {};
    for (const entity of entities) dirty[entity.id] = entity.updatedAt;
    state.dirty[storeName] = dirty;
  }
}

function requestSync(): Promise<void> {
  if (syncPromise) {
    syncRequested = true;
    return syncPromise;
  }
  syncPromise = runSync().finally(() => {
    syncPromise = null;
    if (syncRequested) {
      syncRequested = false;
      void requestSync();
    }
  });
  return syncPromise;
}

// ---------------------------------------------------------------------------
// Sync cycle
// ---------------------------------------------------------------------------

async function runSync(): Promise<void> {
  const state = await getState();
  if (!active || !state.enabled) return;
  ensureConfigured();
  patchSnapshot({ isSyncing: true, error: null });
  try {
    const status = await getAccountStatus();
    patchSnapshot({ accountStatus: toAccountStatus(status) });
    if (status !== "available") {
      patchSnapshot({ error: describeAccountStatus(status) });
      return;
    }
    if (!zoneReady) {
      await createZone(CLOUD_SYNC_ZONE, "private");
      zoneReady = true;
    }
    const touched = await pull(state);
    await push(state);
    await purgeTombstones(state);
    state.lastSyncedAt = new Date().toISOString();
    await persistState(state);
    patchSnapshot({ lastSyncedAt: state.lastSyncedAt });
    emitChanges([...touched]);
  } catch (error) {
    patchSnapshot({ error: describeError(error) });
  } finally {
    patchSnapshot({ isSyncing: false });
  }
}

async function pull(state: PersistedState): Promise<Set<string>> {
  const changes = await fetchAllZoneChanges([CLOUD_SYNC_ZONE], "private");
  const touched = new Set<string>();
  const remoteByStore = new Map<string, SyncedEntity[]>();
  const imageRecords: CloudKitRecord[] = [];

  for (const record of changes.changedRecords) {
    if (record.recordType === CHAT_IMAGE_RECORD_TYPE) {
      imageRecords.push(record);
      continue;
    }
    const parsed = parseRecordName(record.recordName);
    if (!parsed) continue;
    const registered = stores.get(parsed.storeName);
    if (!registered) continue;
    const remote = entityFromRecordFields(
      record.fields,
      registered.definition.parse,
    );
    if (remote?.id !== parsed.id) continue;
    const list = remoteByStore.get(parsed.storeName) ?? [];
    list.push(
      parsed.storeName === CHAT_SESSIONS_STORE
        ? localizeSessionImages(remote as ChatSession)
        : remote,
    );
    remoteByStore.set(parsed.storeName, list);
  }

  // Photos first so a session that references them renders immediately.
  for (const record of imageRecords) await materializeImage(record, state);

  for (const [storeName, remotes] of remoteByStore) {
    const registered = stores.get(storeName);
    if (!registered) continue;
    const merge = registered.definition.merge ?? pickLatest;
    const entities = await registered.store.readAll();
    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    let changed = false;
    for (const remote of remotes) {
      const local = byId.get(remote.id);
      const winner = local ? merge(local, remote) : remote;
      if (winner === local) continue;
      byId.set(remote.id, winner);
      changed = true;
      if (winner === remote) clearDirty(state, storeName, remote.id);
    }
    if (changed) {
      await registered.store.writeAll([...byId.values()]);
      touched.add(storeName);
    }
  }

  // Server-side deletions only come from another device purging an expired
  // tombstone; drop the matching local tombstone if it is still around.
  for (const recordName of changes.deletedRecordNames) {
    const parsed = parseRecordName(recordName);
    if (!parsed) continue;
    const registered = stores.get(parsed.storeName);
    if (!registered) continue;
    const entities = await registered.store.readAll();
    const index = entities.findIndex(
      (entity) => entity.id === parsed.id && isTombstone(entity),
    );
    if (index < 0) continue;
    entities.splice(index, 1);
    await registered.store.writeAll(entities);
    clearDirty(state, parsed.storeName, parsed.id);
  }

  return touched;
}

async function push(state: PersistedState): Promise<void> {
  const entityRecords: RecordToSave[] = [];
  const pushed: { storeName: string; id: string; updatedAt: string }[] = [];
  const imageUploads: { name: string; record: RecordToSave }[] = [];
  const uploaded = new Set(state.uploadedImages);

  for (const [storeName, registered] of stores) {
    const dirtyIds = Object.keys(state.dirty[storeName] ?? {});
    if (dirtyIds.length === 0) continue;
    const entities = await registered.store.readAll();
    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    for (const id of dirtyIds) {
      const entity = byId.get(id);
      if (!entity) {
        clearDirty(state, storeName, id);
        continue;
      }
      let outgoing = registered.definition.toPayload
        ? registered.definition.toPayload(entity)
        : entity;
      if (storeName === CHAT_SESSIONS_STORE) {
        const session = outgoing as ChatSession;
        if (!isTombstone(session)) {
          for (const name of collectManagedImageNames(
            session,
            chatImageDirectoryUri(),
          )) {
            if (uploaded.has(name) || !chatImageExists(name)) continue;
            uploaded.add(name);
            imageUploads.push({
              name,
              record: {
                recordType: CHAT_IMAGE_RECORD_TYPE,
                recordName: chatImageRecordName(name),
                zoneName: CLOUD_SYNC_ZONE,
                fields: {
                  name: { type: "string", value: name },
                  file: { type: "asset", value: chatImageFileUri(name) },
                },
              },
            });
          }
        }
        outgoing = rewriteSessionImages(session, (uri) =>
          toPortableImageRef(uri, chatImageDirectoryUri()),
        );
      }
      entityRecords.push({
        recordType: registered.definition.recordType,
        recordName: recordNameFor(storeName, id),
        zoneName: CLOUD_SYNC_ZONE,
        fields: entityToRecordFields(outgoing),
      });
      pushed.push({ storeName, id, updatedAt: entity.updatedAt });
    }
  }

  for (
    let start = 0;
    start < imageUploads.length;
    start += IMAGE_UPLOAD_BATCH
  ) {
    const batch = imageUploads.slice(start, start + IMAGE_UPLOAD_BATCH);
    await saveRecords(
      batch.map((upload) => upload.record),
      "private",
    );
    state.uploadedImages = [
      ...new Set([...state.uploadedImages, ...batch.map((b) => b.name)]),
    ];
    await persistState(state);
  }

  if (entityRecords.length === 0) return;
  await saveRecords(entityRecords, "private");
  for (const { storeName, id, updatedAt } of pushed) {
    // A write that landed mid-push re-marks the record with a newer stamp.
    if (state.dirty[storeName]?.[id] === updatedAt) {
      clearDirty(state, storeName, id);
    }
  }
  await persistState(state);
}

async function purgeTombstones(state: PersistedState): Promise<void> {
  const cutoff = new Date(Date.now() - TOMBSTONE_RETENTION_MS).toISOString();
  for (const [storeName, registered] of stores) {
    const entities = await registered.store.readAll();
    const expired = entities.filter(
      (entity) =>
        entity.deletedAt !== undefined &&
        entity.deletedAt < cutoff &&
        state.dirty[storeName]?.[entity.id] === undefined,
    );
    if (expired.length === 0) continue;
    const recordNames = expired.map((entity) =>
      recordNameFor(storeName, entity.id),
    );
    if (storeName === CHAT_SESSIONS_STORE) {
      for (const entity of expired) {
        for (const name of collectManagedImageNames(
          entity as ChatSession,
          chatImageDirectoryUri(),
        )) {
          recordNames.push(chatImageRecordName(name));
        }
      }
    }
    await deleteRecords(
      recordNames.map((recordName) => ({
        recordName,
        zoneName: CLOUD_SYNC_ZONE,
      })),
      "private",
    );
    const expiredIds = new Set(expired.map((entity) => entity.id));
    await registered.store.writeAll(
      entities.filter((entity) => !expiredIds.has(entity.id)),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearDirty(state: PersistedState, storeName: string, id: string) {
  const dirty = state.dirty[storeName];
  if (!dirty) return;
  const { [id]: _, ...rest } = dirty;
  state.dirty[storeName] = rest;
}

function localizeSessionImages(session: ChatSession): ChatSession {
  return rewriteSessionImages(session, (uri) =>
    fromPortableImageRef(uri, chatImageDirectoryUri()),
  );
}

async function materializeImage(
  record: CloudKitRecord,
  state: PersistedState,
): Promise<void> {
  const nameField: RecordField | undefined = record.fields.name;
  const assetField: RecordField | undefined = record.fields.file;
  const name = nameField?.value;
  const asset = assetField?.value;
  if (typeof name !== "string" || !name || name.includes("/")) return;
  if (!state.uploadedImages.includes(name)) {
    state.uploadedImages = [...state.uploadedImages, name];
  }
  if (chatImageExists(name)) return;
  if (typeof asset !== "object" || asset === null || !("downloadURL" in asset))
    return;
  try {
    // For fetched records CloudKit has already downloaded the asset to a
    // temporary file; `downloadURL` is that local file URL.
    await importChatImage(asset.downloadURL, name);
  } catch (error) {
    console.warn("Could not store synced chat photo:", error);
  }
}

function toAccountStatus(status: AccountStatus): CloudSyncAccountStatus {
  switch (status) {
    case "available":
      return "available";
    case "noAccount":
      return "noAccount";
    case "restricted":
      return "restricted";
    case "temporarilyUnavailable":
      return "unavailable";
    default:
      return "unknown";
  }
}

function describeAccountStatus(status: AccountStatus): string {
  switch (status) {
    case "noAccount":
      return "Sign in to iCloud in the Settings app to sync Chefness.";
    case "restricted":
      return "iCloud is restricted on this device, so Chefness can’t sync.";
    case "temporarilyUnavailable":
      return "iCloud is temporarily unavailable. Chefness will retry.";
    default:
      return "iCloud status couldn’t be determined. Chefness will retry.";
  }
}

function describeError(error: unknown): string {
  if (error instanceof CloudKitError) {
    switch (error.code) {
      case CloudKitErrorCode.NOT_AUTHENTICATED:
        return "Sign in to iCloud in the Settings app to sync Chefness.";
      case CloudKitErrorCode.NETWORK_UNAVAILABLE:
        return "You’re offline. iCloud Sync will resume when you reconnect.";
      case CloudKitErrorCode.QUOTA_EXCEEDED:
        return "Your iCloud storage is full, so Chefness can’t upload changes.";
      case CloudKitErrorCode.RATE_LIMITED:
        return "iCloud asked Chefness to slow down. Sync will retry shortly.";
      case CloudKitErrorCode.ASSET_TOO_LARGE:
        return "A chat photo is too large for iCloud and was not synced.";
      default:
        return (
          error.recoverySuggestion ??
          "iCloud Sync ran into a problem. Chefness will retry."
        );
    }
  }
  return "iCloud Sync ran into a problem. Chefness will retry.";
}
