/**
 * Recipe repository — the single source of truth for recipe persistence.
 *
 * Currently backed by `IndexedDBRepository`. To migrate to a real
 * backend, replace the implementation here (e.g. instantiate an
 * `HttpRecipeRepository`) and re-export it. The rest of the app —
 * including every tRPC procedure — stays untouched because it only
 * depends on the `StorageRepository` interface.
 */
import type { StorageRepository } from "@/storage/interface";
import type { Recipe, CreateRecipeInput, UpdateRecipeInput } from "@/types/recipe";
import { IndexedDBRepository } from "@/storage/indexed-db";
import { FirestoreRepository } from "@/storage/firestore";
import { ScopedRepository } from "@/storage/scoped-repository";
import { generateUUID } from "@/lib/uuid";

/** Concrete type alias so consumers don't need to spell out the generics. */
export type RecipeRepository = StorageRepository<
  Recipe,
  CreateRecipeInput,
  UpdateRecipeInput
>;

function buildRecipe(data: CreateRecipeInput): Recipe {
  const now = new Date().toISOString();
  return { id: generateUUID(), ...data, createdAt: now, updatedAt: now };
}

function applyRecipeUpdate(existing: Recipe, data: UpdateRecipeInput): Recipe {
  const { id: _, ...patch } = data;
  return {
    ...existing,
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.ingredients !== undefined && { ingredients: patch.ingredients }),
    ...(patch.steps !== undefined && { steps: patch.steps }),
    updatedAt: new Date().toISOString(),
  };
}

const guestRepository = new IndexedDBRepository<Recipe, CreateRecipeInput, UpdateRecipeInput>({
  storeName: "recipes",
  buildEntity: buildRecipe,
  applyUpdate: applyRecipeUpdate,
});

const cloudRepository = new FirestoreRepository<Recipe, CreateRecipeInput, UpdateRecipeInput>({
  collectionName: "recipes",
  buildEntity: buildRecipe,
  applyUpdate: applyRecipeUpdate,
});

export const recipeRepository: RecipeRepository = new ScopedRepository(
  guestRepository,
  cloudRepository,
);
