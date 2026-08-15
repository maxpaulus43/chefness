/**
 * AI preference repository — the single source of truth for AI preference persistence.
 *
 * Currently backed by `IndexedDBRepository`. To migrate to a real
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
import { IndexedDBRepository } from "@/storage/indexed-db";
import { FirestoreRepository } from "@/storage/firestore";
import { ScopedRepository } from "@/storage/scoped-repository";
import { generateUUID } from "@/lib/uuid";

/** Concrete type alias so consumers don't need to spell out the generics. */
export type AiPreferenceRepository = StorageRepository<
  AiPreference,
  CreateAiPreferenceInput,
  UpdateAiPreferenceInput
>;

function buildAiPreference(data: CreateAiPreferenceInput): AiPreference {
  const now = new Date().toISOString();
  return { id: generateUUID(), ...data, createdAt: now, updatedAt: now };
}

function applyAiPreferenceUpdate(
  existing: AiPreference,
  data: UpdateAiPreferenceInput,
): AiPreference {
  const { id: _, ...patch } = data;
  return {
    ...existing,
    ...(patch.text !== undefined && { text: patch.text }),
    updatedAt: new Date().toISOString(),
  };
}

const guestRepository = new IndexedDBRepository<
  AiPreference,
  CreateAiPreferenceInput,
  UpdateAiPreferenceInput
>({
  storeName: "ai-preferences",
  buildEntity: buildAiPreference,
  applyUpdate: applyAiPreferenceUpdate,
});

const cloudRepository = new FirestoreRepository<
  AiPreference,
  CreateAiPreferenceInput,
  UpdateAiPreferenceInput
>({
  collectionName: "aiPreferences",
  buildEntity: buildAiPreference,
  applyUpdate: applyAiPreferenceUpdate,
});

export const aiPreferenceRepository: AiPreferenceRepository = new ScopedRepository(
  guestRepository,
  cloudRepository,
);
