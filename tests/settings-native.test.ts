import { beforeAll, expect, mock, test } from "bun:test";

const asyncValues = new Map<string, string>();
const secureValues = new Map<string, string>();

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => asyncValues.get(key) ?? null,
    setItem: async (key: string, value: string) => { asyncValues.set(key, value); },
  },
}));

mock.module("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (key: string) => secureValues.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { secureValues.set(key, value); },
  deleteItemAsync: async (key: string) => { secureValues.delete(key); },
}));

mock.module("@/storage/indexed-db", () => ({
  IndexedDBRepository: class<TEntity extends { id: string }, TCreate, TUpdate extends { id: string }> {
    private readonly key: string;
    private readonly buildEntity: (data: TCreate) => TEntity;
    private readonly applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;

    constructor(options: {
      storeName: string;
      buildEntity: (data: TCreate) => TEntity;
      applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;
    }) {
      this.key = `chefness:${options.storeName}`;
      this.buildEntity = options.buildEntity;
      this.applyUpdate = options.applyUpdate;
    }

    private read(): TEntity[] {
      return JSON.parse(asyncValues.get(this.key) ?? "[]") as TEntity[];
    }

    private write(values: TEntity[]): void {
      asyncValues.set(this.key, JSON.stringify(values));
    }

    async getAll() { return this.read(); }
    async getById(id: string) { return this.read().find((value) => value.id === id); }
    async create(data: TCreate) {
      const entity = this.buildEntity(data);
      this.write([entity]);
      return entity;
    }
    async update(data: TUpdate) {
      const values = this.read();
      const index = values.findIndex((value) => value.id === data.id);
      if (index < 0) return undefined;
      const existing = values[index];
      if (!existing) return undefined;
      const updated = this.applyUpdate(existing, data);
      values[index] = updated;
      this.write(values);
      return updated;
    }
    async delete(id: string) {
      const values = this.read();
      const next = values.filter((value) => value.id !== id);
      this.write(next);
      return next.length !== values.length;
    }
  },
}));

let settingsRepository: typeof import("../src/storage/settings.native").settingsRepository;

beforeAll(async () => {
  asyncValues.set("chefness:settings", JSON.stringify([{
    id: "user-settings",
    llmModel: "openrouter/free",
    openRouterOAuthKey: "legacy-secret",
    dietaryRestrictions: [],
    otherDietaryNotes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }]));
  ({ settingsRepository } = await import("../src/storage/settings.native"));
});

test("migrates, persists, and removes OpenRouter credentials securely", async () => {
  const migrated = await settingsRepository.getById("user-settings");
  expect(migrated?.openRouterOAuthKey).toBe("legacy-secret");
  expect(secureValues.get("chefness.openrouter-oauth-key")).toBe("legacy-secret");
  expect(asyncValues.get("chefness:settings")).not.toContain("legacy-secret");
  expect(asyncValues.get("chefness:settings")).not.toContain("openRouterOAuthKey");

  const connected = await settingsRepository.update({
    id: "user-settings",
    openRouterOAuthKey: "new-secret",
  });
  expect(connected?.openRouterOAuthKey).toBe("new-secret");
  expect(secureValues.get("chefness.openrouter-oauth-key")).toBe("new-secret");
  expect(asyncValues.get("chefness:settings")).not.toContain("new-secret");

  const modelUpdate = await settingsRepository.update({
    id: "user-settings",
    llmModel: "test/model",
  });
  expect(modelUpdate?.llmModel).toBe("test/model");
  expect(modelUpdate?.openRouterOAuthKey).toBe("new-secret");
  expect(asyncValues.get("chefness:settings")).not.toContain("new-secret");

  const disconnected = await settingsRepository.update({
    id: "user-settings",
    openRouterOAuthKey: "",
  });
  expect(disconnected?.openRouterOAuthKey).toBe("");
  expect(secureValues.has("chefness.openrouter-oauth-key")).toBe(false);
});
