/**
 * Custom hook that encapsulates all chat-session-related data operations.
 *
 * Components consume this hook for chat session data and actions.
 * They never import `trpc` directly or manage cache invalidation —
 * all of that lives here.
 */
import { useCallback, useEffect, useMemo } from "react";
import {
  deleteChatImages,
  deleteOrphanedChatImages,
} from "@/lib/chat-image-storage";
import { trpc } from "@/trpc/client";
import type {
  CreateChatSessionInput,
  UpdateChatSessionInput,
} from "@/types/chat-session";

export function useChatSessions() {
  const utils = trpc.useUtils();

  const listQuery = trpc.chatSession.list.useQuery();

  const createMutation = trpc.chatSession.create.useMutation({
    onSuccess: () => {
      void utils.chatSession.list.invalidate();
    },
    onError: (error) => {
      console.error("Failed to create chat session:", error.message);
    },
  });

  const updateMutation = trpc.chatSession.update.useMutation({
    onSuccess: () => {
      void utils.chatSession.list.invalidate();
    },
  });

  const deleteMutation = trpc.chatSession.delete.useMutation({
    onSuccess: () => {
      void utils.chatSession.list.invalidate();
    },
  });

  /** All sessions sorted by updatedAt descending (most recent first). */
  const sessions = useMemo(() => {
    const raw = listQuery.data ?? [];
    return [...raw].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [listQuery.data]);

  useEffect(() => {
    if (listQuery.isLoading) return;
    deleteOrphanedChatImages(
      sessions.flatMap((session) =>
        session.messages.map((message) => message.imageDataUrl),
      ),
    );
  }, [listQuery.isLoading, sessions]);

  const deleteSession = (id: string) => {
    const imageUris =
      sessions
        .find((session) => session.id === id)
        ?.messages.map((message) => message.imageDataUrl) ?? [];
    const imagesUsedElsewhere = new Set(
      sessions
        .filter((session) => session.id !== id)
        .flatMap((session) =>
          session.messages.map((message) => message.imageDataUrl),
        ),
    );
    const unusedImageUris = imageUris.filter(
      (uri) => !imagesUsedElsewhere.has(uri),
    );
    deleteMutation.mutate(
      { id },
      { onSuccess: () => deleteChatImages(unusedImageUris) },
    );
  };

  const deleteAllSessions = useCallback(async () => {
    for (const session of sessions) {
      await deleteMutation.mutateAsync({ id: session.id });
    }
    deleteChatImages(
      sessions.flatMap((session) =>
        session.messages.map((message) => message.imageDataUrl),
      ),
    );
  }, [deleteMutation, sessions]);

  return {
    /** The list of all chat sessions (sorted by updatedAt desc). */
    sessions,

    /** `true` while the initial session list is being fetched. */
    isLoading: listQuery.isLoading,

    /** Non-null when the list query has errored. */
    error: listQuery.error ?? null,

    /** Create a new chat session. */
    createSession: (data: CreateChatSessionInput) =>
      createMutation.mutate(data),

    /** Create a new chat session (async — resolves when the mutation completes). */
    createSessionAsync: (data: CreateChatSessionInput) =>
      createMutation.mutateAsync(data),

    /** `true` while a create is in flight. */
    isCreating: createMutation.isPending,

    /** Update an existing chat session. */
    updateSession: (data: UpdateChatSessionInput) =>
      updateMutation.mutate(data),

    /** Update an existing chat session (async — resolves when the mutation completes). */
    updateSessionAsync: (data: UpdateChatSessionInput) =>
      updateMutation.mutateAsync(data),

    /** `true` while an update is in flight. */
    isUpdating: updateMutation.isPending,

    /** Delete a chat session by ID. */
    deleteSession,

    /** Delete every chat session. */
    deleteAllSessions,

    /** `true` while a delete is in flight. */
    isDeleting: deleteMutation.isPending,
  } as const;
}
