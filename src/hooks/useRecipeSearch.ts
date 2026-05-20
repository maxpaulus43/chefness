import { useMemo, useState } from "react";

import type { Recipe } from "@/types/recipe";

export type RecipeSortOption = "newest" | "oldest" | "title-asc" | "title-desc";

export function useRecipeSearch(recipes: Recipe[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<RecipeSortOption>("newest");

  const visibleRecipes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredRecipes = normalizedQuery
      ? recipes.filter((recipe) => recipeMatchesSearch(recipe, normalizedQuery))
      : recipes;

    return [...filteredRecipes].sort((a, b) =>
      sortRecipes(a, b, sortOption),
    );
  }, [recipes, searchQuery, sortOption]);

  return {
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    visibleRecipes,
  } as const;
}

function recipeMatchesSearch(recipe: Recipe, normalizedQuery: string): boolean {
  const searchableText = [recipe.title, recipe.description, ...recipe.ingredients]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedQuery);
}

function sortRecipes(
  a: Recipe,
  b: Recipe,
  sortOption: RecipeSortOption,
): number {
  switch (sortOption) {
    case "oldest":
      return a.createdAt.localeCompare(b.createdAt);
    case "title-asc":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    case "title-desc":
      return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
    case "newest":
    default:
      return b.createdAt.localeCompare(a.createdAt);
  }
}
