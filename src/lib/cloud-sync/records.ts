import type { SyncedEntity } from "@/lib/cloud-sync/types";

export const CLOUD_SYNC_CONTAINER_ID = "iCloud.com.maxpaulus.chefness";

/** Single custom zone so one delta fetch covers every entity type. */
export const CLOUD_SYNC_ZONE = "ChefnessData";

export const CHAT_IMAGE_RECORD_TYPE = "ChatImage";

const RECORD_NAME_SEPARATOR = "__";

/**
 * Field layout shared by every entity record.
 *
 * The entity travels as one JSON `payload` string so the CloudKit schema
 * never has to change when a Zod schema gains a field (production schemas are
 * additive-only and must be deployed by hand). `updatedAt`/`deletedAt` are
 * duplicated as real fields for inspection in the CloudKit console.
 */
export interface SyncRecordField {
  type: "string" | "date" | "asset";
  value: string;
}

export type SyncRecordFields = Record<string, SyncRecordField>;

export function recordNameFor(storeName: string, id: string): string {
  return `${storeName}${RECORD_NAME_SEPARATOR}${id}`;
}

export function parseRecordName(
  recordName: string,
): { storeName: string; id: string } | null {
  const index = recordName.indexOf(RECORD_NAME_SEPARATOR);
  if (index <= 0) return null;
  const id = recordName.slice(index + RECORD_NAME_SEPARATOR.length);
  if (!id) return null;
  return { storeName: recordName.slice(0, index), id };
}

export function entityToRecordFields(entity: SyncedEntity): SyncRecordFields {
  const fields: SyncRecordFields = {
    payload: { type: "string", value: JSON.stringify(entity) },
    updatedAt: { type: "date", value: entity.updatedAt },
  };
  if (entity.deletedAt) {
    fields.deletedAt = { type: "date", value: entity.deletedAt };
  }
  return fields;
}

export function entityFromRecordFields<T extends SyncedEntity>(
  fields: Record<string, { value: unknown }>,
  parse: (value: unknown) => T | null,
): T | null {
  const payloadField: { value: unknown } | undefined = fields.payload;
  const payload = payloadField?.value;
  if (typeof payload !== "string" || !payload) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch {
    return null;
  }
  return parse(decoded);
}
