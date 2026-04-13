import { z } from "zod";

/** Zod schema for a stored cooking log entry. */
export const cookingLogEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(), // ISO date string (e.g., "2026-04-12")
  rating: z.enum(["up", "down"]).nullable(), // thumbs up/down or null
  comment: z.string(), // freeform comment, empty string if none
  recipeId: z.string().nullable(), // optional link to saved recipe
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** TypeScript type inferred from the Zod schema. */
export type CookingLogEntry = z.infer<typeof cookingLogEntrySchema>;

/** Input schema for creating a new cooking log entry (id & timestamps are generated server-side). */
export const createCookingLogInput = z.object({
  title: z.string().min(1),
  date: z.string().min(1), // ISO date string
  rating: z.enum(["up", "down"]).nullable().optional().default(null),
  comment: z.string().optional().default(""),
  recipeId: z.string().nullable().optional().default(null),
});
export type CreateCookingLogInput = z.infer<typeof createCookingLogInput>;

/** Input schema for updating an existing cooking log entry. */
export const updateCookingLogInput = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  date: z.string().optional(),
  rating: z.enum(["up", "down"]).nullable().optional(),
  comment: z.string().optional(),
  recipeId: z.string().nullable().optional(),
});
export type UpdateCookingLogInput = z.infer<typeof updateCookingLogInput>;
