import { z } from "zod";
import { tombstoneFields } from "@/types/tombstone";

/** Zod schema for the stored settings entity (singleton). */
export const settingsSchema = z.object({
  id: z.string(),
  llmProvider: z.string().optional().default(""),
  llmModel: z.string().optional().default(""),
  llmApiKey: z.string().optional().default(""),
  /** API key returned by OpenRouter after OAuth PKCE exchange. */
  openRouterOAuthKey: z.string().default(""),
  dietaryRestrictions: z.array(z.string()).default([]),
  otherDietaryNotes: z.string().default(""),
  modelFilterFreeOnly: z.boolean().default(false),
  modelFilterVisionOnly: z.boolean().default(false),
  modelFilterToolsOnly: z.boolean().default(false),
  /** Missing means this is a legacy installation that predates onboarding. */
  hasCompletedOnboarding: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
  ...tombstoneFields,
});

/** TypeScript type inferred from the Zod schema. */
export type Settings = z.infer<typeof settingsSchema>;

/** Input schema for creating settings (all fields optional, default to empty string). */
export const createSettingsInput = z.object({
  llmProvider: z.string().optional().default(""),
  llmModel: z.string().optional().default(""),
  llmApiKey: z.string().optional().default(""),
  openRouterOAuthKey: z.string().optional().default(""),
  dietaryRestrictions: z.array(z.string()).optional().default([]),
  otherDietaryNotes: z.string().optional().default(""),
  modelFilterFreeOnly: z.boolean().optional().default(false),
  modelFilterVisionOnly: z.boolean().optional().default(false),
  modelFilterToolsOnly: z.boolean().optional().default(false),
  hasCompletedOnboarding: z.boolean().optional().default(false),
});
export type CreateSettingsInput = z.infer<typeof createSettingsInput>;

/** Input schema for updating the settings singleton. */
export const updateSettingsInput = z.object({
  id: z.string(),
  llmProvider: z.string().optional(),
  llmModel: z.string().optional(),
  llmApiKey: z.string().optional(),
  openRouterOAuthKey: z.string().optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  otherDietaryNotes: z.string().optional(),
  modelFilterFreeOnly: z.boolean().optional(),
  modelFilterVisionOnly: z.boolean().optional(),
  modelFilterToolsOnly: z.boolean().optional(),
  hasCompletedOnboarding: z.boolean().optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>;
