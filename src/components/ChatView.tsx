import { ChatSessionList } from "@/components/ChatSessionList";
import { useChat } from "@/hooks/useChat";
import type { MealType, MealSize } from "@/hooks/useChat";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { useCookingLog } from "@/hooks/useCookingLog";
import { useRecipes } from "@/hooks/useRecipes";
import { useSettings } from "@/hooks/useSettings";
import { extractPreference } from "@/lib/preference-extractor";
import { extractRecipe } from "@/lib/recipe-extractor";
import { useState, useEffect, useRef, useCallback, useReducer } from "react";

// ---------------------------------------------------------------------------
// Per-message action state — reducer
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "extracting" | "saved" | "error";
type LogStatus = "idle" | "logging" | "logged" | "error";
type MemoryStatus = "idle" | "extracting" | "saved" | "error";

interface MessageActionState {
  save: SaveStatus;
  saveError: string | null;
  log: LogStatus;
  logError: string | null;
  memory: MemoryStatus;
  memoryError: string | null;
}

const defaultActionState: MessageActionState = {
  save: "idle",
  saveError: null,
  log: "idle",
  logError: null,
  memory: "idle",
  memoryError: null,
};

type MessageActionsState = Record<number, MessageActionState>;

type MessageAction =
  | { type: "SAVE_START"; index: number }
  | { type: "SAVE_OK"; index: number }
  | { type: "SAVE_ERR"; index: number; error: string }
  | { type: "SAVE_RETRY"; index: number }
  | { type: "LOG_START"; index: number }
  | { type: "LOG_OK"; index: number }
  | { type: "LOG_ERR"; index: number; error: string }
  | { type: "LOG_RETRY"; index: number }
  | { type: "MEMORY_START"; index: number }
  | { type: "MEMORY_OK"; index: number }
  | { type: "MEMORY_ERR"; index: number; error: string }
  | { type: "MEMORY_RETRY"; index: number };

