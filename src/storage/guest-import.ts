import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  waitForPendingWrites,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";
import { getDB } from "@/storage/indexed-db";
import { saveLocalCredentialsForUid } from "@/storage/settings";
import type { AiPreference } from "@/types/ai-preference";
import type { ChatSession } from "@/types/chat-session";
import type { CookingLogEntry } from "@/types/cooking-log";
import type { Recipe } from "@/types/recipe";
import { settingsSchema, type Settings } from "@/types/settings";
import type { GuestImportSummary } from "@/auth/auth-context";

const DOMAIN_STORES = [
  "recipes",
  "settings",
  "cooking-log",
  "ai-preferences",
  "chat-sessions",
] as const;
const MAX_BATCH_WRITES = 450;

interface GuestData {
  recipes: Recipe[];
  settings: Settings[];
  cookingLog: CookingLogEntry[];
  aiPreferences: AiPreference[];
  chatSessions: ChatSession[];
}

interface MigrationMetadata {
  id: string;
  decision: "declined" | "complete";
  snapshotId?: string;
  updatedAt: string;
}

interface LegacyBackup extends GuestData {
  id: string;
  uid: string;
  createdAt: string;
}

function migrationId(uid: string): string {
  return `firebase:${uid}`;
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error(`Failed to read ${storeName}`));
  });
}

async function getFromStore<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error(`Failed to read ${storeName}`));
  });
}

async function putInStore(storeName: string, value: { id: string }): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to write ${storeName}`));
  });
}

async function readGuestData(): Promise<GuestData> {
  const [recipes, settings, cookingLog, aiPreferences, chatSessions] = await Promise.all([
    getAllFromStore<Recipe>("recipes"),
    getAllFromStore<Settings>("settings"),
    getAllFromStore<CookingLogEntry>("cooking-log"),
    getAllFromStore<AiPreference>("ai-preferences"),
    getAllFromStore<ChatSession>("chat-sessions"),
  ]);
  return { recipes, settings, cookingLog, aiPreferences, chatSessions };
}

function summarize(data: GuestData): GuestImportSummary {
  return {
    recipes: data.recipes.length,
    settings: data.settings.length,
    cookingLog: data.cookingLog.length,
    aiPreferences: data.aiPreferences.length,
    chatSessions: data.chatSessions.length,
  };
}

export async function getGuestImportSummary(uid: string): Promise<GuestImportSummary | null> {
  const decision = await getFromStore<MigrationMetadata>("migration-meta", migrationId(uid));
  if (decision) return null;
  const data = await readGuestData();
  const summary = summarize(data);
  return Object.values(summary).some((count) => count > 0) ? summary : null;
}

export async function declineGuestImport(uid: string): Promise<void> {
  await putInStore("migration-meta", {
    id: migrationId(uid),
    decision: "declined",
    updatedAt: new Date().toISOString(),
  } satisfies MigrationMetadata);
}

function addCollectionWrites(
  writes: { reference: DocumentReference; data: DocumentData }[],
  uid: string,
  collectionName: string,
  entities: { id: string }[],
): void {
  for (const entity of entities) {
    writes.push({
      reference: doc(firebaseDb, "users", uid, collectionName, entity.id),
      data: entity,
    });
  }
}

async function commitWrites(
  writes: { reference: DocumentReference; data: DocumentData }[],
): Promise<void> {
  for (let offset = 0; offset < writes.length; offset += MAX_BATCH_WRITES) {
    const batch = writeBatch(firebaseDb);
    for (const write of writes.slice(offset, offset + MAX_BATCH_WRITES)) {
      batch.set(write.reference, write.data);
    }
    await batch.commit();
  }
  await waitForPendingWrites(firebaseDb);
}

async function verifyCollection(
  uid: string,
  collectionName: string,
  expectedIds: string[],
): Promise<void> {
  const snapshot = await getDocsFromServer(collection(firebaseDb, "users", uid, collectionName));
  const actualIds = new Set(snapshot.docs.map((item) => item.id));
  if (expectedIds.some((id) => !actualIds.has(id))) {
    throw new Error(`Could not verify imported ${collectionName}. Local data was kept.`);
  }
}

async function verifyImport(uid: string, data: GuestData): Promise<void> {
  await Promise.all([
    verifyCollection(uid, "recipes", data.recipes.map((item) => item.id)),
    verifyCollection(uid, "cookingLog", data.cookingLog.map((item) => item.id)),
    verifyCollection(uid, "aiPreferences", data.aiPreferences.map((item) => item.id)),
    verifyCollection(uid, "chatSessions", data.chatSessions.map((item) => item.id)),
  ]);

  if (data.settings.length > 0) {
    const settings = await getDocFromServer(doc(firebaseDb, "users", uid, "settings", "app"));
    if (!settings.exists()) throw new Error("Could not verify imported settings. Local data was kept.");
  }
}

async function clearGuestStores(): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([...DOMAIN_STORES], "readwrite");
    for (const storeName of DOMAIN_STORES) transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to clear imported guest data"));
  });
}

export async function importGuestData(uid: string): Promise<void> {
  if (!navigator.onLine) throw new Error("Reconnect before importing guest data.");

  const data = await readGuestData();
  const createdAt = new Date().toISOString();
  const snapshotId = `${migrationId(uid)}:legacy-v1`;
  await putInStore("legacy-backups", {
    id: snapshotId,
    uid,
    createdAt,
    ...data,
  } satisfies LegacyBackup);

  const writes: { reference: DocumentReference; data: DocumentData }[] = [];
  addCollectionWrites(writes, uid, "recipes", data.recipes);
  addCollectionWrites(writes, uid, "cookingLog", data.cookingLog);
  addCollectionWrites(writes, uid, "aiPreferences", data.aiPreferences);
  addCollectionWrites(writes, uid, "chatSessions", data.chatSessions);

  const rawSettings = data.settings[0];
  const settings = rawSettings ? settingsSchema.parse(rawSettings) : undefined;
  if (settings) {
    writes.push({
      reference: doc(firebaseDb, "users", uid, "settings", "app"),
      data: {
        id: "app",
        llmProvider: settings.llmProvider,
        llmModel: settings.llmModel,
        dietaryRestrictions: settings.dietaryRestrictions,
        otherDietaryNotes: settings.otherDietaryNotes,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    });
    await saveLocalCredentialsForUid(uid, settings.llmApiKey, settings.openRouterOAuthKey);
  }

  await commitWrites(writes);
  await verifyImport(uid, data);
  await putInStore("migration-meta", {
    id: migrationId(uid),
    decision: "complete",
    snapshotId,
    updatedAt: new Date().toISOString(),
  } satisfies MigrationMetadata);
  await clearGuestStores();
}
