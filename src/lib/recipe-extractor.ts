/**
 * Recipe extraction via LLM tool calling.
 *
 * Uses `callWithTools` from the streaming client to make a non-streaming
 * request with a `save_recipe` tool definition. The model is forced to
 * call the tool, producing guaranteed structured output.
 */
import { callWithTools } from "@/lib/llm-stream";
import type { StreamMessage, ToolDefinition } from "@/lib/llm-stream";
import type { CreateRecipeInput } from "@/types/recipe";

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

const SAVE_RECIPE_TOOL: ToolDefinition = {
  name: "save_recipe",
  description:
    "Extract and save a recipe from a cooking message. Extract the title, description, ingredients list, and step-by-step instructions.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The recipe title" },
      description: {
        type: "string",
        description: "A brief description of the dish",
      },
      ingredients: {
        type: "array",
        items: { type: "string" },
        description: "List of ingredients with quantities",
      },
      steps: {
        type: "array",
        items: { type: "string" },
        description: "Step-by-step cooking instructions",
      },
    },
    required: ["title", "description", "ingredients", "steps"],
  },
};

const MESSAGE_SYSTEM_PROMPT =
  "You are a recipe extraction assistant. Given a cooking message, use the save_recipe tool to extract the recipe. If no recipe is found, call the tool with title 'No recipe found' and empty arrays.";

const CONVERSATION_SYSTEM_PROMPT = `You are a recipe extraction assistant. Given a cooking conversation, use the save_recipe tool to reconstruct the latest complete recipe the user intends to save.

Rules:
- Incorporate all user-requested edits, substitutions, refinements, and constraints from the conversation.
- Return one complete, canonical recipe: title, description, full ingredient list, and complete step-by-step instructions.
- Do not return only the latest delta/change note.
- If the conversation contains multiple recipes, save the most recent recipe being developed or refined.
- Ignore unrelated chat. If no recipe can be reconstructed, call the tool with title 'No recipe found' and empty arrays.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExtractRecipeOptions {
  messageContent: string;
  providerId: string;
  modelId: string;
  apiKey: string;
  signal?: AbortSignal;
}

export interface ExtractRecipeFromConversationOptions {
  messages: Pick<StreamMessage, "role" | "content">[];
  providerId: string;
  modelId: string;
  apiKey: string;
  signal?: AbortSignal;
}

/**
 * Extract structured recipe data from a chat message using LLM tool calling.
 *
 * @throws If no recipe is found in the message or extraction fails.
 */
export async function extractRecipe(
  options: ExtractRecipeOptions,
): Promise<CreateRecipeInput> {
  const { messageContent, providerId, modelId, apiKey, signal } = options;

  const result = await callWithTools({
    providerId,
    modelId,
    apiKey,
    systemPrompt: MESSAGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: messageContent }],
    tools: [SAVE_RECIPE_TOOL],
    signal,
  });

  return parseRecipeToolResult(result.arguments, "message");
}

/**
 * Extract the latest complete recipe from a chat conversation.
 *
 * Unlike `extractRecipe`, this is designed for iterative recipe refinement:
 * the model should fold prior recipe text and later user-requested edits into
 * one complete recipe suitable for saving.
 *
 * @throws If no complete recipe can be reconstructed from the conversation.
 */
export async function extractRecipeFromConversation(
  options: ExtractRecipeFromConversationOptions,
): Promise<CreateRecipeInput> {
  const { messages, providerId, modelId, apiKey, signal } = options;

  const result = await callWithTools({
    providerId,
    modelId,
    apiKey,
    systemPrompt: CONVERSATION_SYSTEM_PROMPT,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [SAVE_RECIPE_TOOL],
    signal,
  });

  return parseRecipeToolResult(result.arguments, "conversation");
}

function parseRecipeToolResult(
  args: Record<string, unknown>,
  source: "message" | "conversation",
): CreateRecipeInput {
  const title = typeof args.title === "string" ? args.title : "";
  const description =
    typeof args.description === "string" ? args.description : "";
  const ingredients = Array.isArray(args.ingredients)
    ? (args.ingredients as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const steps = Array.isArray(args.steps)
    ? (args.steps as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  if (
    title === "No recipe found" ||
    title === "" ||
    ingredients.length === 0 ||
    steps.length === 0
  ) {
    throw new Error(
      source === "conversation"
        ? "No recipe found in this conversation."
        : "No recipe found in this message.",
    );
  }

  return { title, description, ingredients, steps };
}
