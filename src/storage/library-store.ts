import { z } from "zod";
import { generateUUID } from "@/lib/uuid";
import { settingsSchema } from "@/types/settings";
import { chatSessionSchema } from "@/types/chat-session";
import {
  canonical,
  cloudEntity,
  dominates,
  entitySchemas,
  entryKey,
  mergeSnapshots,
  snapshotSchema,
  syncedSettings,
  type Clock,
  type Entity,
  type Snapshot,
  type SyncEntry,
} from "@/storage/sync-merge";

export const LIBRARY_KEY = "chefness:library-v1";
const documentSchema = z.object({
  version: z.literal(1),
  device: z.string(),
  counter: z.number().int().nonnegative(),
  stores: z.record(
    z.string(),
    z.array(z.object({ id: z.string() }).catchall(z.unknown())),
  ),
  entries: snapshotSchema.shape.entries,
  enabled: z.boolean().nullable(),
  account: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  dirty: z.boolean(),
});
export type LibraryDocument = z.infer<typeof documentSchema>;
interface Disk {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** One atomic disk value: local edits and their upload metadata cannot split on a crash. */
export class LibraryStore {
  private queue: Promise<unknown> = Promise.resolve();
  onChange: () => void = () => {};
  constructor(
    private disk: Disk,
    private beforeMigration: () => Promise<void> = async () => {},
  ) {}

