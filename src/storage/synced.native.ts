/**
 * iOS: wraps an AsyncStorage-backed repository so that every write is
 * reported to the iCloud Sync engine and deletes become tombstones.
 *
 * Reads hide tombstones, so routers, hooks, and screens keep seeing the same
 * `StorageRepository` contract they always did.
 */
import type { IndexedDBRepository } from "@/storage/indexed-db.native";
import type { StorageRepository } from "@/storage/interface";
import {
  getCloudSyncSnapshot,
  registerSyncedStore,
} from "@/lib/cloud-sync/engine";
import { isLive } from "@/lib/cloud-sync/merge";
import type {
  SyncedEntity,
  SyncedStoreDefinition,
} from "@/lib/cloud-sync/types";
import { TOMBSTONE_RETENTION_MS } from "@/types/tombstone";

export function withSync<
  TEntity extends SyncedEntity,
  TCreate,
  TUpdate extends { id: string },
>(
  inner: IndexedDBRepository<TEntity, TCreate, TUpdate>,
  definition: SyncedStoreDefinition<TEntity>,
): StorageRepository<TEntity, TCreate, TUpdate> {
  const sync = registerSyncedStore(definition, inner);

  /**
   * While sync is off nothing will ever push these tombstones, so drop the
   * expired ones here instead of letting them accumulate forever.
   */
  const sweepExpiredTombstones = async (
    entities: TEntity[],
  ): Promise<TEntity[]> => {
    if (getCloudSyncSnapshot().isEnabled) return entities;
    const cutoff = new Date(Date.now() - TOMBSTONE_RETENTION_MS).toISOString();
    const kept = entities.filter(
      (entity) => entity.deletedAt === undefined || entity.deletedAt >= cutoff,
    );
    if (kept.length !== entities.length) await inner.writeAll(kept);
    return kept;
  };

  return {
    async getAll() {
      const entities = await sweepExpiredTombstones(await inner.readAll());
      return entities.filter(isLive);
    },

    async getById(id) {
      const entity = (await inner.readAll()).find((item) => item.id === id);
      return entity && isLive(entity) ? entity : undefined;
    },

    async create(data) {
      const entity = await inner.create(data);
      sync.markDirty(entity);
      return entity;
    },

    async update(data) {
      const existing = (await inner.readAll()).find(
        (item) => item.id === data.id,
      );
      if (!existing || !isLive(existing)) return undefined;
      const updated = await inner.update(data);
      if (updated) sync.markDirty(updated);
      return updated;
    },

    async delete(id) {
      const entities = await inner.readAll();
      const existing = entities.find((item) => item.id === id);
      if (!existing || !isLive(existing)) return false;
      const now = new Date().toISOString();
      const tombstone: TEntity = {
        ...existing,
        updatedAt: now,
        deletedAt: now,
      };
      await inner.put(tombstone);
      sync.markDirty(tombstone);
      return true;
    },
  };
}
