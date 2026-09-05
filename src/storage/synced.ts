/**
 * Web build: records are device-local and never synced, so the repository is
 * returned unchanged. The iOS implementation lives in `synced.native.ts`.
 */
import type { StorageRepository } from "@/storage/interface";
import type {
  SyncedEntity,
  SyncedStoreDefinition,
} from "@/lib/cloud-sync/types";

export function withSync<
  TEntity extends SyncedEntity,
  TCreate,
  TUpdate extends { id: string },
>(
  inner: StorageRepository<TEntity, TCreate, TUpdate>,
  _definition: SyncedStoreDefinition<TEntity>,
): StorageRepository<TEntity, TCreate, TUpdate> {
  return inner;
}
