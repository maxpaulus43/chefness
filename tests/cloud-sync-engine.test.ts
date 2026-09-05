import { beforeAll, expect, mock, test } from "bun:test";
import { recipeSchema, type Recipe } from "../src/types/recipe";
import { chatSessionSchema, type ChatSession } from "../src/types/chat-session";
import type { StorageRepository } from "../src/storage/interface";

// ---------------------------------------------------------------------------
// Fakes: AsyncStorage, react-native AppState, chat image files, CloudKit
// ---------------------------------------------------------------------------

const asyncValues = new Map<string, string>();
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => asyncValues.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      asyncValues.set(key, value);
    },
  },
}));

mock.module("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove() {} }),
  },
}));

const IMAGE_DIR = "file:///device-a/Documents/chefness-chat-images/";
const localImages = new Map<string, string>();
mock.module("@/lib/chat-image-storage.native", () => ({
  chatImageDirectoryUri: () => IMAGE_DIR,
  chatImageFileUri: (name: string) => `${IMAGE_DIR}${name}`,
  chatImageExists: (name: string) => localImages.has(name),
  importChatImage: async (source: string, name: string) => {
    localImages.set(name, source);
  },
}));

interface FakeRecord {
  recordType: string;
  recordName: string;
  zoneName: string;
  fields: Record<string, { type: string; value: unknown }>;
  version: number;
}

const cloud = new Map<string, FakeRecord>();
const cloudDeletions: { recordName: string; version: number }[] = [];
let cloudVersion = 0;
let fetchToken = 0;
let accountStatus = "available";
const savedBatches: FakeRecord[][] = [];
const deletedNames: string[] = [];

