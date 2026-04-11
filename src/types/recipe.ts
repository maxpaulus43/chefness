import { z } from "zod";

/** Zod schema for a stored recipe. */
export const recipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** TypeScript type inferred from the Zod schema. */
export type Recipe = z.infer<typeof recipeSchema>;

/** Input schema for creating a new recipe (id & timestamps are generated server-side). */
export const createRecipeInput = z.object({
  title: z.string().min(1),
  description: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
});
export type CreateRecipeInput = z.infer<typeof createRecipeInput>;

/** Input schema for updating an existing recipe. */
export const updateRecipeInput = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  ingredients: z.array(z.string()).optional(),
  steps: z.array(z.string()).optional(),
});
export type UpdateRecipeInput = z.infer<typeof updateRecipeInput>;
