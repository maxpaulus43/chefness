import { expect, test } from "bun:test";
import {
  canSaveRecipe,
  FREE_RECIPE_LIMIT,
  RecipeLimitError,
} from "../src/lib/recipe-access";

test("free users stop at the configurable recipe limit", () => {
  expect(canSaveRecipe(FREE_RECIPE_LIMIT - 1, false)).toBe(true);
  expect(canSaveRecipe(FREE_RECIPE_LIMIT, false)).toBe(false);
  expect(canSaveRecipe(FREE_RECIPE_LIMIT, true)).toBe(true);
  expect(new RecipeLimitError().message).toContain(`${FREE_RECIPE_LIMIT}`);
});
