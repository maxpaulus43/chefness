/**
 * Custom hook that encapsulates all AI-preference-related data operations.
 *
 * Components consume this hook for AI preference data and actions.
 * They never import `trpc` directly or manage cache invalidation —
 * all of that lives here.
 */
import { useMemo } from "react";
import { trpc } from "@/trpc/client";
import type {
  CreateAiPreferenceInput,
  UpdateAiPreferenceInput,
} from "@/types/ai-preference";

export function useAiPreferences() {
  const utils = trpc.useUtils();

  const listQuery = trpc.aiPreference.list.useQuery();

  const createMutation = trpc.aiPreference.create.useMutation({
    onSuccess: () => {
      void utils.aiPreference.list.invalidate();
    },
    onError: (error) => {
      console.error("Failed to create AI preference:", error.message);
    },
  });

  const updateMutation = trpc.aiPreference.update.useMutation({
    onSuccess: () => {
      void utils.aiPreference.list.invalidate();
    },
  });

  const deleteMutation = trpc.aiPreference.delete.useMutation({
    onSuccess: () => {
      void utils.aiPreference.list.invalidate();
    },
  });

  /** All preferences sorted by createdAt descending. */
  const preferences = useMemo(() => {
    const raw = listQuery.data ?? [];
    return [...raw].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [listQuery.data]);

  return {
    /** The list of all AI preferences (sorted by createdAt desc). */
    preferences,

    /** `true` while the initial preference list is being fetched. */
    isLoading: listQuery.isLoading,

    /** Non-null when the list query has errored. */
    error: listQuery.error ?? null,

    /** Create a new AI preference. */
    createPreference: (data: CreateAiPreferenceInput) =>
      createMutation.mutate(data),

    /** Create a new AI preference (async — resolves when the mutation completes). */
    createPreferenceAsync: (data: CreateAiPreferenceInput) =>
      createMutation.mutateAsync(data),

    /** `true` while a create is in flight. */
    isCreating: createMutation.isPending,

    /** Update an existing AI preference. */
    updatePreference: (data: UpdateAiPreferenceInput) =>
      updateMutation.mutate(data),

    /** Update an existing AI preference (async — resolves when the mutation completes). */
    updatePreferenceAsync: (data: UpdateAiPreferenceInput) =>
      updateMutation.mutateAsync(data),

    /** `true` while an update is in flight. */
    isUpdating: updateMutation.isPending,

    /** Delete an AI preference by ID. */
    deletePreference: (id: string) => deleteMutation.mutate({ id }),

    /** `true` while a delete is in flight. */
    isDeleting: deleteMutation.isPending,
  } as const;
}
