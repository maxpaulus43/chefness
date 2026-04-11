/**
 * localStorage-backed implementation of `StorageRepository`.
 *
 * This is the ONLY file in the entire codebase that touches
 * `window.localStorage`. Replace this single file (or swap the
 * export in `recipes.ts`) and the rest of the app is unaffected.
 *
 * All methods return `Promise` for interface compatibility, even
 * though localStorage itself is synchronous.
 */
import type { StorageRepository } from "@/storage/interface";

/**
 * Configuration needed to construct a `LocalStorageRepository`.
 *
 * @typeParam TEntity  The full stored entity type.
 * @typeParam TCreate  The user-supplied fields for creation.
 * @typeParam TUpdate  The user-supplied fields for an update (must include `id`).
 */
interface LocalStorageRepositoryOptions<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> {
  /** The `localStorage` key under which the collection is stored. */
  storageKey: string;

  /**
   * Build a complete `TEntity` from user-provided creation data.
   *
   * This is where you generate `id`, `createdAt`, `updatedAt`, etc.
   */
  buildEntity: (data: TCreate) => TEntity;

  /**
   * Apply update fields to an existing entity and return the result.
   *
   * This is where you bump `updatedAt`, merge partial fields, etc.
   */
  applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;
}

export class LocalStorageRepository<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> implements StorageRepository<TEntity, TCreate, TUpdate>
{
  private readonly storageKey: string;
  private readonly buildEntity: (data: TCreate) => TEntity;
  private readonly applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;

  constructor(options: LocalStorageRepositoryOptions<TEntity, TCreate, TUpdate>) {
    this.storageKey = options.storageKey;
    this.buildEntity = options.buildEntity;
    this.applyUpdate = options.applyUpdate;
  }

  // ---------------------------------------------------------------------------
  // Private helpers — the only code that touches localStorage
  // ---------------------------------------------------------------------------

  private readAll(): TEntity[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      return JSON.parse(raw) as TEntity[];
    } catch {
      return [];
    }
  }

  private writeAll(items: TEntity[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }

  // ---------------------------------------------------------------------------
  // StorageRepository implementation
  // ---------------------------------------------------------------------------

  async getAll(): Promise<TEntity[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<TEntity | undefined> {
    return this.readAll().find((item) => item.id === id);
  }

  async create(data: TCreate): Promise<TEntity> {
    const entity = this.buildEntity(data);
    const items = this.readAll();
    items.push(entity);
    this.writeAll(items);
    return entity;
  }

  async update(data: TUpdate): Promise<TEntity | undefined> {
    const items = this.readAll();
    const index = items.findIndex((item) => item.id === data.id);
    if (index === -1) return undefined;

    const updated = this.applyUpdate(items[index]!, data);
    items[index] = updated;
    this.writeAll(items);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const items = this.readAll();
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) return false;
    this.writeAll(filtered);
    return true;
  }
}
