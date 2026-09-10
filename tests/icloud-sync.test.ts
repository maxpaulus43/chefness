import { expect, test } from "bun:test";
import { LibraryStore, LIBRARY_KEY } from "../src/storage/library-store";
import {
  CloudSyncService,
  type CloudTransport,
} from "../src/storage/cloud-sync-service";
import {
  canonical,
  mergeSnapshots,
  parseSnapshot,
  type Entity,
  type Snapshot,
  type SyncEntry,
} from "../src/storage/sync-merge";

const time = "2026-08-20T10:00:00.000Z";
const later = "2026-08-20T11:00:00.000Z";
const recipe = (id: string, title = id, updatedAt = time): Entity => ({
  id,
  title,
  description: "",
  ingredients: [],
  steps: [],
  createdAt: time,
  updatedAt,
});
const chat = (id: string, content = "Hello", imageDataUrl = ""): Entity => ({
  id,
  title: "Dinner",
  mealType: null,
  mealSize: null,
  createdAt: time,
  updatedAt: time,
  messages: [{ role: "user", content, imageDataUrl, timestamp: time }],
});
function disk() {
  const values = new Map<string, string>();
  let fail = false;
  return {
    values,
    failNextWrite() {
      fail = true;
    },
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (fail) {
        fail = false;
        throw new Error("Disk full");
      }
      values.set(key, value);
    },
  };
}
const snapshot = async (store: LibraryStore): Promise<Snapshot> => ({
  version: 1,
  entries: (await store.read()).entries,
});
const roundTrip = (data: Snapshot) =>
  parseSnapshot(JSON.parse(canonical(data)));
async function apply(store: LibraryStore, data: Snapshot) {
  return store.transaction((doc) => store.merge(doc, roundTrip(data)));
}

class Cloud implements CloudTransport {
  accountId = "account-a";
  payload = "";
  token = 0;
  writes = 0;
  fail = false;
  conflictOnce = false;
  onSave: (() => Promise<void>) | undefined;
  async account() {
    if (this.fail) throw new Error("Offline");
    return this.accountId;
  }
  async fetch(_account: string) {
    if (this.fail) throw new Error("Offline");
    return { payload: this.payload, token: String(this.token) };
  }
  async save(_account: string, payload: string, token: string) {
    if (this.fail) throw new Error("Offline");
    if (this.onSave) {
      const callback = this.onSave;
      this.onSave = undefined;
      await callback();
    }
    if (this.conflictOnce) {
      this.conflictOnce = false;
      this.token++;
      return false;
    }
    if (token !== String(this.token)) return false;
    this.payload = payload;
    this.token++;
    this.writes++;
    return true;
  }
}
function service(library: LibraryStore, cloud: Cloud) {
  const sync = new CloudSyncService(library, cloud);
  library.onChange = () => {}; // deterministic checks call run explicitly, rather than waiting for debounce
  return sync;
}

// Real serialized storage, not a repository mock: verifies the durable queue and atomic migration.
test("migrates legacy arrays without deleting originals; concurrent local writes survive restart", async () => {
  const storage = disk();
  storage.values.set("chefness:recipes", JSON.stringify([recipe("old")]));
  const store = new LibraryStore(storage);
  await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      store.change("recipes", String(index), () => recipe(String(index))),
    ),
  );
  expect((await new LibraryStore(storage).getAll("recipes")).length).toBe(9);
  expect((await snapshot(store)).entries.length).toBe(9);
  expect(storage.values.get("chefness:recipes")).toContain("old");
  storage.failNextWrite();
  await expect(
    store.change("recipes", "failed", () => recipe("failed")),
  ).rejects.toThrow("Disk full");
  expect((await new LibraryStore(storage).getAll("recipes")).length).toBe(9);
  expect(storage.values.get(LIBRARY_KEY)).not.toContain("failed");
});

test("first sync merges IDs, keeps same-title recipes, and last whole-record edit wins", async () => {
  const a = new LibraryStore(disk());
  const b = new LibraryStore(disk());
  await a.change("recipes", "a", () => recipe("a", "Soup"));
  await b.change("recipes", "b", () => recipe("b", "Soup"));
  const first = mergeSnapshots(await snapshot(a), await snapshot(b));
  await apply(a, first);
  await apply(b, first);
  expect((await a.getAll("recipes")).length).toBe(2);
  await a.change("recipes", "a", () => recipe("a", "Earlier", time));
  await b.change("recipes", "a", () => recipe("a", "Later", later));
  const merged = mergeSnapshots(await snapshot(a), await snapshot(b));
  expect(merged.entries.find((entry) => entry.id === "a")?.data?.title).toBe(
    "Later",
  );
  expect(canonical(merged)).toBe(
    canonical(mergeSnapshots(await snapshot(b), await snapshot(a))),
  );
});

