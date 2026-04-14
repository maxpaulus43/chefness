/**
 * One-time migration from localStorage to IndexedDB.
 *
 * For each entity collection, if the corresponding localStorage key
 * exists, its JSON array is parsed and each entity is written into the
 * matching IndexedDB object store. The localStorage key is removed
 * after a successful migration.
 *
 * This function is idempotent — if no localStorage keys exist (either
 * because this is a fresh install or the migration already ran), it
 * completes as a no-op.
 */
import { getDB } from "@/storage/indexed-db";

/** Mapping from localStorage key → IndexedDB object store name. */
const MIGRATION_MAP: readonly { localStorageKey: string; storeName: string }[] = [
  { localStorageKey: "chefness:recipes", storeName: "recipes" },
  { localStorageKey: "chefness:settings", storeName: "settings" },
  { localStorageKey: "chefness:cooking-log", storeName: "cooking-log" },
  { localStorageKey: "chefness:ai-preferences", storeName: "ai-preferences" },
  { localStorageKey: "chefness:chat-sessions", storeName: "chat-sessions" },
];

export async function migrateFromLocalStorage(): Promise<void> {
  // Collect entries that actually need migration.
  const pending: {
    localStorageKey: string;
    storeName: string;
    entities: { id: string }[];
  }[] = [];

  for (const { localStorageKey, storeName } of MIGRATION_MAP) {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) continue;

    try {
      const entities = JSON.parse(raw) as { id: string }[];
      if (Array.isArray(entities) && entities.length > 0) {
        pending.push({ localStorageKey, storeName, entities });
      } else {
        // Empty array or non-array — just clean up the key.
        localStorage.removeItem(localStorageKey);
      }
    } catch {
      // Corrupt JSON — remove the key so we don't retry forever.
      localStorage.removeItem(localStorageKey);
    }
  }

  if (pending.length === 0) return;

  const db = await getDB();

  for (const { localStorageKey, storeName, entities } of pending) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      for (const entity of entities) {
        store.put(entity);
      }

      tx.oncomplete = () => {
        localStorage.removeItem(localStorageKey);
        resolve();
      };
      tx.onerror = () => reject(tx.error ?? new Error("Migration transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("Migration transaction aborted"));
    });
  }
}
