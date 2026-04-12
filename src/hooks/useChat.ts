/**
 * Custom hook that manages chat conversation state and LLM streaming.
 *
 * This is the "brain" behind the Chat view. It manages all chat state,
 * constructs the system prompt, and streams LLM responses token-by-token.
 *
 * Conversation is in-memory only (MVP) — lost on page refresh.
 *
 * ## LLM Integration
 *
 * Uses the `Agent` class from `@clinebot/agents` which provides:
 * - Automatic provider routing (OpenAI, Anthropic, Gemini, etc.)
 * - SSE streaming with token-by-token events
 * - Error handling and abort support
 * - Conversation history management
 *
 * The Agent's `onEvent` callback emits `content_start` events with
 * `{ text, accumulated }` fields, giving us real-time streaming for free.
 */
import { useState, useRef, useCallback } from "react";
import { useSettings } from "@/hooks/useSettings";
import { Agent } from "@clinebot/agents";
import type { AgentEvent } from "@clinebot/agents";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single chat message in the conversation history. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Supported meal type values. */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "dessert";

/** Supported meal size values. */
export type MealSize = "1" | "2" | "4" | "6+";

// ---------------------------------------------------------------------------
// System prompt construction (PRD §4.1)
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  mealType: MealType | null,
  mealSize: MealSize | null,
): string {
  const parts: string[] = [
    `You are Chefness, a friendly and knowledgeable AI cooking guru. You help users
plan meals, suggest recipes, provide step-by-step cooking instructions, and
answer cooking-related questions.`,
  ];

  if (mealType) {
    parts.push(`The user is planning ${mealType}.`);
  }

  if (mealSize) {
    const sizeLabel = mealSize === "6+" ? "6 or more" : mealSize;
    parts.push(`The user is cooking for ${sizeLabel} people.`);
  }

  parts.push(
    `Keep responses concise and practical. Use clear formatting with numbered steps
for recipes. Suggest ingredient substitutions when relevant. Be encouraging and
conversational.`,
  );

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/** Map common API errors to user-friendly messages. */
function friendlyError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "An unexpected error occurred while contacting the LLM.";
  }
  const msg = err.message.toLowerCase();
  if (msg.includes("401") || msg.includes("unauthorized"))
    return "Invalid API key. Please check your key in Settings.";
  if (msg.includes("403") || msg.includes("forbidden"))
    return "Access denied. Your API key may not have the required permissions.";
  if (msg.includes("404") || msg.includes("not found"))
    return "Model not found. Please verify the model name in Settings.";
  if (msg.includes("429") || msg.includes("rate"))
    return "Rate limited by the provider. Please wait a moment and try again.";
  return err.message;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat() {
  const { llmProvider, llmModel, llmApiKey, isConfigured } = useSettings();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [mealSize, setMealSize] = useState<MealSize | null>(null);

  /** Persistent Agent ref — recreated when conversation is cleared. */
  const agentRef = useRef<Agent | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!navigator.onLine) {
        setError("You are offline. Chat requires an internet connection.");
        return;
      }
      if (!isConfigured) {
        setError("LLM is not configured. Please set provider, model, and API key in Settings.");
        return;
      }

      setError(null);
      const userMsg: ChatMessage = { role: "user", content: text };
      const history = [...messages, userMsg];
      setMessages([...history, { role: "assistant", content: "" }]);
      setIsStreaming(true);

      try {
        const systemPrompt = buildSystemPrompt(mealType, mealSize);

        if (!agentRef.current) {
          agentRef.current = new Agent({
            providerId: llmProvider,
            modelId: llmModel,
            apiKey: llmApiKey,
            systemPrompt,
            tools: [],
            maxIterations: 1,
            onEvent: (event: AgentEvent) => {
              if (
                event.type === "content_start" &&
                event.contentType === "text" &&
                event.accumulated
              ) {
                const content = event.accumulated;
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === "assistant") {
                    next[next.length - 1] = { ...last, content };
                  }
                  return next;
                });
              }
            },
          });
        } else {
          agentRef.current.updateConnection({
            providerId: llmProvider,
            modelId: llmModel,
            apiKey: llmApiKey,
          });
        }

        const result = history.length <= 1
          ? await agentRef.current.run(text)
          : await agentRef.current.continue(text);

        // Ensure the final text is set
        const finalText = result.text || "(No response received from the model.)";
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: finalText };
          }
          return next;
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        setError(friendlyError(err));

        // Remove empty assistant placeholder on error
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, mealType, mealSize, llmProvider, llmModel, llmApiKey, isConfigured],
  );

  const clearChat = useCallback(() => {
    agentRef.current?.abort();
    agentRef.current?.clearHistory();
    agentRef.current = null;
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    mealType,
    mealSize,
    sendMessage,
    clearChat,
    setMealType,
    setMealSize,
    isConfigured,
    llmProvider,
    llmModel,
  } as const;
}
