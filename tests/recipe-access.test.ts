import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ICLOUD_SYNC_PRODUCT_ID } from "../src/lib/cloud-access";

test("the existing one-time product unlocks sync, with no recipe-count gate", () => {
  expect(ICLOUD_SYNC_PRODUCT_ID).toBe(
    "com.maxpaulus.chefness.unlimited_recipes",
  );
  for (const path of [
    "src/hooks/useRecipes.ts",
    "src/hooks/useChat.ts",
    "src/native/ChatScreen.tsx",
  ])
    expect(readFileSync(path, "utf8")).not.toMatch(
      /canCreateRecipe|RecipeLimit|FREE_RECIPE_LIMIT|useRecipeAccess/,
    );
  const product = JSON.parse(readFileSync("storekit/Chefness.storekit", "utf8"))
    .products[0];
  expect(product.productID).toBe(ICLOUD_SYNC_PRODUCT_ID);
  expect(product.type).toBe("NonConsumable");
  expect(product.familyShareable).toBe(true);
});
