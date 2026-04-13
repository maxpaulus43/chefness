import { z } from "zod";

/** Zod schema for a single chat message within a session. */
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(), // ISO string
  // Per-message action flags — only relevant for assistant messages
  savedRecipeId: z.string().optional().default(""),  // empty = not saved
  cookLogged: z.boolean().optional().default(false),
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
  title: z.string().optional(),
  messages: z.array(chatMessageSchema).optional(),
  mealType: z.string().nullable().optional(),
  mealSize: z.string().nullable().optional(),
});
export type UpdateChatSessionInput = z.infer<typeof updateChatSessionInput>;
