/**
 * IndexedDB-backed implementation of `StorageRepository`.
 *
 * This is the ONLY file in the entire codebase that touches
 * `window.indexedDB`. Replace the instantiation in each entity file
 * (e.g. `recipes.ts`) to swap from `LocalStorageRepository` to this
 * class. The rest of the app is unaffected because it only depends on
 * the `StorageRepository` interface.
 *
 * All five entity stores share a single `"chefness"` database so that
 * IndexedDB's `onupgradeneeded` lifecycle is handled in one place.
 */
import type { StorageRepository } from "@/storage/interface";

// ---------------------------------------------------------------------------
// Database constants
// ---------------------------------------------------------------------------

const DB_NAME = "chefness";
const DB_VERSION = 1;
const STORE_NAMES = [
  "recipes",
  "settings",
  "cooking-log",
  "ai-preferences",
  "chat-sessions",
] as const;

// ---------------------------------------------------------------------------
// Shared database connection (lazy singleton)
// ---------------------------------------------------------------------------

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Return the shared `IDBDatabase` instance (opened lazily on first call). */
export function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Repository options
// ---------------------------------------------------------------------------

interface IndexedDBRepositoryOptions<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> {
  /** The object store name (one per entity, e.g. `"recipes"`). */
  storeName: string;
  /** Build a complete `TEntity` from user-provided creation data. */
  buildEntity: (data: TCreate) => TEntity;
  /** Apply update fields to an existing entity and return the result. */
  applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;
}

// ---------------------------------------------------------------------------
// IndexedDBRepository
// ---------------------------------------------------------------------------

export class IndexedDBRepository<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> implements StorageRepository<TEntity, TCreate, TUpdate>
{
  private readonly storeName: string;
  private readonly buildEntity: (data: TCreate) => TEntity;
  private readonly applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;

  constructor(options: IndexedDBRepositoryOptions<TEntity, TCreate, TUpdate>) {
    this.storeName = options.storeName;
    this.buildEntity = options.buildEntity;
    this.applyUpdate = options.applyUpdate;
  }

  async getAll(): Promise<TEntity[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as TEntity[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: string): Promise<TEntity | undefined> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);
      request.onsuccess = () =>
        resolve((request.result as TEntity | undefined) ?? undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async create(data: TCreate): Promise<TEntity> {
    const entity = this.buildEntity(data);
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const request = store.put(entity);
      request.onsuccess = () => resolve(entity);
      request.onerror = () => reject(request.error);
    });
  }

  async update(data: TUpdate): Promise<TEntity | undefined> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const getRequest = store.get(data.id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result as TEntity | undefined;
        if (!existing) {
          resolve(undefined);
          return;
        }
        const updated = this.applyUpdate(existing, data);
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async delete(id: string): Promise<boolean> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          resolve(false);
          return;
        }
        const deleteRequest = store.delete(id);
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }
}
