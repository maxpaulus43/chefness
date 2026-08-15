/**
 * Cooking log repository — the single source of truth for cooking log persistence.
 *
 * Currently backed by `IndexedDBRepository`. To migrate to a real
 * backend, replace the implementation here (e.g. instantiate an
 * `HttpCookingLogRepository`) and re-export it. The rest of the app —
 * including every tRPC procedure — stays untouched because it only
 * depends on the `StorageRepository` interface.
 */
import type { StorageRepository } from "@/storage/interface";
import type {
  CookingLogEntry,
  CreateCookingLogInput,
  UpdateCookingLogInput,
} from "@/types/cooking-log";
import { IndexedDBRepository } from "@/storage/indexed-db";
import { FirestoreRepository } from "@/storage/firestore";
import { ScopedRepository } from "@/storage/scoped-repository";
import { generateUUID } from "@/lib/uuid";

/** Concrete type alias so consumers don't need to spell out the generics. */
export type CookingLogRepository = StorageRepository<
  CookingLogEntry,
  CreateCookingLogInput,
  UpdateCookingLogInput
>;

function buildCookingLog(data: CreateCookingLogInput): CookingLogEntry {
  const now = new Date().toISOString();
  return { id: generateUUID(), ...data, createdAt: now, updatedAt: now };
}

function applyCookingLogUpdate(
  existing: CookingLogEntry,
  data: UpdateCookingLogInput,
): CookingLogEntry {
  const { id: _, ...patch } = data;
  return {
    ...existing,
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.date !== undefined && { date: patch.date }),
    ...(patch.rating !== undefined && { rating: patch.rating }),
    ...(patch.comment !== undefined && { comment: patch.comment }),
    ...(patch.recipeId !== undefined && { recipeId: patch.recipeId }),
    updatedAt: new Date().toISOString(),
  };
}

const guestRepository = new IndexedDBRepository<
  CookingLogEntry,
  CreateCookingLogInput,
  UpdateCookingLogInput
>({
  storeName: "cooking-log",
  buildEntity: buildCookingLog,
  applyUpdate: applyCookingLogUpdate,
});

const cloudRepository = new FirestoreRepository<
  CookingLogEntry,
  CreateCookingLogInput,
  UpdateCookingLogInput
>({
  collectionName: "cookingLog",
  buildEntity: buildCookingLog,
  applyUpdate: applyCookingLogUpdate,
});

export const cookingLogRepository: CookingLogRepository = new ScopedRepository(
  guestRepository,
  cloudRepository,
);
