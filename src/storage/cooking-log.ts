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
import {
  cookingLogEntrySchema,
  type CookingLogEntry,
  type CreateCookingLogInput,
  type UpdateCookingLogInput,
} from "@/types/cooking-log";
import { IndexedDBRepository } from "@/storage/indexed-db";
import { withSync } from "@/storage/synced";
import { generateUUID } from "@/lib/uuid";

/** Concrete type alias so consumers don't need to spell out the generics. */
export type CookingLogRepository = StorageRepository<
  CookingLogEntry,
  CreateCookingLogInput,
  UpdateCookingLogInput
>;

export const cookingLogRepository: CookingLogRepository = withSync(
  new IndexedDBRepository<
    CookingLogEntry,
    CreateCookingLogInput,
    UpdateCookingLogInput
  >({
    storeName: "cooking-log",

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
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.date !== undefined && { date: patch.date }),
        ...(patch.rating !== undefined && { rating: patch.rating }),
        ...(patch.comment !== undefined && { comment: patch.comment }),
        ...(patch.recipeId !== undefined && { recipeId: patch.recipeId }),
        updatedAt: new Date().toISOString(),
      };
    },
  }),
  {
    storeName: "cooking-log",
    recordType: "CookingLogEntry",
    parse: (value) => cookingLogEntrySchema.safeParse(value).data ?? null,
  },
);
