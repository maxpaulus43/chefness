import { z } from "zod";

/** Zod schema for the stored settings entity (singleton). */
export const settingsSchema = z.object({
  id: z.string(),
  llmProvider: z.string(),
  llmModel: z.string(),
  llmApiKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** TypeScript type inferred from the Zod schema. */
export type Settings = z.infer<typeof settingsSchema>;

/** Input schema for creating settings (all fields optional, default to empty string). */
export const createSettingsInput = z.object({
  llmProvider: z.string().optional().default(""),
  llmModel: z.string().optional().default(""),
  llmApiKey: z.string().optional().default(""),
});
export type CreateSettingsInput = z.infer<typeof createSettingsInput>;

/** Input schema for updating the settings singleton. */
export const updateSettingsInput = z.object({
  id: z.string(),
  llmProvider: z.string().optional(),
  llmModel: z.string().optional(),
  llmApiKey: z.string().optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>;
