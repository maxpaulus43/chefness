/**
 * Generic repository interface for a single entity collection.
 *
 * This is the abstraction boundary between the tRPC procedures and
 * whatever persistence backend is in use. Every method returns a
 * `Promise` so implementations can be synchronous (localStorage) or
 * asynchronous (HTTP, IndexedDB, SQLite, etc.) without changing any
 * call-site code.
 *
 * To swap backends, provide a new implementation of this interface
 * and wire it into `src/storage/recipes.ts`. Nothing else changes.
 *
 * @typeParam TEntity  The full stored entity (includes `id`, timestamps, etc.)
 * @typeParam TCreate  The fields required to create a new entity (no `id` / timestamps).
 * @typeParam TUpdate  The fields accepted for a partial update (must include `id`).
 */
export interface StorageRepository<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> {
  /** Return every entity in the collection. */
  getAll(): Promise<TEntity[]>;

  /** Return a single entity by ID, or `undefined` if not found. */
  getById(id: string): Promise<TEntity | undefined>;

  /**
   * Persist a new entity.
   *
   * The implementation is responsible for generating `id` and any
   * server-managed fields (e.g. `createdAt`, `updatedAt`).
   */
  create(data: TCreate): Promise<TEntity>;

  /**
   * Apply a partial update to an existing entity.
   *
   * Returns the updated entity, or `undefined` if the ID was not found.
   * The implementation is responsible for bumping `updatedAt` (or
   * equivalent) when applicable.
   */
  update(data: TUpdate): Promise<TEntity | undefined>;

  /**
   * Delete an entity by ID.
   *
   * Returns `true` if the entity existed and was removed, `false` otherwise.
   */
  delete(id: string): Promise<boolean>;
}
