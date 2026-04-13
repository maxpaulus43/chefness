/**
 * Custom hook that encapsulates all cooking-log-related data operations.
 *
 * Components consume this hook for cooking history data and actions.
 * They never import `trpc` directly or manage cache invalidation —
 * all of that lives here.
 */
import { useMemo } from "react";
import { trpc } from "@/trpc/client";
import type {
  CreateCookingLogInput,
  UpdateCookingLogInput,
} from "@/types/cooking-log";

export function useCookingLog() {
  const utils = trpc.useUtils();

  const listQuery = trpc.cookingLog.list.useQuery();

  const createMutation = trpc.cookingLog.create.useMutation({
    onSuccess: () => {
      void utils.cookingLog.list.invalidate();
    },
    onError: (error) => {
      console.error("Failed to create cooking log entry:", error.message);
    },
  });

  const updateMutation = trpc.cookingLog.update.useMutation({
    onSuccess: () => {
      void utils.cookingLog.list.invalidate();
    },
  });

  const deleteMutation = trpc.cookingLog.delete.useMutation({
    onSuccess: () => {
      void utils.cookingLog.list.invalidate();
    },
  });

  /** All entries sorted by date descending, then createdAt descending. */
  const entries = useMemo(() => {
    const raw = listQuery.data ?? [];
    return [...raw].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [listQuery.data]);

  /** Convenience getter: entries from the last 7 days. */
  const recentEntries = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 7,
    );
    const cutoff = sevenDaysAgo.toISOString().slice(0, 10); // "YYYY-MM-DD"
    return entries.filter((entry) => entry.date >= cutoff);
  }, [entries]);

  return {
    /** The list of all cooking log entries (sorted by date desc, then createdAt desc). */
    entries,

    /** `true` while the initial entry list is being fetched. */
    isLoading: listQuery.isLoading,

    /** Non-null when the list query has errored. */
    error: listQuery.error ?? null,

    /** Create a new cooking log entry. */
    createEntry: (data: CreateCookingLogInput) => createMutation.mutate(data),

    /** Create a new cooking log entry (async — resolves when the mutation completes). */
    createEntryAsync: (data: CreateCookingLogInput) =>
      createMutation.mutateAsync(data),

    /** `true` while a create is in flight. */
    isCreating: createMutation.isPending,

    /** Update an existing cooking log entry. */
    updateEntry: (data: UpdateCookingLogInput) => updateMutation.mutate(data),

    /** Update an existing cooking log entry (async — resolves when the mutation completes). */
    updateEntryAsync: (data: UpdateCookingLogInput) =>
      updateMutation.mutateAsync(data),

    /** `true` while an update is in flight. */
    isUpdating: updateMutation.isPending,

    /** Delete a cooking log entry by ID. */
    deleteEntry: (id: string) => deleteMutation.mutate({ id }),

    /** `true` while a delete is in flight. */
    isDeleting: deleteMutation.isPending,

    /** Entries from the last 7 days (for system prompt injection). */
    recentEntries,
  } as const;
}
