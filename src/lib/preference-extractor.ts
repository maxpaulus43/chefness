/**
 * Preference extraction via LLM tool calling.
 *
 * Uses `callWithTools` from the streaming client to make a non-streaming
 * request with a `save_preference` tool definition. The model is forced to
 * call the tool, producing guaranteed structured output.
 */
import { callWithTools } from "@/lib/llm-stream";
import type { ToolDefinition } from "@/lib/llm-stream";

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

const SAVE_PREFERENCE_TOOL: ToolDefinition = {
  name: "save_preference",
  description:
    "Extract a user preference that they confirmed they want remembered.",
  parameters: {
    type: "object",
    properties: {
      preference: {
        type: "string",
        description:
          "A concise statement of the user's preference (e.g., 'Hates cilantro', 'Has an Instant Pot', 'Prefers one-pot meals')",
      },
    },
    required: ["preference"],
  },
};

const SYSTEM_PROMPT =
  "You are a preference extraction assistant. Given a conversation snippet, identify the user preference that was discussed and confirmed. Use the save_preference tool to extract it as a concise statement. If no clear preference is found, call the tool with an empty string.";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExtractPreferenceOptions {
  conversationSnippet: string;
  providerId: string;
  modelId: string;
  apiKey: string;
  signal?: AbortSignal;
}

/**
 * Extract a user preference from a conversation snippet using LLM tool calling.
 *
 * @throws If no preference is found in the conversation.
 */
export async function extractPreference(
  options: ExtractPreferenceOptions,
): Promise<string> {
  const { conversationSnippet, providerId, modelId, apiKey, signal } = options;

  const result = await callWithTools({
    providerId,
    modelId,
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: conversationSnippet }],
    tools: [SAVE_PREFERENCE_TOOL],
    signal,
  });

  const preference =
    typeof result.arguments.preference === "string"
      ? result.arguments.preference.trim()
      : "";

  if (preference === "") {
    throw new Error("No preference found in this conversation.");
  }

  return preference;
}
