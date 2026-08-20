import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { IndexedDBRepository } from "@/storage/indexed-db";
import type { StorageRepository } from "@/storage/interface";
import type { CreateSettingsInput, Settings, UpdateSettingsInput } from "@/types/settings";

export type SettingsRepository = StorageRepository<
  Settings,
  CreateSettingsInput,
  UpdateSettingsInput
>;

export const SETTINGS_SINGLETON_ID = "user-settings";

const ASYNC_STORAGE_KEY = "chefness:settings";
const MIGRATION_MARKER_KEY = "chefness:openrouter-keychain-migrated";
const SECURE_STORE_KEY = "chefness.openrouter-oauth-key";
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const settingsStorage = new IndexedDBRepository<
  Settings,
  CreateSettingsInput,
  UpdateSettingsInput
>({
  storeName: "settings",
  buildEntity: (data) => {
    const now = new Date().toISOString();
    return {
      id: SETTINGS_SINGLETON_ID,
      ...data,
      openRouterOAuthKey: "",
      createdAt: now,
      updatedAt: now,
    };
  },
  applyUpdate: (existing, data) => ({
    ...existing,
    ...(data.llmProvider !== undefined && { llmProvider: data.llmProvider }),
    ...(data.llmModel !== undefined && { llmModel: data.llmModel }),
    ...(data.llmApiKey !== undefined && { llmApiKey: data.llmApiKey }),
    ...(data.dietaryRestrictions !== undefined && {
      dietaryRestrictions: data.dietaryRestrictions,
    }),
    ...(data.otherDietaryNotes !== undefined && {
      otherDietaryNotes: data.otherDietaryNotes,
    }),
    openRouterOAuthKey: "",
    updatedAt: new Date().toISOString(),
  }),
});

let migrationPromise: Promise<void> | undefined;

/** Move a legacy plaintext OAuth key to Keychain, then scrub it from AsyncStorage. */
async function migrateLegacyCredential(): Promise<void> {
  if (await AsyncStorage.getItem(MIGRATION_MARKER_KEY)) return;

  const serialized = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
  if (serialized) {
    const parsed: unknown = JSON.parse(serialized);
    if (Array.isArray(parsed)) {
      let legacyKey = "";
      const scrubbed = parsed.map((value: unknown) => {
        if (typeof value !== "object" || value === null || !("openRouterOAuthKey" in value)) {
          return value;
        }
        const record = value as Record<string, unknown>;
        if (!legacyKey && typeof record.openRouterOAuthKey === "string") {
          legacyKey = record.openRouterOAuthKey;
        }
        const { openRouterOAuthKey: _, ...nonSecretSettings } = record;
        return nonSecretSettings;
      });

      if (legacyKey && !(await SecureStore.getItemAsync(SECURE_STORE_KEY))) {
        await SecureStore.setItemAsync(SECURE_STORE_KEY, legacyKey, SECURE_STORE_OPTIONS);
      }
      await AsyncStorage.setItem(ASYNC_STORAGE_KEY, JSON.stringify(scrubbed));
    }
  }

  await AsyncStorage.setItem(MIGRATION_MARKER_KEY, "1");
}

function ensureMigrated(): Promise<void> {
  migrationPromise ??= migrateLegacyCredential().catch((error: unknown) => {
    migrationPromise = undefined;
    throw error;
  });
  return migrationPromise;
}

async function secureCredential(): Promise<string> {
  await ensureMigrated();
  return (await SecureStore.getItemAsync(SECURE_STORE_KEY)) ?? "";
}

async function withCredential(settings: Settings): Promise<Settings> {
  return { ...settings, openRouterOAuthKey: await secureCredential() };
}

export const settingsRepository: SettingsRepository = {
  async getAll() {
    await ensureMigrated();
    return Promise.all((await settingsStorage.getAll()).map(withCredential));
  },

  async getById(id) {
    await ensureMigrated();
    const settings = await settingsStorage.getById(id);
    return settings ? withCredential(settings) : undefined;
  },

  async create(data) {
    await ensureMigrated();
    if (data.openRouterOAuthKey) {
      await SecureStore.setItemAsync(
        SECURE_STORE_KEY,
        data.openRouterOAuthKey,
        SECURE_STORE_OPTIONS,
      );
    }
    return withCredential(await settingsStorage.create(data));
  },

  async update(data) {
    await ensureMigrated();
    if (data.openRouterOAuthKey !== undefined) {
      if (data.openRouterOAuthKey) {
        await SecureStore.setItemAsync(
          SECURE_STORE_KEY,
          data.openRouterOAuthKey,
          SECURE_STORE_OPTIONS,
        );
      } else {
        await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
      }
    }
    const updated = await settingsStorage.update(data);
    return updated ? withCredential(updated) : undefined;
  },

  async delete(id) {
    await ensureMigrated();
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    return settingsStorage.delete(id);
  },
};
