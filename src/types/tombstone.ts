import { z } from "zod";

/**
 * Shared soft-delete marker for every synced entity.
 *
 * Deletions must carry a timestamp so last-write-wins sync can order them
 * against edits made on another device. On iOS the storage layer keeps
 * deleted records as tombstones (filtered out of reads) until they have been
 * pushed to iCloud and aged out; the web app still hard-deletes.
 */
export const tombstoneFields = {
  /** ISO timestamp of the deletion; absent for live records. */
  deletedAt: z.string().optional(),
};

export const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
