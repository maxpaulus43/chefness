import * as SecureStore from "expo-secure-store";
import {
  ensureMigrated,
  SECURE_STORE_KEY,
  SECURE_STORE_OPTIONS,
} from "@/storage/native-credential";
import { IndexedDBRepository } from "@/storage/indexed-db";
import type { StorageRepository } from "@/storage/interface";
import type {
  CreateSettingsInput,
  Settings,
  UpdateSettingsInput,
} from "@/types/settings";

export type SettingsRepository = StorageRepository<
  Settings,
  CreateSettingsInput,
  UpdateSettingsInput
>;

export const SETTINGS_SINGLETON_ID = "user-settings";

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
    ...(data.modelFilterFreeOnly !== undefined && {
      modelFilterFreeOnly: data.modelFilterFreeOnly,
    }),
    ...(data.modelFilterVisionOnly !== undefined && {
      modelFilterVisionOnly: data.modelFilterVisionOnly,
    }),
    ...(data.modelFilterToolsOnly !== undefined && {
      modelFilterToolsOnly: data.modelFilterToolsOnly,
    }),
    ...(data.hasCompletedOnboarding !== undefined && {
      hasCompletedOnboarding: data.hasCompletedOnboarding,
    }),
    openRouterOAuthKey: "",
    updatedAt: new Date().toISOString(),
  }),
});

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
