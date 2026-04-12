/**
 * Recipe extraction via LLM tool calling.
 *
 * Uses `callWithTools` from the streaming client to make a non-streaming
 * request with a `save_recipe` tool definition. The model is forced to
 * call the tool, producing guaranteed structured output.
 */
import { callWithTools } from "@/lib/llm-stream";
import type { ToolDefinition } from "@/lib/llm-stream";
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

const SYSTEM_PROMPT =
  "You are a recipe extraction assistant. Given a cooking message, use the save_recipe tool to extract the recipe. If no recipe is found, call the tool with title 'No recipe found' and empty arrays.";

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
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: messageContent }],
    tools: [SAVE_RECIPE_TOOL],
    signal,
  });

  const args = result.arguments;
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
    throw new Error("No recipe found in this message.");
  }

  return { title, description, ingredients, steps };
}
