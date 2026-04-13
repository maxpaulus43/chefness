/**
 * AI preference repository — the single source of truth for AI preference persistence.
 *
 * Currently backed by `LocalStorageRepository`. To migrate to a real
 * backend, replace the implementation here (e.g. instantiate an
 * `HttpAiPreferenceRepository`) and re-export it. The rest of the app —
 * including every tRPC procedure — stays untouched because it only
 * depends on the `StorageRepository` interface.
 */
import type { StorageRepository } from "@/storage/interface";
import type {
  AiPreference,
  CreateAiPreferenceInput,
  UpdateAiPreferenceInput,
} from "@/types/ai-preference";
import { LocalStorageRepository } from "@/storage/local-storage";
import { generateUUID } from "@/lib/uuid";

/** Concrete type alias so consumers don't need to spell out the generics. */
export type AiPreferenceRepository = StorageRepository<
  AiPreference,
  CreateAiPreferenceInput,
  UpdateAiPreferenceInput
>;

export const aiPreferenceRepository: AiPreferenceRepository =
  new LocalStorageRepository<
    AiPreference,
    CreateAiPreferenceInput,
    UpdateAiPreferenceInput
  >({
    storageKey: "chefness:ai-preferences",

    buildEntity: (data) => {
      const now = new Date().toISOString();
      return {
        id: generateUUID(),
        ...data,
        createdAt: now,
        updatedAt: now,
      };
    },

    applyUpdate: (existing, data) => {
      const { id: _, ...patch } = data;
      return {
        ...existing,
        // Only overwrite fields that were explicitly provided
        ...(patch.text !== undefined && { text: patch.text }),
        updatedAt: new Date().toISOString(),
      };
    },
  });
