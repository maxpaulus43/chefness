import { z } from "zod";
import { recipeSchema } from "@/types/recipe";
import { cookingLogEntrySchema } from "@/types/cooking-log";
import { aiPreferenceSchema } from "@/types/ai-preference";
import { chatSessionSchema } from "@/types/chat-session";
import { settingsSchema } from "@/types/settings";

export const syncedSettings = settingsSchema.pick({
  llmModel: true,
  dietaryRestrictions: true,
  otherDietaryNotes: true,
  modelFilterFreeOnly: true,
  modelFilterVisionOnly: true,
  modelFilterToolsOnly: true,
});
export const entitySchemas = {
  recipes: recipeSchema,
  "cooking-log": cookingLogEntrySchema,
  "ai-preferences": aiPreferenceSchema,
  "chat-sessions": chatSessionSchema,
};
export const clockSchema = z.record(z.string(), z.number().int().nonnegative());
export type Clock = z.infer<typeof clockSchema>;
export interface Entity {
  id: string;
  [key: string]: unknown;
}
export const entrySchema = z.object({
  kind: z.enum([
    "recipes",
    "cooking-log",
    "ai-preferences",
    "chat-sessions",
    "settings",
  ]),
  id: z.string().min(1),
  time: z.iso.datetime(),
  revision: z.string().min(1),
  clock: clockSchema,
  deleted: z.boolean(),
  data: z.record(z.string(), z.unknown()).nullable(),
});
export type SyncEntry = z.infer<typeof entrySchema>;
export const snapshotSchema = z.object({
  version: z.literal(1),
  entries: z.array(entrySchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export function entryKey(entry: Pick<SyncEntry, "kind" | "id">): string {
  return `${entry.kind}:${entry.id}`;
}

/** Allowlist at the cloud boundary. Never transmit native photo paths or secrets. */
export function cloudEntity(
  kind: keyof typeof entitySchemas,
  entity: Entity,
): Entity {
  const parsed = entitySchemas[kind].parse(entity);
  if (kind !== "chat-sessions") return parsed;
  const session = chatSessionSchema.parse(parsed);
  return {
    ...session,
    syncClock: {},
    messages: session.messages.map((message, index) => ({
      ...message,
      imageDataUrl: "",
      hasPhoto: Boolean(message.imageDataUrl) || Boolean(message.hasPhoto),
      photoId:
        message.photoId ??
        (Boolean(message.imageDataUrl) || message.hasPhoto === true
          ? `${session.id}:${index}`
          : undefined),
    })),
  };
}

export function parseSnapshot(value: unknown): Snapshot {
  const snapshot = snapshotSchema.parse(value);
  const keys = new Set<string>();
  for (const entry of snapshot.entries) {
    const key = entryKey(entry);
    if (keys.has(key)) throw new Error("Duplicate iCloud record");
    keys.add(key);
    if (entry.deleted) {
      if (entry.data !== null) throw new Error("Invalid iCloud deletion");
    } else if (entry.kind === "settings") {
      const schema =
        syncedSettings.shape[entry.id as keyof typeof syncedSettings.shape];
      if (
        !Object.prototype.hasOwnProperty.call(syncedSettings.shape, entry.id) ||
        !entry.data
      )
        throw new Error("Invalid iCloud setting");
      entry.data = { value: schema.parse(entry.data.value) };
    } else {
      if (!entry.data) throw new Error("Missing iCloud record");
      entry.data = cloudEntity(entry.kind, entry.data as Entity);
      if (entry.data.id !== entry.id)
        throw new Error("Invalid iCloud record ID");
    }
  }
  return snapshot;
}

export function joinClocks(a: Clock, b: Clock): Clock {
  const result = { ...a };
  for (const [device, count] of Object.entries(b))
    result[device] = Math.max(result[device] ?? 0, count);
  return result;
}

export function dominates(a: Clock, b: Clock): boolean {
  return Object.entries(b).every(
    ([device, count]) => (a[device] ?? 0) >= count,
  );
}

function latest(a: SyncEntry, b: SyncEntry): SyncEntry {
  return `${a.time}:${a.revision}` >= `${b.time}:${b.revision}` ? a : b;
}

/** Stable JSON comparison independent of property insertion order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return value === undefined ? "null" : JSON.stringify(value);
}

function sameChat(a: SyncEntry, b: SyncEntry): boolean {
  // Message timestamps and action flags are not separate conversation branches.
  const content = (entry: SyncEntry) =>
    chatSessionSchema
      .parse(entry.data)
      .messages.map(({ role, content, hasPhoto, importedRecipeContext }) => ({
        role,
        content,
        hasPhoto,
        importedRecipeContext,
      }));
  return canonical(content(a)) === canonical(content(b));
}

/** Tombstones are permanent; clocks detect concurrency, wall time selects winners. */
export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const merged = new Map(a.entries.map((entry) => [entryKey(entry), entry]));
  const forks: SyncEntry[] = [];
  for (const incoming of b.entries) {
    const key = entryKey(incoming);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, incoming);
      continue;
    }
    let winner = latest(current, incoming);
    if (current.deleted || incoming.deleted) {
      winner =
        current.deleted && incoming.deleted
          ? latest(current, incoming)
          : current.deleted
            ? current
            : incoming;
    } else if (current.kind === "chat-sessions") {
      const aAfterB = dominates(current.clock, incoming.clock);
      const bAfterA = dominates(incoming.clock, current.clock);
      if (aAfterB && !bAfterA) winner = current;
      else if (bAfterA && !aAfterB) winner = incoming;
      else if (!aAfterB && !bAfterA && !sameChat(current, incoming)) {
        const loser = winner === current ? incoming : current;
        const id = `${loser.id}~${loser.revision}`;
        forks.push({
          ...loser,
          id,
          data: {
            ...loser.data,
            id,
            title: `${String(loser.data?.title)} (separate continuation)`,
          },
        });
      }
    }
    merged.set(key, {
      ...winner,
      clock: joinClocks(current.clock, incoming.clock),
    });
  }
  // Merge forks as records too: a previously deleted fork must not reappear.
  if (forks.length)
    return mergeSnapshots(
      { version: 1, entries: [...merged.values()] },
      { version: 1, entries: forks },
    );
  return {
    version: 1,
    entries: [...merged.values()].sort((x, y) =>
      entryKey(x).localeCompare(entryKey(y)),
    ),
  };
}
