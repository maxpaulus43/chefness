import { z } from "zod";

/** Zod schema for a single chat message within a session. */
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  /** Actual model reported by OpenRouter for an assistant response. */
  modelId: z.string().optional().default(""),
  /** Resized image data URL attached to a user message. */
  imageDataUrl: z.string().optional().default(""),
  /** Photo exists on its original device but is not included in iCloud sync. */
  hasPhoto: z.boolean().optional(),
  /** Opaque attachment identity, never a local path or image bytes. */
  photoId: z.string().optional(),
  timestamp: z.string(), // ISO string
  // Hidden context used for URL-imported recipes. Not rendered as chat text,
  // but persisted so later "Save Current Recipe" extraction can reconstruct
  // the recipe plus conversational edits.
  importedRecipeContext: z.string().optional().default(""),
  // Per-message action flags — only relevant for assistant messages
  savedRecipeId: z.string().optional().default(""), // empty = not saved
  memorySaved: z.boolean().optional().default(false),
});

/** Zod schema for a stored chat session. */
export const chatSessionSchema = z.object({
  id: z.string(),
  title: z.string(), // auto-generated from first user message
  messages: z.array(chatMessageSchema),
  mealType: z.string().nullable(), // MealType | null
  mealSize: z.string().nullable(), // MealSize | null
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Native sync revision used to preserve edits made from an older chat view. */
  syncClock: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

/** TypeScript type inferred from the Zod schema. */
export type ChatSession = z.infer<typeof chatSessionSchema>;

/** TypeScript type for a single chat message. */
export type ChatSessionMessage = z.infer<typeof chatMessageSchema>;

/** Input schema for creating a new chat session (id & timestamps are generated server-side). */
export const createChatSessionInput = z.object({
  title: z.string().optional().default("New conversation"),
  messages: z.array(chatMessageSchema).optional().default([]),
  mealType: z.string().nullable().optional().default(null),
  mealSize: z.string().nullable().optional().default(null),
});
export type CreateChatSessionInput = z.infer<typeof createChatSessionInput>;

/** Input schema for updating an existing chat session. */
export const updateChatSessionInput = z.object({
  id: z.string(),
  syncBaseClock: z
    .record(z.string(), z.number().int().nonnegative())
    .optional(),
  title: z.string().optional(),
  messages: z.array(chatMessageSchema).optional(),
  mealType: z.string().nullable().optional(),
  mealSize: z.string().nullable().optional(),
});
export type UpdateChatSessionInput = z.infer<typeof updateChatSessionInput>;
