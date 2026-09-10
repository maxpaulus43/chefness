import AsyncStorage from "@react-native-async-storage/async-storage";
import { LibraryStore } from "@/storage/library-store";
import { ensureMigrated } from "@/storage/native-credential";
import type { StorageRepository } from "@/storage/interface";
import type { Clock, Entity } from "@/storage/sync-merge";

export const nativeLibrary = new LibraryStore(AsyncStorage, ensureMigrated);

/** Same repository boundary, now with atomic local writes and durable sync metadata. */
export class IndexedDBRepository<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> implements StorageRepository<TEntity, TCreate, TUpdate>
{
  constructor(
    private options: {
      storeName: string;
      buildEntity: (data: TCreate) => TEntity;
      applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;
    },
  ) {}

  async getAll(): Promise<TEntity[]> {
    return (await nativeLibrary.getAll(this.options.storeName)) as TEntity[];
  }
  async getById(id: string): Promise<TEntity | undefined> {
    return (await this.getAll()).find((entity) => entity.id === id);
  }
  async create(data: TCreate): Promise<TEntity> {
    const entity = this.options.buildEntity(data);
    return (await nativeLibrary.change(
      this.options.storeName,
      entity.id,
      () => entity as Entity,
    )) as TEntity;
  }
  async update(data: TUpdate): Promise<TEntity | undefined> {
    return (await nativeLibrary.change(
      this.options.storeName,
      data.id,
      (existing) =>
        existing
          ? (this.options.applyUpdate(existing as TEntity, data) as Entity)
          : undefined,
      (data as TUpdate & { syncBaseClock?: Clock }).syncBaseClock,
    )) as TEntity | undefined;
  }
  async delete(id: string): Promise<boolean> {
    let deleted = false;
    await nativeLibrary.change(this.options.storeName, id, (existing) => {
      deleted = Boolean(existing);
      return undefined;
    });
    return deleted;
  }
}

export function getDB(): Promise<never> {
  return Promise.reject(
    new Error(
      "IndexedDB is unavailable on native; AsyncStorage is used instead.",
    ),
  );
}