function messageActionsReducer(
  state: MessageActionsState,
  action: MessageAction,
): MessageActionsState {
  const prev = state[action.index] ?? defaultActionState;

  switch (action.type) {
    case "SAVE_START":
      return { ...state, [action.index]: { ...prev, save: "extracting", saveError: null } };
    case "SAVE_OK":
      return { ...state, [action.index]: { ...prev, save: "saved" } };
    case "SAVE_ERR":
      return { ...state, [action.index]: { ...prev, save: "error", saveError: action.error } };
    case "SAVE_RETRY":
      return { ...state, [action.index]: { ...prev, save: "idle", saveError: null } };
    case "LOG_START":
      return { ...state, [action.index]: { ...prev, log: "logging", logError: null } };
    case "LOG_OK":
      return { ...state, [action.index]: { ...prev, log: "logged" } };
    case "LOG_ERR":
      return { ...state, [action.index]: { ...prev, log: "error", logError: action.error } };
    case "LOG_RETRY":
      return { ...state, [action.index]: { ...prev, log: "idle", logError: null } };
    case "MEMORY_START":
      return { ...state, [action.index]: { ...prev, memory: "extracting", memoryError: null } };
    case "MEMORY_OK":
      return { ...state, [action.index]: { ...prev, memory: "saved" } };
    case "MEMORY_ERR":
      return { ...state, [action.index]: { ...prev, memory: "error", memoryError: action.error } };
    case "MEMORY_RETRY":
      return { ...state, [action.index]: { ...prev, memory: "idle", memoryError: null } };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a human-readable title from the first non-empty line of an assistant message. */
function extractTitleFromMessage(content: string): string {
  const firstLine =
    content.split("\n").find((line) => line.trim().length > 0) ??
    "Untitled meal";
  return (
    firstLine
      .replace(/^#+\s*/, "")
      .replace(/\*\*/g, "")
      .trim() || "Untitled meal"
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "What should I cook tonight?",
  "Help me use up leftover chicken",
  "Quick weeknight dinner ideas",
  "Something healthy and easy",
] as const;

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "dessert", label: "Dessert" },
];

const MEAL_SIZES: { value: MealSize; label: string }[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
  { value: "6+", label: "6+" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatViewProps {
  onNavigateToSettings: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatView({ onNavigateToSettings }: ChatViewProps) {
  const {
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
    currentSessionId,
    loadSession,
  } = useChat();

  const { createRecipeAsync } = useRecipes();
  const { createEntryAsync } = useCookingLog();
  const { createPreferenceAsync } = useAiPreferences();
  const { llmProvider, llmModel, llmApiKey } = useSettings();

  const [inputValue, setInputValue] = useState("");
  const [showSessionList, setShowSessionList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastUserMessageRef = useRef<string>("");

  // Per-message action state (save recipe + cooking log)
  const [actionStates, dispatch] = useReducer(
    messageActionsReducer,
    {} as MessageActionsState,
  );

  const handleSaveRecipe = useCallback(
    async (index: number) => {
      const msg = messages[index];
      if (!msg || msg.role !== "assistant") return;

      dispatch({ type: "SAVE_START", index });

      try {
        const recipe = await extractRecipe({
          messageContent: msg.content,
          providerId: llmProvider,
          modelId: llmModel,
          apiKey: llmApiKey,
        });
        await createRecipeAsync(recipe);
        dispatch({ type: "SAVE_OK", index });
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error ? err.message : "Failed to save recipe.";
        dispatch({ type: "SAVE_ERR", index, error: errMsg });
      }
    },
    [messages, llmProvider, llmModel, llmApiKey, createRecipeAsync],
  );

  const handleSaveRetry = useCallback((index: number) => {
    dispatch({ type: "SAVE_RETRY", index });
  }, []);

  const handleLogCook = useCallback(
    async (index: number) => {
      const msg = messages[index];
      if (!msg || msg.role !== "assistant") return;

      dispatch({ type: "LOG_START", index });

      try {
        const title = extractTitleFromMessage(msg.content);
        await createEntryAsync({
          title,
          date: new Date().toISOString().slice(0, 10),
          recipeId: null,
        });
        dispatch({ type: "LOG_OK", index });
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error ? err.message : "Failed to log meal.";
        dispatch({ type: "LOG_ERR", index, error: errMsg });
      }
    },
    [messages, createEntryAsync],
  );

  const handleLogRetry = useCallback((index: number) => {
    dispatch({ type: "LOG_RETRY", index });
  }, []);

  const handleSaveMemory = useCallback(
    async (index: number) => {
      const msg = messages[index];
      if (!msg || msg.role !== "assistant") return;

      dispatch({ type: "MEMORY_START", index });

      try {
        // Collect last 6 messages up to (and including) this assistant message
        // for context about what preference was discussed.
        const snippetStart = Math.max(0, index - 5);
        const snippetMessages = messages.slice(snippetStart, index + 1);
        const conversationSnippet = snippetMessages
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n\n");

        const preferenceText = await extractPreference({
          conversationSnippet,
          providerId: llmProvider,
          modelId: llmModel,
          apiKey: llmApiKey,
        });

        await createPreferenceAsync({ text: preferenceText });
        dispatch({ type: "MEMORY_OK", index });
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error
            ? err.message
            : "Failed to extract preference.";
        dispatch({ type: "MEMORY_ERR", index, error: errMsg });
      }
    },
    [messages, llmProvider, llmModel, llmApiKey, createPreferenceAsync],
  );

  const handleMemoryRetry = useCallback((index: number) => {
    dispatch({ type: "MEMORY_RETRY", index });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0 && isConfigured) {
      inputRef.current?.focus();
    }
  }, [messages.length, isConfigured]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    lastUserMessageRef.current = text;
    setInputValue("");
    void sendMessage(text);
  }, [inputValue, isStreaming, sendMessage]);

  const handleSuggestionTap = useCallback(
    (text: string) => {
      lastUserMessageRef.current = text;
      void sendMessage(text);
    },
    [sendMessage],
  );

  const handleNewChat = useCallback(() => {
    if (messages.length > 0) {
      const confirmed = window.confirm(
        "Start a new conversation? The current chat will be saved.",
      );
      if (!confirmed) return;
    }
    clearChat();
    setShowSessionList(false);
  }, [messages.length, clearChat]);

  const handleToggleSessionList = useCallback(() => {
    setShowSessionList((prev) => !prev);
  }, []);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      loadSession(sessionId);
      setShowSessionList(false);
    },
    [loadSession],
  );

  const handleNewChatFromList = useCallback(() => {
    clearChat();
    setShowSessionList(false);
  }, [clearChat]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleRetry = useCallback(() => {
    if (lastUserMessageRef.current) {
      void sendMessage(lastUserMessageRef.current);
    }
  }, [sendMessage]);

  const handleMealTypeToggle = useCallback(
    (value: MealType) => {
      setMealType((prev: MealType | null) => (prev === value ? null : value));
    },
    [setMealType],
  );

  const handleMealSizeToggle = useCallback(
    (value: MealSize) => {
      setMealSize((prev: MealSize | null) => (prev === value ? null : value));
    },
    [setMealSize],
  );

  // -- Not configured -------------------------------------------------------
  if (!isConfigured) {
    return (
      <div style={styles.root}>
        {renderHeader(handleNewChat, false)}
        <div style={styles.centeredContent}>
          <p style={styles.setupText}>
            Set up your AI provider in Settings to start chatting.
          </p>
          <button
            type="button"
            onClick={onNavigateToSettings}
            style={styles.goToSettingsButton}
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  // -- Configured -----------------------------------------------------------
  const hasMessages = messages.length > 0;

  return (
    <div style={styles.root}>
      {renderHeader(handleNewChat, hasMessages, handleToggleSessionList, showSessionList)}
      {showSessionList ? (
        <div style={styles.messageArea}>
          <ChatSessionList
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChatFromList}
            currentSessionId={currentSessionId}
          />
        </div>
      ) : (
      <div style={styles.messageArea}>
        {!hasMessages ? renderEmptyState(handleSuggestionTap) : (
          <div style={styles.messageList}>
            {messages.map((msg, i) => {
              const isLastMsg = i === messages.length - 1;
              const isActivelyStreaming = isStreaming && isLastMsg;
              const showActionBtns =
                msg.role === "assistant" &&
                msg.content !== "" &&
                !isActivelyStreaming;
              const action = actionStates[i] ?? defaultActionState;

              return (
                <div
                  key={i}
                  style={msg.role === "user" ? styles.userRow : styles.asstRow}
                >
                  <div
                    style={
                      msg.role === "user"
                        ? styles.userBubble
                        : styles.asstBubble
                    }
                  >
                    <span style={styles.msgText}>{msg.content}</span>
                    {msg.role === "assistant" &&
                      msg.content === "" &&
                      isStreaming && (
                        <span style={styles.typing}>●●●</span>
                      )}
                  </div>
                  {showActionBtns && (
                    <div style={styles.saveRow}>
                      {action.save === "idle" && (
                        <button
                          type="button"
                          style={styles.saveBtn}
                          onClick={() => void handleSaveRecipe(i)}
                        >
                          Save Recipe
                        </button>
                      )}
                      {action.save === "extracting" && (
                        <button
                          type="button"
                          style={{
                            ...styles.saveBtn,
                            ...styles.saveBtnDisabled,
                          }}
                          disabled
                        >
                          Extracting…
                        </button>
                      )}
                      {action.save === "saved" && (
                        <span style={styles.savedLabel}>✅ Saved!</span>
                      )}
                      {action.save === "error" && (
                        <div style={styles.saveErrorRow}>
                          <span style={styles.saveErrorText}>
                            {action.saveError ?? "Extraction failed."}
                          </span>
                          <button
                            type="button"
                            style={styles.saveRetryBtn}
                            onClick={() => handleSaveRetry(i)}
                          >
                            Try Again
                          </button>
                        </div>
                      )}

                      {action.log === "idle" && (
                        <button
                          type="button"
                          style={styles.logBtn}
                          onClick={() => void handleLogCook(i)}
                        >
                          I Cooked This!
                        </button>
                      )}
                      {action.log === "logging" && (
                        <button
                          type="button"
                          style={{
                            ...styles.logBtn,
                            ...styles.logBtnDisabled,
                          }}
                          disabled
                        >
                          Logging…
                        </button>
                      )}
                      {action.log === "logged" && (
                        <span style={styles.loggedLabel}>✅ Logged!</span>
                      )}
                      {action.log === "error" && (
                        <div style={styles.saveErrorRow}>
                          <span style={styles.saveErrorText}>
                            {action.logError ?? "Failed to log meal."}
                          </span>
                          <button
                            type="button"
                            style={styles.saveRetryBtn}
                            onClick={() => handleLogRetry(i)}
                          >
                            Try Again
                          </button>
                        </div>
                      )}

                      {action.memory === "idle" && (
                        <button
                          type="button"
                          style={styles.memoryBtn}
                          onClick={() => void handleSaveMemory(i)}
                        >
                          🧠 Save to Memory
                        </button>
                      )}
                      {action.memory === "extracting" && (
                        <button
                          type="button"
                          style={{
                            ...styles.memoryBtn,
                            ...styles.memoryBtnDisabled,
                          }}
                          disabled
                        >
                          Extracting…
                        </button>
                      )}
                      {action.memory === "saved" && (
                        <span style={styles.memorySavedLabel}>
                          ✅ Remembered!
                        </span>
                      )}
                      {action.memory === "error" && (
                        <div style={styles.saveErrorRow}>
                          <span style={styles.saveErrorText}>
                            {action.memoryError ??
                              "No preference found in this conversation."}
                          </span>
                          <button
                            type="button"
                            style={styles.saveRetryBtn}
                            onClick={() => handleMemoryRetry(i)}
                          >
                            Try Again
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      )}

      {!showSessionList && error && renderErrorBanner(error, handleRetry)}

      {!showSessionList && renderInputArea(
        inputValue,
        setInputValue,
        handleKeyDown,
        handleSend,
        isStreaming,
        mealType,
        mealSize,
        handleMealTypeToggle,
        handleMealSizeToggle,
        inputRef,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-renders
// ---------------------------------------------------------------------------

function renderHeader(
  onNewChat: () => void,
  showNewChat: boolean,
  onToggleSessions?: () => void,
  sessionListOpen?: boolean,
) {
  return (
    <div style={styles.header}>
      <h1 style={styles.headerTitle}>Chefness</h1>
      <div style={styles.headerActions}>
        {onToggleSessions && (
          <button
            type="button"
            onClick={onToggleSessions}
            style={{
              ...styles.sessionsBtn,
              ...(sessionListOpen ? styles.sessionsBtnActive : {}),
            }}
            aria-label={sessionListOpen ? "Hide sessions" : "Show sessions"}
          >
            💬
          </button>
        )}
        {showNewChat && (
          <button type="button" onClick={onNewChat} style={styles.newChatBtn}>
            New Chat
          </button>
        )}
      </div>
    </div>
  );
}

function renderEmptyState(onTap: (text: string) => void) {
  return (
    <div style={styles.emptyState}>
      <p style={styles.welcomeText}>What would you like to cook?</p>
      <div style={styles.suggestionsWrap}>
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            style={styles.suggestionChip}
            onClick={() => onTap(text)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function renderErrorBanner(error: string, onRetry: () => void) {
  return (
    <div style={styles.errorBanner}>
      <span style={styles.errorText}>{error}</span>
      <button type="button" onClick={onRetry} style={styles.retryBtn}>
        Retry
      </button>
    </div>
  );
}

function renderInputArea(
  inputValue: string,
  setInputValue: (v: string) => void,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void,
  onSend: () => void,
  isStreaming: boolean,
  mealType: MealType | null,
  mealSize: MealSize | null,
  onMealType: (v: MealType) => void,
  onMealSize: (v: MealSize) => void,
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  const sendDisabled = isStreaming || !inputValue.trim();
  return (
    <div style={styles.inputArea}>
      <div style={styles.pillRow}>
        {MEAL_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            style={{
              ...styles.pill,
              ...(mealType === value ? styles.pillActive : {}),
            }}
            onClick={() => onMealType(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={styles.pillRow}>
        <span style={styles.pillLabel}>Serves:</span>
        {MEAL_SIZES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            style={{
              ...styles.pill,
              ...(mealSize === value ? styles.pillActive : {}),
            }}
            onClick={() => onMealSize(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={styles.inputRow}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask your cooking guru…"
          style={styles.textInput}
          disabled={isStreaming}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={sendDisabled}
          style={{
            ...styles.sendBtn,
            ...(sendDisabled ? styles.sendBtnDisabled : {}),
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}



// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minWidth: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#fff",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#111827",
    margin: 0,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  sessionsBtn: {
    padding: "0.5rem",
    fontSize: "1.125rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    cursor: "pointer",
    minWidth: 40,
    minHeight: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  sessionsBtnActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  newChatBtn: {
    padding: "0.5rem 0.875rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    minHeight: 40,
  },
  messageArea: {
    flex: 1,
    overflowY: "auto",
    padding: "0.75rem 1rem",
    minHeight: 0,
  },
  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  userRow: { display: "flex", justifyContent: "flex-end" },
  asstRow: { display: "flex", justifyContent: "flex-start" },
  userBubble: {
    maxWidth: "80%",
    padding: "0.625rem 0.875rem",
    borderRadius: "16px 16px 4px 16px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    fontSize: "0.9375rem",
    lineHeight: 1.45,
    wordBreak: "break-word" as const,
  },
  asstBubble: {
    maxWidth: "80%",
    padding: "0.625rem 0.875rem",
    borderRadius: "16px 16px 16px 4px",
    backgroundColor: "#f3f4f6",
    color: "#111827",
    fontSize: "0.9375rem",
    lineHeight: 1.45,
    wordBreak: "break-word" as const,
  },
  msgText: { whiteSpace: "pre-wrap" as const },
  typing: {
    display: "inline-block",
    marginLeft: "0.25rem",
    color: "#9ca3af",
    letterSpacing: "0.15em",
  },

  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "1.5rem",
    padding: "2rem 1rem",
  },
  welcomeText: {
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#374151",
    textAlign: "center" as const,
  },
  suggestionsWrap: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
    justifyContent: "center",
    maxWidth: 360,
  },
  suggestionChip: {
    padding: "0.625rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 20,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    minHeight: 44,
  },
  centeredContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    gap: "1rem",
  },
  setupText: {
    fontSize: "1rem",
    color: "#6b7280",
    textAlign: "center" as const,
    lineHeight: 1.5,
  },
  goToSettingsButton: {
    padding: "0.75rem 1.5rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#3b82f6",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    minHeight: 48,
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    padding: "0.625rem 1rem",
    backgroundColor: "#dc2626",
    color: "#fff",
    fontSize: "0.875rem",
    flexShrink: 0,
  },
  errorText: { flex: 1, lineHeight: 1.4 },
  retryBtn: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#dc2626",
    backgroundColor: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
    minHeight: 36,
  },
  inputArea: {
    flexShrink: 0,
    padding: "0.5rem 1rem 0.75rem",
    borderTop: "1px solid #e5e7eb",
    backgroundColor: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
  },
  pillRow: {
    display: "flex",
    gap: "0.375rem",
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
  pillLabel: {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#6b7280",
    marginRight: "0.125rem",
  },
  pill: {
    padding: "0.25rem 0.625rem",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#6b7280",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    cursor: "pointer",
    minHeight: 32,
    lineHeight: "1.4",
  },
  pillActive: {
    color: "#fff",
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  inputRow: { display: "flex", gap: "0.5rem", alignItems: "center" },
  textInput: {
    flex: 1,
    padding: "0.625rem 0.875rem",
    fontSize: "0.9375rem",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#111827",
    minWidth: 0,
    minHeight: 44,
    boxSizing: "border-box" as const,
  },
  sendBtn: {
    padding: "0.625rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#3b82f6",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
    minHeight: 44,
  },
  sendBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },

  // Save Recipe button styles
  saveRow: {
    marginTop: "0.25rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    flexWrap: "wrap" as const,
  },
  saveBtn: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 32,
    whiteSpace: "nowrap" as const,
  },
  saveBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  savedLabel: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "#16a34a",
  },
  saveErrorRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    flexWrap: "wrap" as const,
  },
  saveErrorText: {
    fontSize: "0.8125rem",
    color: "#dc2626",
    lineHeight: 1.4,
  },
  saveRetryBtn: {
    padding: "0.25rem 0.625rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#dc2626",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 6,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    minHeight: 28,
  },

  // "I Cooked This!" button styles
  logBtn: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "#ea580c",
    backgroundColor: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 32,
    whiteSpace: "nowrap" as const,
  },
  logBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  loggedLabel: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "#16a34a",
  },

  // "Save to Memory" button styles
  memoryBtn: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "#7c3aed",
    backgroundColor: "#f5f3ff",
    border: "1px solid #ddd6fe",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 32,
    whiteSpace: "nowrap" as const,
  },
  memoryBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  memorySavedLabel: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "#16a34a",
  },
};