class FakeCloudKitError extends Error {
  code: string;
  recoverySuggestion: string | undefined;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Simulate another device writing a record straight into iCloud. */
function remoteWrite(
  recordType: string,
  recordName: string,
  fields: FakeRecord["fields"],
) {
  cloudVersion += 1;
  cloud.set(recordName, {
    recordType,
    recordName,
    zoneName: "ChefnessData",
    fields,
    version: cloudVersion,
  });
}

function payloadOf(recordName: string): unknown {
  const record = cloud.get(recordName);
  if (!record) return undefined;
  return JSON.parse(record.fields.payload?.value as string);
}

mock.module("expo-cloudkit/build/errors", () => ({
  CloudKitError: FakeCloudKitError,
  CloudKitErrorCode: {
    NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
    NETWORK_UNAVAILABLE: "NETWORK_UNAVAILABLE",
    QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
    RATE_LIMITED: "RATE_LIMITED",
    ASSET_TOO_LARGE: "ASSET_TOO_LARGE",
  },
}));

mock.module("expo-cloudkit/build/ExpoCloudKit", () => ({
  isNativeModuleAvailable: () => true,
  configure: () => {},
  getAccountStatus: async () => accountStatus,
  addAccountStatusListener: () => ({ remove() {} }),
  createZone: async () => ({ zoneName: "ChefnessData" }),
  setZoneChangeToken: () => {
    fetchToken = 0;
  },
  saveRecords: async (records: Omit<FakeRecord, "version">[]) => {
    const saved: FakeRecord[] = [];
    for (const record of records) {
      cloudVersion += 1;
      const stored = { ...record, version: cloudVersion };
      cloud.set(record.recordName, stored);
      saved.push(stored);
    }
    savedBatches.push(saved);
    return saved;
  },
  deleteRecords: async (ids: { recordName: string }[]) => {
    for (const { recordName } of ids) {
      cloudVersion += 1;
      cloud.delete(recordName);
      cloudDeletions.push({ recordName, version: cloudVersion });
      deletedNames.push(recordName);
    }
  },
  fetchAllZoneChanges: async () => {
    const changedRecords = [...cloud.values()].filter(
      (record) => record.version > fetchToken,
    );
    const deletedRecordNames = cloudDeletions
      .filter((entry) => entry.version > fetchToken)
      .map((entry) => entry.recordName);
    fetchToken = cloudVersion;
    return {
      changedRecords,
      deletedRecordNames,
      syncToken: String(fetchToken),
      moreComing: false,
    };
  },
}));

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

type Engine = typeof import("../src/lib/cloud-sync/engine.native");
type Synced = typeof import("../src/storage/synced.native");
type Store = typeof import("../src/storage/indexed-db.native");

let engine: Engine;
let recipes: StorageRepository<
  Recipe,
  Omit<Recipe, "id" | "createdAt" | "updatedAt">,
  { id: string; title?: string }
>;
let sessions: StorageRepository<
  ChatSession,
  Pick<ChatSession, "title" | "messages">,
  { id: string; title?: string }
>;

const now = () => new Date().toISOString();

beforeAll(async () => {
  engine = await import("../src/lib/cloud-sync/engine.native");
  mock.module("@/lib/cloud-sync/engine", () => engine);
  const { withSync }: Synced = await import("../src/storage/synced.native");
  const { IndexedDBRepository }: Store = await import(
    "../src/storage/indexed-db.native"
  );

  recipes = withSync(
    new IndexedDBRepository<
      Recipe,
      Omit<Recipe, "id" | "createdAt" | "updatedAt">,
      { id: string; title?: string }
    >({
      storeName: "recipes",
      buildEntity: (data) => ({
        id: `r${Math.random().toString(36).slice(2, 8)}`,
        ...data,
        createdAt: now(),
        updatedAt: now(),
      }),
      applyUpdate: (existing, data) => ({
        ...existing,
        ...(data.title !== undefined && { title: data.title }),
        updatedAt: now(),
      }),
    }),
    {
      storeName: "recipes",
      recordType: "Recipe",
      parse: (value) => recipeSchema.safeParse(value).data ?? null,
    },
  );

  sessions = withSync(
    new IndexedDBRepository<
      ChatSession,
      Pick<ChatSession, "title" | "messages">,
      { id: string; title?: string }
    >({
      storeName: "chat-sessions",
      buildEntity: (data) => ({
        id: `s${Math.random().toString(36).slice(2, 8)}`,
        mealType: null,
        mealSize: null,
        ...data,
        createdAt: now(),
        updatedAt: now(),
      }),
      applyUpdate: (existing, data) => ({
        ...existing,
        ...(data.title !== undefined && { title: data.title }),
        updatedAt: now(),
      }),
    }),
    {
      storeName: "chat-sessions",
      recordType: "ChatSession",
      parse: (value) => chatSessionSchema.safeParse(value).data ?? null,
    },
  );
});

const message = (imageDataUrl: string) => ({
  role: "user" as const,
  content: "look",
  modelId: "",
  imageDataUrl,
  timestamp: now(),
  importedRecipeContext: "",
  savedRecipeId: "",
  memorySaved: false,
});

async function sync() {
  await engine.syncNow();
  // A sync requested while one was running is replayed afterwards.
  await engine.syncNow();
}

// ---------------------------------------------------------------------------
// Tests (sequential — they share the engine singleton and fake cloud)
// ---------------------------------------------------------------------------

test("enabling sync uploads existing local data, including chat photos", async () => {
  const recipe = await recipes.create({
    title: "Soup",
    description: "",
    ingredients: [],
    steps: [],
  });
  localImages.set("photo-1.jpg", "local");
  const session = await sessions.create({
    title: "Dinner",
    messages: [message(`${IMAGE_DIR}photo-1.jpg`)],
  });

  engine.setCloudSyncEntitled(true);
  await engine.setCloudSyncEnabled(true);
  await sync();

  expect(engine.getCloudSyncSnapshot().error).toBeNull();
  expect(engine.getCloudSyncSnapshot().lastSyncedAt).not.toBeNull();
  expect(payloadOf(`recipes__${recipe.id}`)).toMatchObject({ title: "Soup" });

  const image = cloud.get("chat-image__photo-1.jpg");
  expect(image?.recordType).toBe("ChatImage");
  expect(image?.fields.file).toEqual({
    type: "asset",
    value: `${IMAGE_DIR}photo-1.jpg`,
  });
  const remoteSession = payloadOf(
    `chat-sessions__${session.id}`,
  ) as ChatSession;
  expect(remoteSession.messages[0]?.imageDataUrl).toBe(
    "chefness-image://photo-1.jpg",
  );
  // Photos go up before the sessions that reference them.
  expect(savedBatches[0]?.[0]?.recordType).toBe("ChatImage");

  // Nothing left to push: a no-op sync saves nothing new.
  const batches = savedBatches.length;
  await sync();
  expect(savedBatches.length).toBe(batches);
});

test("pull merges remote edits last-write-wins and materializes photos", async () => {
  const [recipe] = await recipes.getAll();
  if (!recipe) throw new Error("expected a recipe");

  const future = new Date(Date.now() + 60_000).toISOString();
  remoteWrite("Recipe", `recipes__${recipe.id}`, {
    payload: {
      type: "string",
      value: JSON.stringify({ ...recipe, title: "Stew", updatedAt: future }),
    },
    updatedAt: { type: "date", value: future },
  });
  const remoteRecipe: Recipe = {
    id: "r-remote",
    title: "Remote",
    description: "",
    ingredients: [],
    steps: [],
    createdAt: future,
    updatedAt: future,
  };
  remoteWrite("Recipe", "recipes__r-remote", {
    payload: { type: "string", value: JSON.stringify(remoteRecipe) },
    updatedAt: { type: "date", value: future },
  });
  remoteWrite("ChatImage", "chat-image__photo-2.jpg", {
    name: { type: "string", value: "photo-2.jpg" },
    file: {
      type: "asset",
      value: { downloadURL: "file:///tmp/cloudkit/asset-2", size: 10 },
    },
  });
  const remoteSession: ChatSession = {
    id: "s-remote",
    title: "From iPad",
    mealType: null,
    mealSize: null,
    messages: [message("chefness-image://photo-2.jpg")],
    createdAt: future,
    updatedAt: future,
  };
  remoteWrite("ChatSession", "chat-sessions__s-remote", {
    payload: { type: "string", value: JSON.stringify(remoteSession) },
    updatedAt: { type: "date", value: future },
  });

  const changed: string[][] = [];
  const unsubscribe = engine.subscribeCloudSyncChanges((names) =>
    changed.push(names),
  );
  await sync();
  unsubscribe();

  const all = await recipes.getAll();
  expect(all.find((item) => item.id === recipe.id)?.title).toBe("Stew");
  expect(all.find((item) => item.id === "r-remote")?.title).toBe("Remote");
  const session = await sessions.getById("s-remote");
  expect(session?.messages[0]?.imageDataUrl).toBe(`${IMAGE_DIR}photo-2.jpg`);
  expect(localImages.get("photo-2.jpg")).toBe("file:///tmp/cloudkit/asset-2");
  expect(changed.flat()).toEqual(
    expect.arrayContaining(["recipes", "chat-sessions"]),
  );
});

test("an older remote edit does not overwrite a newer local one", async () => {
  const stale = new Date(Date.now() - 60_000).toISOString();
  const local = await recipes.update({ id: "r-remote", title: "Mine" });
  expect(local?.title).toBe("Mine");
  remoteWrite("Recipe", "recipes__r-remote", {
    payload: {
      type: "string",
      value: JSON.stringify({ ...local, title: "Theirs", updatedAt: stale }),
    },
    updatedAt: { type: "date", value: stale },
  });
  await sync();
  expect((await recipes.getById("r-remote"))?.title).toBe("Mine");
  expect(payloadOf("recipes__r-remote")).toMatchObject({ title: "Mine" });
});

test("local deletes become tombstones that hide the record and sync", async () => {
  expect(await recipes.delete("r-remote")).toBe(true);
  expect(await recipes.getById("r-remote")).toBeUndefined();
  expect(await recipes.update({ id: "r-remote", title: "x" })).toBeUndefined();
  await sync();
  const remote = payloadOf("recipes__r-remote") as Recipe;
  expect(remote.deletedAt).toBeDefined();
  expect(cloud.get("recipes__r-remote")?.fields.deletedAt).toBeDefined();
});

test("a newer remote tombstone removes the local record", async () => {
  const [recipe] = await recipes.getAll();
  if (!recipe) throw new Error("expected a recipe");
  const future = new Date(Date.now() + 120_000).toISOString();
  remoteWrite("Recipe", `recipes__${recipe.id}`, {
    payload: {
      type: "string",
      value: JSON.stringify({
        ...recipe,
        updatedAt: future,
        deletedAt: future,
      }),
    },
    updatedAt: { type: "date", value: future },
    deletedAt: { type: "date", value: future },
  });
  await sync();
  expect(await recipes.getById(recipe.id)).toBeUndefined();
});

test("expired tombstones are purged from iCloud and the device", async () => {
  const raw = JSON.parse(
    asyncValues.get("chefness:recipes") ?? "[]",
  ) as Recipe[];
  const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const expired = raw.find((item) => item.id === "r-remote");
  if (!expired) throw new Error("expected tombstone");
  expired.deletedAt = old;
  expired.updatedAt = old;
  asyncValues.set("chefness:recipes", JSON.stringify(raw));

  await sync();
  expect(deletedNames).toContain("recipes__r-remote");
  const after = JSON.parse(
    asyncValues.get("chefness:recipes") ?? "[]",
  ) as Recipe[];
  expect(after.find((item) => item.id === "r-remote")).toBeUndefined();
});

test("account problems surface as a readable status without throwing", async () => {
  accountStatus = "noAccount";
  await sync();
  expect(engine.getCloudSyncSnapshot().accountStatus).toBe("noAccount");
  expect(engine.getCloudSyncSnapshot().error).toContain("Sign in to iCloud");
  accountStatus = "available";
  await sync();
  expect(engine.getCloudSyncSnapshot().error).toBeNull();
});

test("disabling sync stops tracking and leaves local data intact", async () => {
  const before = await recipes.getAll();
  await engine.setCloudSyncEnabled(false);
  expect(engine.getCloudSyncSnapshot().isEnabled).toBe(false);
  const state = JSON.parse(asyncValues.get("chefness:cloud-sync") ?? "{}") as {
    enabled: boolean;
    dirty: Record<string, unknown>;
  };
  expect(state.enabled).toBe(false);
  expect(state.dirty).toEqual({});
  expect(await recipes.getAll()).toEqual(before);
});