test("deletion beats offline edits, survives round trips, and cannot be locally resurrected", async () => {
  const a = new LibraryStore(disk());
  const b = new LibraryStore(disk());
  await a.change("recipes", "a", () => recipe("a"));
  await apply(b, await snapshot(a));
  await a.change("recipes", "a", () => undefined);
  await b.change("recipes", "a", () => recipe("a", "Offline edit", later));
  const merged = await apply(b, await snapshot(a));
  await apply(a, merged);
  expect(await a.getAll("recipes")).toEqual([]);
  expect(await b.getAll("recipes")).toEqual([]);
  await expect(b.change("recipes", "a", () => recipe("a"))).rejects.toThrow(
    "deleted",
  );
  expect((await snapshot(b)).entries[0]?.deleted).toBe(true);
});

test("settings merge per field; credentials, onboarding, photos and paths never enter cloud JSON", async () => {
  const storage = disk();
  storage.values.set(
    "chefness:settings",
    JSON.stringify([
      {
        id: "user-settings",
        createdAt: time,
        updatedAt: time,
        openRouterOAuthKey: "SECRET",
        llmApiKey: "OLD_SECRET",
        hasCompletedOnboarding: true,
      },
    ]),
  );
  const a = new LibraryStore(storage);
  const b = new LibraryStore(disk());
  await a.change("chat-sessions", "chat", () =>
    chat("chat", "Look", "file:///private/photo.jpg"),
  );
  await a.change("chat-sessions", "legacy", () =>
    chat("legacy", "Look", "data:image/jpeg;base64,SECRET_BYTES"),
  );
  await apply(b, await snapshot(a));
  await a.change("settings", "user-settings", (old) => ({
    ...old!,
    dietaryRestrictions: ["vegan"],
  }));
  await b.change("settings", "user-settings", (old) => ({
    ...old!,
    llmModel: "test/model",
  }));
  const merged = await apply(a, await snapshot(b));
  const settings = (await a.getAll("settings"))[0]!;
  expect(settings.dietaryRestrictions).toEqual(["vegan"]);
  expect(settings.llmModel).toBe("test/model");
  expect(settings.openRouterOAuthKey).toBe("SECRET"); // local only, transport allowlist excludes it
  expect(settings.hasCompletedOnboarding).toBe(true);
  const json = canonical(merged);
  for (const secret of [
    "SECRET",
    "file:///",
    "base64",
    "hasCompletedOnboarding",
    "openRouterOAuthKey",
    "llmApiKey",
  ])
    expect(json).not.toContain(secret);
  const remoteChat = (await b.getAll("chat-sessions"))[0]!;
  expect((remoteChat.messages as Entity[])[0]?.imageDataUrl).toBe("");
  expect((remoteChat.messages as Entity[])[0]?.hasPhoto).toBe(true);
  expect(
    ((await a.getAll("chat-sessions"))[0]!.messages as Entity[])[0]
      ?.imageDataUrl,
  ).not.toBe("");
});

test("concurrent chat continuations fork once, converge, and preserve deletion of the fork", async () => {
  const a = new LibraryStore(disk());
  const b = new LibraryStore(disk());
  await a.change("chat-sessions", "chat", () => chat("chat"));
  await apply(b, await snapshot(a));
  await a.change("chat-sessions", "chat", () => chat("chat", "Phone branch"));
  await b.change("chat-sessions", "chat", () => chat("chat", "iPad branch"));
  const merged = mergeSnapshots(await snapshot(a), await snapshot(b));
  expect(merged.entries.length).toBe(2);
  expect(canonical(merged)).toBe(
    canonical(mergeSnapshots(await snapshot(b), await snapshot(a))),
  );
  await apply(a, merged);
  await apply(b, merged);
  await apply(a, await snapshot(b));
  expect((await a.getAll("chat-sessions")).length).toBe(2);
  const fork = merged.entries.find((entry) => entry.id !== "chat")!;
  await a.change("chat-sessions", fork.id, () => undefined);
  await apply(b, await snapshot(a));
  expect((await b.getAll("chat-sessions")).length).toBe(1);
});

test("stale open chat editor forks instead of overwriting an already received remote continuation", async () => {
  const store = new LibraryStore(disk());
  const initial = await store.change("chat-sessions", "chat", () =>
    chat("chat"),
  );
  await store.change("chat-sessions", "chat", () =>
    chat("chat", "Remote continuation"),
  );
  const result = await store.change(
    "chat-sessions",
    "chat",
    () => chat("chat", "Stale local view"),
    initial!.syncClock as Record<string, number>,
  );
  expect(result?.id).not.toBe("chat");
  expect((await store.getAll("chat-sessions")).length).toBe(2);
});

test("sequential chat continuation does not fork; deterministic tie-breaks and repeated merges are stable", async () => {
  const a = new LibraryStore(disk());
  const b = new LibraryStore(disk());
  await a.change("chat-sessions", "chat", () => chat("chat"));
  await apply(b, await snapshot(a));
  await b.change("chat-sessions", "chat", () => chat("chat", "Continued"));
  const merged = mergeSnapshots(await snapshot(a), await snapshot(b));
  expect(merged.entries.length).toBe(1);
  expect(canonical(merged)).toBe(
    canonical(mergeSnapshots(merged, await snapshot(a))),
  );
  expect(canonical(merged)).toBe(canonical(mergeSnapshots(merged, merged)));
});

