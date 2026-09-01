import type { RecipeAccess } from "@/lib/recipe-access";

const webRecipeAccess: RecipeAccess = {
  hasUnlimitedRecipes: true,
  isLoading: false,
  isPurchasing: false,
  canPurchase: false,
  price: "",
  error: null,
  purchase: async () => {},
  restore: async () => {},
};

export function useRecipeAccess() {
  return webRecipeAccess;
}
