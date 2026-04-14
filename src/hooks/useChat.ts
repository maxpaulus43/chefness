/**
 * Custom hook that manages chat conversation state and LLM streaming.
 *
 * This is the "brain" behind the Chat view. It manages all chat state,
 * constructs the system prompt, and streams LLM responses token-by-token.
 *
 * Conversations are automatically persisted to localStorage via the
 * `useChatSessions` hook. The most recent session is restored on mount,
 * new sessions are created on the first message, and messages are
 * auto-saved after each completed LLM response.
 *
 * ## LLM Integration
 *
 * Uses a browser-compatible streaming client (`src/lib/llm-stream.ts`)
 * that calls LLM provider APIs directly via fetch() + ReadableStream.
 * This avoids the `@clinebot/agents` Agent class, whose internal
 * `createHandler` dependency is not available in the browser build
 * of `@clinebot/llms`.
 *
 * Supported protocols:
 * - OpenAI-compatible (covers OpenAI, OpenRouter, Groq, Together, etc.)
 * - Anthropic-native (Anthropic, MiniMax via Anthropic-compatible API)
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useCookingLog } from "@/hooks/useCookingLog";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { useChatSessions } from "@/hooks/useChatSessions";
import { streamChat } from "@/lib/llm-stream";
import type { CookingLogEntry } from "@/types/cooking-log";
import type { ChatSessionMessage } from "@/types/chat-session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single chat message in the conversation history. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Persisted action flags — only relevant for assistant messages. */
  savedRecipeId?: string;  // ID of saved recipe, or empty/undefined = not saved
  cookLogged?: boolean;
  memorySaved?: boolean;
}

/** Supported meal type values. */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "dessert";

/** Supported meal size values. */
export type MealSize = "1" | "2" | "4" | "6+";

// ---------------------------------------------------------------------------
// System prompt construction (PRD §4.1)
// ---------------------------------------------------------------------------

function formatCookingLogEntry(entry: CookingLogEntry): string {
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(entry.date + "T00:00:00"),
  );

  let line = `- ${dayName}: ${entry.title}`;

  if (entry.rating === "up") {
    line += " (👍)";
  } else if (entry.rating === "down") {
    line += " (👎)";
  }

  if (entry.comment) {
    line += ` "${entry.comment}"`;
  }

  return line;
}

