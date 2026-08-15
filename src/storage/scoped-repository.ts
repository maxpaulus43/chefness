import { firebaseAuth } from "@/lib/firebase";
import type { StorageRepository } from "@/storage/interface";

/**
 * Routes each operation to the local guest repository or the authenticated
 * user's Firestore repository. Auth restoration gates the app before any
 * domain query runs, so `firebaseAuth.currentUser` is settled at call time.
 */
export class ScopedRepository<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> implements StorageRepository<TEntity, TCreate, TUpdate> {
  constructor(
    private readonly guest: StorageRepository<TEntity, TCreate, TUpdate>,
    private readonly cloud: StorageRepository<TEntity, TCreate, TUpdate>,
  ) {}

  private active(): StorageRepository<TEntity, TCreate, TUpdate> {
    return firebaseAuth.currentUser ? this.cloud : this.guest;
  }

  getAll(): Promise<TEntity[]> {
    return this.active().getAll();
  }

  getById(id: string): Promise<TEntity | undefined> {
    return this.active().getById(id);
  }

  create(data: TCreate): Promise<TEntity> {
    return this.active().create(data);
  }

  update(data: TUpdate): Promise<TEntity | undefined> {
    return this.active().update(data);
  }

  delete(id: string): Promise<boolean> {
    return this.active().delete(id);
  }
}
