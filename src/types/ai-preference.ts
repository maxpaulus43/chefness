import { z } from "zod";
import { tombstoneFields } from "@/types/tombstone";

/** Zod schema for a stored AI preference. */
export const aiPreferenceSchema = z.object({
  id: z.string(),
  text: z.string(), // e.g., "Hates cilantro"
  createdAt: z.string(),
  updatedAt: z.string(),
  ...tombstoneFields,
});

/** TypeScript type inferred from the Zod schema. */
export type AiPreference = z.infer<typeof aiPreferenceSchema>;

/** Input schema for creating a new AI preference (id & timestamps are generated server-side). */
export const createAiPreferenceInput = z.object({
  text: z.string().min(1),
});
export type CreateAiPreferenceInput = z.infer<typeof createAiPreferenceInput>;

/** Input schema for updating an existing AI preference. */
export const updateAiPreferenceInput = z.object({
  id: z.string(),
  text: z.string().min(1).optional(),
});
export type UpdateAiPreferenceInput = z.infer<typeof updateAiPreferenceInput>;