test("invalid/newer cloud schemas fail closed, including duplicate IDs and invalid setting fields", async () => {
  expect(() => parseSnapshot({ version: 2, entries: [] })).toThrow();
  const store = new LibraryStore(disk());
  await store.change("recipes", "a", () => recipe("a"));
  const entry = (await snapshot(store)).entries[0]!;
  expect(() =>
    parseSnapshot({ version: 1, entries: [entry, entry] }),
  ).toThrow();
  expect(() =>
    parseSnapshot({
      version: 1,
      entries: [{ ...entry, kind: "settings", id: "openRouterOAuthKey" }],
    }),
  ).toThrow();
  expect(() =>
    parseSnapshot({
      version: 1,
      entries: [{ ...entry, kind: "settings", id: "__proto__" }],
    }),
  ).toThrow();
  expect(() =>
    parseSnapshot({
      version: 1,
      entries: [{ ...entry, data: { id: "different" } }],
    }),
  ).toThrow();
});

test("free never syncs, entitlement enables automatically, explicit off survives restoration and restart", async () => {
  const storage = disk();
  const store = new LibraryStore(storage);
  const cloud = new Cloud();
  const sync = service(store, cloud);
  await store.change("recipes", "a", () => recipe("a"));
  await sync.run();
  expect(cloud.writes).toBe(0);
  await sync.setEntitled(true);
  await sync.run();
  expect(cloud.writes).toBe(1);
  expect((await sync.status()).dirty).toBe(false);
  await sync.setEnabled(false);
  await store.change("recipes", "a", () => undefined);
  await sync.setEntitled(true);
  await sync.run();
  expect(cloud.writes).toBe(1);
  const restarted = service(new LibraryStore(storage), cloud);
  await restarted.setEntitled(true);
  await restarted.run();
  expect(cloud.writes).toBe(1);
  await restarted.setEnabled(true);
  await restarted.run();
  expect(cloud.writes).toBe(2);
  expect(parseSnapshot(JSON.parse(cloud.payload)).entries[0]?.deleted).toBe(
    true,
  );
});

test("network failures and compare-and-save conflicts retain pending edits and retry", async () => {
  const store = new LibraryStore(disk());
  const cloud = new Cloud();
  const sync = service(store, cloud);
  await store.change("recipes", "a", () => recipe("a"));
  cloud.fail = true;
  await sync.setEntitled(true);
  await sync.run();
  expect((await sync.status()).dirty).toBe(true);
  expect((await sync.status()).lastSyncedAt).toBeNull();
  cloud.fail = false;
  cloud.conflictOnce = true;
  await sync.run();
  expect((await sync.status()).dirty).toBe(false);
  expect((await sync.status()).error).toBeNull();
});

test("edits during upload are not falsely acknowledged and survive the next sync", async () => {
  const store = new LibraryStore(disk());
  const cloud = new Cloud();
  const sync = service(store, cloud);
  await store.change("recipes", "a", () => recipe("a"));
  cloud.onSave = async () => {
    await store.change("recipes", "b", () => recipe("b"));
  };
  await sync.setEntitled(true);
  await sync.run();
  expect(parseSnapshot(JSON.parse(cloud.payload)).entries.length).toBe(2);
  expect((await sync.status()).dirty).toBe(false);
});

test("account switches require explicit confirmation; revocation keeps local data and stops sync", async () => {
  const store = new LibraryStore(disk());
  const cloud = new Cloud();
  const sync = service(store, cloud);
  await store.change("recipes", "a", () => recipe("a"));
  await sync.setEntitled(true);
  await sync.run();
  cloud.accountId = "account-b";
  cloud.payload = "";
  cloud.token = 0;
  await sync.run();
  expect((await sync.status()).needsAccountConfirmation).toBe(true);
  expect(cloud.payload).toBe("");
  await sync.confirmAccount();
  await sync.run();
  expect(cloud.payload).toContain('"a"');
  await sync.setEntitled(false);
  await store.change("recipes", "b", () => recipe("b"));
  await sync.run();
  expect(cloud.payload).not.toContain('"b"');
  expect((await store.getAll("recipes")).length).toBe(2);
});

test("disabling sync during a fetch prevents its merge/upload", async () => {
  const store = new LibraryStore(disk());
  const cloud = new Cloud();
  const sync = service(store, cloud);
  await store.change("recipes", "a", () => recipe("a"));
  cloud.fetch = async () => {
    await sync.setEnabled(false);
    return { payload: "", token: "0" };
  };
  await sync.setEntitled(true);
  await sync.run();
  expect(cloud.writes).toBe(0);
  expect((await sync.status()).dirty).toBe(true);
});

test("tombstone merge is commutative even if both devices deleted independently", () => {
  const make = (revision: string, time: string): SyncEntry => ({
    kind: "recipes",
    id: "a",
    data: null,
    deleted: true,
    time,
    revision,
    clock: { [revision]: 1 },
  });
  const a: Snapshot = { version: 1, entries: [make("a", time)] };
  const b: Snapshot = { version: 1, entries: [make("b", later)] };
  expect(canonical(mergeSnapshots(a, b))).toBe(canonical(mergeSnapshots(b, a)));
});