  private async load(): Promise<LibraryDocument> {
    const saved = await this.disk.getItem(LIBRARY_KEY);
    if (saved) return documentSchema.parse(JSON.parse(saved));
    await this.beforeMigration();
    const doc: LibraryDocument = {
      version: 1,
      device: generateUUID(),
      counter: 0,
      stores: {},
      entries: [],
      enabled: null,
      account: null,
      lastSyncedAt: null,
      dirty: true,
    };
    for (const [name, schema] of Object.entries({
      ...entitySchemas,
      settings: settingsSchema,
    })) {
      const value = await this.disk.getItem(`chefness:${name}`);
      const entities = z.array(schema).parse(value ? JSON.parse(value) : []);
      doc.stores[name] = entities;
      for (const entity of entities) this.track(doc, name, undefined, entity);
    }
    await this.disk.setItem(LIBRARY_KEY, JSON.stringify(doc));
    return doc;
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    // ponytail: one local transaction queue/snapshot; use SQLite if libraries outgrow this.
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  read(): Promise<LibraryDocument> {
    return this.exclusive(() => this.load());
  }

  transaction<T>(change: (doc: LibraryDocument) => T): Promise<T> {
    return this.exclusive(async () => {
      const doc = await this.load();
      const counter = doc.counter;
      const result = change(doc);
      await this.disk.setItem(LIBRARY_KEY, JSON.stringify(doc));
      if (doc.counter !== counter) this.onChange();
      return result;
    });
  }

  private track(
    doc: LibraryDocument,
    name: string,
    before: Entity | undefined,
    after: Entity | undefined,
  ): void {
    if (name === "settings") {
      for (const field of Object.keys(syncedSettings.shape)) {
        if (
          after &&
          before &&
          canonical(before[field]) === canonical(after[field])
        )
          continue;
        if (after?.[field] === undefined) continue;
        // Defaults on a new device must not overwrite actual preferences in iCloud.
        this.record(
          doc,
          "settings",
          field,
          { value: after[field] },
          before ? new Date().toISOString() : "1970-01-01T00:00:00.000Z",
        );
      }
      return;
    }
    const kind = name as keyof typeof entitySchemas;
    if (!(name in entitySchemas)) throw new Error("Unknown native collection");
    const id = (after ?? before)?.id;
    if (!id) throw new Error("Missing record ID");
    this.record(
      doc,
      kind,
      id,
      after ? cloudEntity(kind, after) : null,
      typeof after?.updatedAt === "string"
        ? after.updatedAt
        : new Date().toISOString(),
    );
  }

  private record(
    doc: LibraryDocument,
    kind: SyncEntry["kind"],
    id: string,
    data: SyncEntry["data"],
    time: string,
  ): void {
    const old = doc.entries.find(
      (item) => item.kind === kind && item.id === id,
    );
    doc.counter++;
    const entry: SyncEntry = {
      kind,
      id,
      data,
      time,
      deleted: data === null,
      revision: `${doc.device}-${doc.counter}`,
      clock: { ...old?.clock, [doc.device]: doc.counter },
    };
    doc.entries = doc.entries.filter(
      (item) => entryKey(item) !== entryKey(entry),
    );
    doc.entries.push(entry);
    doc.dirty = true;
  }

  async getAll(name: string): Promise<Entity[]> {
    const doc = await this.read();
    return (doc.stores[name] ?? []).map((entity) =>
      name === "chat-sessions"
        ? {
            ...entity,
            syncClock:
              doc.entries.find(
                (item) => item.kind === name && item.id === entity.id,
              )?.clock ?? {},
          }
        : entity,
    );
  }

  change(
    name: string,
    id: string,
    build: (existing: Entity | undefined) => Entity | undefined,
    baseClock?: Clock,
  ): Promise<Entity | undefined> {
    return this.transaction((doc) => {
      const entities = doc.stores[name] ?? [];
      const existing = entities.find((entity) => entity.id === id);
      const oldEntry = doc.entries.find(
        (item) => item.kind === name && item.id === id,
      );
      const next = build(existing);
      // An offline/stale editor cannot resurrect a deleted record.
      if (next && oldEntry?.deleted)
        throw new Error("This item was deleted on another device.");
      if (!next && !existing) return undefined;
      if (next && name === "chat-sessions") {
        const session = chatSessionSchema.parse(next);
        session.messages = session.messages.map((message, index) => ({
          ...message,
          hasPhoto: Boolean(message.hasPhoto) || Boolean(message.imageDataUrl),
          photoId:
            message.photoId ??
            (message.hasPhoto === true || Boolean(message.imageDataUrl)
              ? `${id}:${index}`
              : undefined),
        }));
        Object.assign(next, session);
        if (baseClock && oldEntry && !dominates(baseClock, oldEntry.clock)) {
          // The view was edited while a newer cloud version arrived: preserve both.
          next.id = `${id}~${generateUUID()}`;
          next.title = `${String(next.title)} (separate continuation)`;
        }
      }
      const targetId = next?.id ?? id;
      doc.stores[name] = entities.filter((entity) => entity.id !== targetId);
      if (next) doc.stores[name].push(next);
      this.track(doc, name, targetId === id ? existing : undefined, next);
      const clock = doc.entries.find(
        (item) => item.kind === name && item.id === targetId,
      )?.clock;
      return next && name === "chat-sessions"
        ? { ...next, syncClock: clock }
        : next;
    });
  }

  /** Merge inside the disk transaction, including edits made during the network request. */
  merge(doc: LibraryDocument, cloud: Snapshot): Snapshot {
    const merged = mergeSnapshots({ version: 1, entries: doc.entries }, cloud);
    const photos = new Map<string, string>();
    for (const entity of doc.stores["chat-sessions"] ?? []) {
      const session = chatSessionSchema.parse(entity);
      session.messages.forEach((message, index) => {
        if (message.imageDataUrl)
          photos.set(
            message.photoId ?? `${session.id}:${index}`,
            message.imageDataUrl,
          );
      });
    }
    for (const kind of Object.keys(entitySchemas)) doc.stores[kind] = [];
    let settings = doc.stores.settings?.[0];
    if (!settings) {
      settings = settingsSchema.parse({
        id: "user-settings",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasCompletedOnboarding: false,
      });
      doc.stores.settings = [settings];
    }
    for (const entry of merged.entries) {
      if (entry.deleted || !entry.data) continue;
      if (entry.kind === "settings") {
        settings[entry.id] = entry.data.value;
      } else if (entry.kind === "chat-sessions") {
        const session = chatSessionSchema.parse(entry.data);
        session.messages = session.messages.map((message) => ({
          ...message,
          imageDataUrl: message.photoId
            ? (photos.get(message.photoId) ?? "")
            : "",
        }));
        doc.stores[entry.kind].push(session);
      } else doc.stores[entry.kind].push(entry.data as Entity);
    }
    doc.entries = merged.entries;
    return merged;
  }
}
