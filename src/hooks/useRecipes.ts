/**
 * Custom hook that encapsulates all recipe-related data operations.
 *
 * Components consume this hook for recipe data and actions.
 * They never import `trpc` directly or manage cache invalidation —
 * all of that lives here.
 */
import { trpc } from "@/trpc/client";
import { useRecipeAccess } from "@/hooks/useRecipeAccess";
import { canSaveRecipe, RecipeLimitError } from "@/lib/recipe-access";
import type { CreateRecipeInput, UpdateRecipeInput } from "@/types/recipe";

export function useRecipes() {
  const utils = trpc.useUtils();
  const access = useRecipeAccess();

  const listQuery = trpc.recipe.list.useQuery();
  const recipeCount = listQuery.data?.length ?? 0;
  const canCreateRecipe = canSaveRecipe(
    recipeCount,
    access.hasUnlimitedRecipes,
  );
  const assertCanCreateRecipe = () => {
    if (!canCreateRecipe) throw new RecipeLimitError();
  };

  const createMutation = trpc.recipe.create.useMutation({
    onSuccess: () => {
      void utils.recipe.list.invalidate();
    },
    onError: (error) => {
      console.error("Failed to create recipe:", error.message);
    },
  });

  const updateMutation = trpc.recipe.update.useMutation({
    onSuccess: () => {
      void utils.recipe.list.invalidate();
    },
  });

  const deleteMutation = trpc.recipe.delete.useMutation({
    onSuccess: () => {
      void utils.recipe.list.invalidate();
    },
  });

  return {
    /** The list of all recipes (empty array while loading). */
    recipes: listQuery.data ?? [],

    /** `true` while the initial recipe list is being fetched. */
    isLoading: listQuery.isLoading,

    /** Non-null when the list query has errored. */
    error: listQuery.error ?? null,

    /** Whether another recipe can be saved under the current entitlement. */
    canCreateRecipe,

    /** Create a new recipe. */
    createRecipe: (data: CreateRecipeInput) => {
      assertCanCreateRecipe();
      createMutation.mutate(data);
    },

    /** Create a new recipe (async — resolves when the mutation completes). */
    createRecipeAsync: (data: CreateRecipeInput) => {
      assertCanCreateRecipe();
      return createMutation.mutateAsync(data);
    },

    /** `true` while a create is in flight. */
    isCreating: createMutation.isPending,

    /** Update an existing recipe. */
    updateRecipe: (data: UpdateRecipeInput) => updateMutation.mutate(data),

    /** Update an existing recipe (async — resolves when the mutation completes). */
    updateRecipeAsync: (data: UpdateRecipeInput) =>
      updateMutation.mutateAsync(data),

    /** `true` while an update is in flight. */
    isUpdating: updateMutation.isPending,

    /** Delete a recipe by ID. */
    deleteRecipe: (id: string) => deleteMutation.mutate({ id }),

    /** `true` while a delete is in flight. */
    isDeleting: deleteMutation.isPending,
  } as const;
}
