/**
 * Chat session repository — the single source of truth for chat session persistence.
 *
 * Currently backed by `IndexedDBRepository`. To migrate to a real
 * backend, replace the implementation here (e.g. instantiate an
 * `HttpChatSessionRepository`) and re-export it. The rest of the app —
 * including every tRPC procedure — stays untouched because it only
 * depends on the `StorageRepository` interface.
 */
import type { StorageRepository } from "@/storage/interface";
import type {
  ChatSession,
  CreateChatSessionInput,
  UpdateChatSessionInput,
} from "@/types/chat-session";
import { IndexedDBRepository } from "@/storage/indexed-db";
import { generateUUID } from "@/lib/uuid";

/** Concrete type alias so consumers don't need to spell out the generics. */
export type ChatSessionRepository = StorageRepository<
  ChatSession,
  CreateChatSessionInput,
  UpdateChatSessionInput
>;

export const chatSessionRepository: ChatSessionRepository =
  new IndexedDBRepository<
    ChatSession,
    CreateChatSessionInput,
    UpdateChatSessionInput
  >({
    storeName: "chat-sessions",

    buildEntity: (data) => {
      const now = new Date().toISOString();
      return {
        id: generateUUID(),
        title: data.title ?? "New conversation",
        messages: data.messages ?? [],
        mealType: data.mealType ?? null,
        mealSize: data.mealSize ?? null,
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
        ...(patch.messages !== undefined && { messages: patch.messages }),
        ...(patch.mealType !== undefined && { mealType: patch.mealType }),
        ...(patch.mealSize !== undefined && { mealSize: patch.mealSize }),
        updatedAt: new Date().toISOString(),
      };
    },
  });
