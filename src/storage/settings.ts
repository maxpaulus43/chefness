/**
 * Settings repository — the single source of truth for settings persistence.
 *
 * Currently backed by `LocalStorageRepository`. To migrate to a real
 * backend, replace the implementation here (e.g. instantiate an
 * `HttpSettingsRepository`) and re-export it. The rest of the app —
 * including every tRPC procedure — stays untouched because it only
 * depends on the `StorageRepository` interface.
 */
import type { StorageRepository } from "@/storage/interface";
import type { Settings, CreateSettingsInput, UpdateSettingsInput } from "@/types/settings";
import { LocalStorageRepository } from "@/storage/local-storage";

/** Concrete type alias so consumers don't need to spell out the generics. */
export type SettingsRepository = StorageRepository<
  Settings,
  CreateSettingsInput,
  UpdateSettingsInput
>;

/** Fixed singleton ID — there is only ever one settings entity. */
export const SETTINGS_SINGLETON_ID = "user-settings";

export const settingsRepository: SettingsRepository = new LocalStorageRepository<
  Settings,
  CreateSettingsInput,
  UpdateSettingsInput
>({
  storageKey: "chefness:settings",

  buildEntity: (data) => {
    const now = new Date().toISOString();
    return {
      id: SETTINGS_SINGLETON_ID,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
  },

  applyUpdate: (existing, data) => {
    const { id: _, ...patch } = data;
    return {
      ...existing,
      ...(patch.llmProvider !== undefined && { llmProvider: patch.llmProvider }),
      ...(patch.llmModel !== undefined && { llmModel: patch.llmModel }),
      ...(patch.llmApiKey !== undefined && { llmApiKey: patch.llmApiKey }),
      ...(patch.dietaryRestrictions !== undefined && { dietaryRestrictions: patch.dietaryRestrictions }),
      ...(patch.otherDietaryNotes !== undefined && { otherDietaryNotes: patch.otherDietaryNotes }),
      updatedAt: new Date().toISOString(),
    };
  },
});
