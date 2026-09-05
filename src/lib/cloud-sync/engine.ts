/**
 * Web build: iCloud Sync is iOS-only, so the engine is inert here. Storage
 * files still register their stores through the same API so the platform
 * split stays confined to this module and `src/storage/synced.ts`.
 */
import type {
  CloudSyncSnapshot,
  RawStore,
  SyncedEntity,
  SyncedStoreDefinition,
} from "@/lib/cloud-sync/types";

export interface SyncedStoreHandle<TEntity extends SyncedEntity> {
  markDirty: (entity: TEntity) => void;
}

const snapshot: CloudSyncSnapshot = {
  isAvailable: false,
  isEntitled: false,
  isEnabled: false,
  accountStatus: "unknown",
  isSyncing: false,
  lastSyncedAt: null,
  error: null,
};

export function getCloudSyncSnapshot(): CloudSyncSnapshot {
  return snapshot;
}

export function subscribeCloudSync(_listener: () => void): () => void {
  return () => {};
}

export function subscribeCloudSyncChanges(
  _listener: (storeNames: string[]) => void,
): () => void {
  return () => {};
}

export function setCloudSyncEntitled(_entitled: boolean): void {}

export function setCloudSyncEnabled(_enabled: boolean): Promise<void> {
  return Promise.resolve();
}

export function syncNow(): Promise<void> {
  return Promise.resolve();
}

export function registerSyncedStore<TEntity extends SyncedEntity>(
  _definition: SyncedStoreDefinition<TEntity>,
  _store: RawStore<TEntity>,
): SyncedStoreHandle<TEntity> {
  return { markDirty: () => {} };
}
