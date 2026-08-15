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
import { FirestoreRepository } from "@/storage/firestore";
import { ScopedRepository } from "@/storage/scoped-repository";
import { generateUUID } from "@/lib/uuid";

const MAX_FIRESTORE_SESSION_BYTES = 900_000;

/** Concrete type alias so consumers don't need to spell out the generics. */
export type ChatSessionRepository = StorageRepository<
  ChatSession,
  CreateChatSessionInput,
  UpdateChatSessionInput
>;

function buildChatSession(data: CreateChatSessionInput): ChatSession {
  const now = new Date().toISOString();
  return {
    id: generateUUID(),
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive: Zod defaults may not have been applied yet
    title: data.title ?? "New conversation",
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive: Zod defaults may not have been applied yet
    messages: data.messages ?? [],
    mealType: data.mealType ?? null,
    mealSize: data.mealSize ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function applyChatSessionUpdate(
  existing: ChatSession,
  data: UpdateChatSessionInput,
): ChatSession {
  const { id: _, ...patch } = data;
  return {
    ...existing,
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.messages !== undefined && { messages: patch.messages }),
    ...(patch.mealType !== undefined && { mealType: patch.mealType }),
    ...(patch.mealSize !== undefined && { mealSize: patch.mealSize }),
    updatedAt: new Date().toISOString(),
  };
}

function validateCloudSession(session: ChatSession): void {
  const bytes = new TextEncoder().encode(JSON.stringify(session)).byteLength;
  if (bytes > MAX_FIRESTORE_SESSION_BYTES) {
    throw new Error("This conversation is too large to sync. Start a new chat to keep saving messages.");
  }
}

const guestRepository = new IndexedDBRepository<
  ChatSession,
  CreateChatSessionInput,
  UpdateChatSessionInput
>({
  storeName: "chat-sessions",
  buildEntity: buildChatSession,
  applyUpdate: applyChatSessionUpdate,
});

const cloudRepository = new FirestoreRepository<
  ChatSession,
  CreateChatSessionInput,
  UpdateChatSessionInput
>({
  collectionName: "chatSessions",
  buildEntity: buildChatSession,
  applyUpdate: applyChatSessionUpdate,
  validateEntity: validateCloudSession,
});

export const chatSessionRepository: ChatSessionRepository = new ScopedRepository(
  guestRepository,
  cloudRepository,
);
