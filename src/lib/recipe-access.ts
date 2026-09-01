export const FREE_RECIPE_LIMIT = 5;
export const UNLIMITED_RECIPES_PRODUCT_ID =
  "com.maxpaulus.chefness.unlimited_recipes";

export function canSaveRecipe(
  recipeCount: number,
  hasUnlimitedRecipes: boolean,
) {
  return hasUnlimitedRecipes || recipeCount < FREE_RECIPE_LIMIT;
}

export const RECIPE_LIMIT_MESSAGE = `You’ve reached the ${FREE_RECIPE_LIMIT}-recipe free limit. Unlock Unlimited Recipes in Settings to save or import more.`;

export class RecipeLimitError extends Error {
  constructor() {
    super(RECIPE_LIMIT_MESSAGE);
    this.name = "RecipeLimitError";
  }
}

export interface RecipeAccess {
  hasUnlimitedRecipes: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  canPurchase: boolean;
  price: string;
  error: string | null;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
}
