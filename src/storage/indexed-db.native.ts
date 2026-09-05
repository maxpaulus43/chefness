import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageRepository } from "@/storage/interface";

interface NativeRepositoryOptions<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> {
  storeName: string;
  buildEntity: (data: TCreate) => TEntity;
  applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;
}

/** AsyncStorage-backed native implementation matching the web IndexedDB boundary. */
export class IndexedDBRepository<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> implements StorageRepository<TEntity, TCreate, TUpdate>
{
  private readonly key: string;
  private readonly buildEntity: (data: TCreate) => TEntity;
  private readonly applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;

  constructor(options: NativeRepositoryOptions<TEntity, TCreate, TUpdate>) {
    this.key = `chefness:${options.storeName}`;
    this.buildEntity = options.buildEntity;
    this.applyUpdate = options.applyUpdate;
  }

  /** Every stored record, including sync tombstones. Used by the sync layer. */
  async readAll(): Promise<TEntity[]> {
    const value = await AsyncStorage.getItem(this.key);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as TEntity[]) : [];
  }

  /** Replace the whole collection. Used by the sync layer. */
  writeAll(entities: TEntity[]): Promise<void> {
    return AsyncStorage.setItem(this.key, JSON.stringify(entities));
  }

  /** Insert or replace one record verbatim (no `applyUpdate`, no timestamp bump). */
  async put(entity: TEntity): Promise<void> {
    const entities = await this.readAll();
    const index = entities.findIndex((item) => item.id === entity.id);
    if (index < 0) entities.push(entity);
    else entities[index] = entity;
    await this.writeAll(entities);
  }

  getAll(): Promise<TEntity[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<TEntity | undefined> {
    return (await this.readAll()).find((entity) => entity.id === id);
  }

  async create(data: TCreate): Promise<TEntity> {
    const entity = this.buildEntity(data);
    const entities = await this.readAll();
    await this.writeAll([
      ...entities.filter((item) => item.id !== entity.id),
      entity,
    ]);
    return entity;
  }

  async update(data: TUpdate): Promise<TEntity | undefined> {
    const entities = await this.readAll();
    const index = entities.findIndex((entity) => entity.id === data.id);
    if (index < 0) return undefined;
    const existing = entities[index];
    if (!existing) return undefined;
    const updated = this.applyUpdate(existing, data);
    entities[index] = updated;
    await this.writeAll(entities);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const entities = await this.readAll();
    const next = entities.filter((entity) => entity.id !== id);
    if (next.length === entities.length) return false;
    await this.writeAll(next);
    return true;
  }
}

/** Compatibility export; native repositories open AsyncStorage lazily. */
export function getDB(): Promise<never> {
  return Promise.reject(
    new Error(
      "IndexedDB is unavailable on native; AsyncStorage is used instead.",
    ),
  );
}
