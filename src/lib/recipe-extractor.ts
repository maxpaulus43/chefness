/**
 * Recipe extraction via LLM tool calling.
 *
 * Uses `callWithTools` from the streaming client to make a non-streaming
 * request with a `save_recipe` tool definition. The model is forced to
 * call the tool, producing guaranteed structured output.
 */
import { callWithTools } from "@/lib/llm-stream";
import type { StreamMessage, ToolDefinition } from "@/lib/llm-stream";
import type { CreateRecipeInput, Recipe } from "@/types/recipe";

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

const EDIT_RECIPE_SYSTEM_PROMPT = `You are a recipe editing assistant. Given an existing saved recipe and a user's natural-language edit request, use the save_recipe tool to return the complete updated recipe.

Rules:
- Apply the requested change directly to the recipe.
- Preserve any title, description, ingredients, and steps that are not affected by the request.
- Return one complete recipe, not a summary, diff, or partial patch.
- Keep ingredient quantities and cooking steps internally consistent after the edit.
- If the request is impossible or unrelated to editing the recipe, return the original recipe as the complete recipe.`;

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

export interface EditRecipeWithPromptOptions {
  recipe: Recipe;
  instruction: string;
  providerId: string;
  modelId: string;
  apiKey: string;
  onModel?: (modelId: string) => void;
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

/**
 * Edit a saved recipe from a natural-language instruction.
 *
 * Returns a complete updated recipe suitable for previewing and applying.
 */
export async function editRecipeWithPrompt(
  options: EditRecipeWithPromptOptions,
): Promise<CreateRecipeInput> {
  const { recipe, instruction, providerId, modelId, apiKey, onModel, signal } =
    options;

  const result = await callWithTools({
    providerId,
    modelId,
    apiKey,
    systemPrompt: EDIT_RECIPE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Current recipe:\n${formatRecipeForEditing(recipe)}\n\nEdit request:\n${instruction}`,
      },
    ],
    tools: [SAVE_RECIPE_TOOL],
    onModel,
    signal,
  });

  return parseRecipeToolResult(result.arguments, "message");
}

function formatRecipeForEditing(recipe: Recipe): string {
  return [
    `Title: ${recipe.title}`,
    `Description: ${recipe.description}`,
    "Ingredients:",
    ...recipe.ingredients.map((ingredient) => `- ${ingredient}`),
    "Steps:",
    ...recipe.steps.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n");
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
