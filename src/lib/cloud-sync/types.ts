/** Minimum shape every synced entity shares (see `src/types/tombstone.ts`). */
export interface SyncedEntity {
  id: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Whole-collection access the sync engine needs from a local store. */
export interface RawStore<TEntity extends SyncedEntity> {
  /** Every record, including tombstones. */
  readAll(): Promise<TEntity[]>;
  writeAll(entities: TEntity[]): Promise<void>;
}

/** Per-entity sync configuration supplied by the storage layer. */
export interface SyncedStoreDefinition<TEntity extends SyncedEntity> {
  /** Local collection name, e.g. `"recipes"`. Also the record-name prefix. */
  storeName: string;
  /** CloudKit record type, e.g. `"Recipe"`. */
  recordType: string;
  /** Runtime-validate a decoded payload; return `null` to skip the record. */
  parse: (value: unknown) => TEntity | null;
  /** Resolve a local/remote pair. Defaults to last-write-wins on `updatedAt`. */
  merge?: (local: TEntity, remote: TEntity) => TEntity;
  /** Transform an entity before it leaves the device (e.g. strip secrets). */
  toPayload?: (entity: TEntity) => TEntity;
}

export type CloudSyncAccountStatus =
  | "available"
  | "noAccount"
  | "restricted"
  | "unavailable"
  | "unknown";

export interface CloudSyncSnapshot {
  /** `false` on web and in builds without the CloudKit native module. */
  isAvailable: boolean;
  /** Whether the iCloud Sync purchase is owned. */
  isEntitled: boolean;
  /** User toggle, persisted on-device. */
  isEnabled: boolean;
  accountStatus: CloudSyncAccountStatus;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}