function buildSystemPrompt(
  mealType: MealType | null,
  mealSize: MealSize | null,
  recentHistory: CookingLogEntry[],
  dietaryRestrictions: string[],
  otherDietaryNotes: string,
  preferences: string[],
): string {
  const parts: string[] = [
    `You are Chefness, a friendly and knowledgeable AI cooking guru. You help users
plan meals, suggest recipes, provide step-by-step cooking instructions, and
answer cooking-related questions.`,
  ];

  if (dietaryRestrictions.length > 0 || otherDietaryNotes) {
    const lines: string[] = [];
    if (dietaryRestrictions.length > 0) {
      lines.push(`Dietary restrictions: ${dietaryRestrictions.join(", ")}`);
    }
    if (otherDietaryNotes) {
      lines.push(`Other dietary notes: "${otherDietaryNotes}"`);
    }
    parts.push(lines.join("\n"));
  }

  if (preferences.length > 0) {
    const prefList = preferences.map((p) => `- ${p}`).join("\n");
    parts.push(`Things to remember about this user:\n${prefList}`);
  }

  parts.push(
    `If the user mentions a lasting personal preference, dietary need, kitchen equipment, or cooking style that isn't already in your known preferences, ask: "Would you like me to remember that you [preference]?" Wait for their confirmation before considering it saved.`,
  );

  if (mealType) {
    parts.push(`The user is planning ${mealType}.`);
  }

  if (mealSize) {
    const sizeLabel = mealSize === "6+" ? "6 or more" : mealSize;
    parts.push(`The user is cooking for ${sizeLabel} people.`);
  }

  if (recentHistory.length > 0) {
    const lines = recentHistory.map(formatCookingLogEntry);
    parts.push(`Recent cooking history (last 7 days):\n${lines.join("\n")}`);
  }

  parts.push(
    `Keep responses concise and practical. When providing a recipe, use clear formatting: a title, brief description, an Ingredients section with a bulleted list, and a Steps section with numbered steps. Suggest ingredient substitutions when relevant. Be encouraging and conversational.`,
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
  const { effectiveProvider, effectiveModel, effectiveApiKey, isConfigured, dietaryRestrictions, otherDietaryNotes } = useSettings();
  const { recentEntries } = useCookingLog();
  const { preferences: aiPreferences } = useAiPreferences();
  const { sessions, updateSession, createSessionAsync } = useChatSessions();

  /** Preference texts for the system prompt — stable across renders. */
  const preferenceTexts = aiPreferences.map((p) => p.text);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [mealSize, setMealSize] = useState<MealSize | null>(null);

  /** The ID of the active chat session, or `null` if no session exists yet. */
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  /** AbortController for the in-flight streaming request. */
  const abortRef = useRef<AbortController | null>(null);

  /** Guard so session restore runs only once (when sessions first load). */
  const hasRestoredRef = useRef(false);

  // -------------------------------------------------------------------------
  // Restore the most recent session on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (sessions.length === 0) return;

    hasRestoredRef.current = true;

    const mostRecent = sessions[0]; // sorted by updatedAt desc
    setCurrentSessionId(mostRecent.id);
    setMessages(
      mostRecent.messages.map((m) => ({
        role: m.role,
        content: m.content,
        savedRecipeId: m.savedRecipeId,
        cookLogged: m.cookLogged,
        memorySaved: m.memorySaved,
      })),
    );
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime data from IndexedDB may be null despite type assertion
    setMealType((mostRecent.mealType as MealType) ?? null);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime data from IndexedDB may be null despite type assertion
    setMealSize((mostRecent.mealSize as MealSize) ?? null);
  }, [sessions]);

  // -------------------------------------------------------------------------
  // Helpers for session persistence
  // -------------------------------------------------------------------------

  /** Convert in-memory messages to the persisted format (adds timestamps). */
  const toSessionMessages = useCallback(
    (msgs: ChatMessage[]): ChatSessionMessage[] =>
      msgs.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString(),
        savedRecipeId: m.savedRecipeId ?? "",
        cookLogged: m.cookLogged ?? false,
        memorySaved: m.memorySaved ?? false,
      })),
    [],
  );

  /**
   * Fire-and-forget save of the current messages to the active session.
   * Called after each completed LLM response.
   */
  const persistMessages = useCallback(
    (sessionId: string, msgs: ChatMessage[], mt: MealType | null, ms: MealSize | null) => {
      updateSession({
        id: sessionId,
        messages: toSessionMessages(msgs),
        mealType: mt,
        mealSize: ms,
      });
    },
    [updateSession, toSessionMessages],
  );

  // -------------------------------------------------------------------------
  // setMessageFlag — mark a per-message action as completed & persist
  // -------------------------------------------------------------------------

  /**
   * Set a persisted action flag on a specific message and auto-save the
   * session so the flag survives tab switches and reloads.
   */
  const setMessageFlag = useCallback(
    (index: number, flag: "savedRecipeId" | "cookLogged" | "memorySaved", value?: string | boolean) => {
      setMessages((prev) => {
        const next = [...prev];
        const msg = next[index];
        if (msg) {
          if (flag === "savedRecipeId") {
            next[index] = { ...msg, savedRecipeId: value as string };
          } else {
            next[index] = { ...msg, [flag]: true };
          }
        }
        // Persist immediately so the flag is durable.
        if (currentSessionId) {
          const sessionMsgs = next.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date().toISOString(),
            savedRecipeId: m.savedRecipeId ?? "",
            cookLogged: m.cookLogged ?? false,
            memorySaved: m.memorySaved ?? false,
          })) as ChatSessionMessage[];
          updateSession({
            id: currentSessionId,
            messages: sessionMsgs,
          });
        }
        return next;
      });
    },
    [currentSessionId, updateSession],
  );

  // -------------------------------------------------------------------------
  // sendMessage
  // -------------------------------------------------------------------------

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

      // Auto-create a session on the first message.
      let sessionId = currentSessionId;
      if (!sessionId) {
        try {
          const session = await createSessionAsync({
            title: text.slice(0, 60),
            mealType,
            mealSize,
          });
          sessionId = session.id;
          setCurrentSessionId(sessionId);
        } catch {
          // Session creation failed — continue without persistence.
          console.error("Failed to create chat session; messages will not be persisted.");
        }
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const systemPrompt = buildSystemPrompt(mealType, mealSize, recentEntries, dietaryRestrictions, otherDietaryNotes, preferenceTexts);

        const finalText = await streamChat({
          providerId: effectiveProvider,
          modelId: effectiveModel,
          apiKey: effectiveApiKey,
          systemPrompt,
          messages: history,
          signal: controller.signal,
          onToken: (_token, accumulated) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: accumulated };
              }
              return next;
            });
          },
        });

        // Ensure the final text is set.
        const resultText = finalText || "(No response received from the model.)";
        const finalMessages: ChatMessage[] = [
          ...history,
          { role: "assistant", content: resultText },
        ];
        setMessages(finalMessages);

        // Auto-save after streaming completes (fire-and-forget).
        if (sessionId) {
          persistMessages(sessionId, finalMessages, mealType, mealSize);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        setError(friendlyError(err));

        // Remove empty assistant placeholder on error.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [messages, mealType, mealSize, recentEntries, effectiveProvider, effectiveModel, effectiveApiKey, isConfigured, dietaryRestrictions, otherDietaryNotes, preferenceTexts, currentSessionId, createSessionAsync, persistMessages],
  );

  // -------------------------------------------------------------------------
  // clearChat — "New Chat" behavior
  // -------------------------------------------------------------------------

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setMealType(null);
    setMealSize(null);
    setCurrentSessionId(null);
  }, []);

  // -------------------------------------------------------------------------
  // loadSession — switch to a past session
  // -------------------------------------------------------------------------

  const loadSession = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      // Abort any in-flight streaming.
      abortRef.current?.abort();
      abortRef.current = null;
      setIsStreaming(false);
      setError(null);

      setCurrentSessionId(session.id);
      setMessages(
        session.messages.map((m) => ({
          role: m.role,
          content: m.content,
          savedRecipeId: m.savedRecipeId,
          cookLogged: m.cookLogged,
          memorySaved: m.memorySaved,
        })),
      );
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime data from IndexedDB may be null despite type assertion
      setMealType((session.mealType as MealType) ?? null);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime data from IndexedDB may be null despite type assertion
      setMealSize((session.mealSize as MealSize) ?? null);
    },
    [sessions],
  );

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
    setMessageFlag,
    isConfigured,
    llmProvider: effectiveProvider,
    llmModel: effectiveModel,
    currentSessionId,
    loadSession,
  } as const;
}
