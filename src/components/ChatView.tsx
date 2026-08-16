import { ChatSessionList } from "@/components/ChatSessionList";
import { Icon } from "@/components/Icon";
import { useChat } from "@/hooks/useChat";
import type { MealType, MealSize } from "@/hooks/useChat";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { useRecipes } from "@/hooks/useRecipes";
import { useSettings } from "@/hooks/useSettings";
import { useImageAttachment } from "@/hooks/useImageAttachment";
import { useToast } from "@/hooks/useToast";
import { Markdown } from "@/lib/markdown";
import { extractPreference } from "@/lib/preference-extractor";
import { extractRecipeFromConversation } from "@/lib/recipe-extractor";
import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { colors, fonts, shadows, radii } from "@/theme";

// ---------------------------------------------------------------------------
// Per-message action state — reducer ---------------------------------------------------------------------------
type SaveStatus = "idle" | "extracting" | "saved" | "error";
type MemoryStatus = "idle" | "extracting" | "saved" | "error";

interface MessageActionState {
    save: SaveStatus;
    saveError: string | null;
    memory: MemoryStatus;
    memoryError: string | null;
}

const defaultActionState: MessageActionState = {
    save: "idle",
    saveError: null,
    memory: "idle",
    memoryError: null,
};

type MessageActionsState = Record<number, MessageActionState>;

type MessageAction =
    | { type: "SAVE_START"; index: number }
    | { type: "SAVE_OK"; index: number }
    | { type: "SAVE_ERR"; index: number; error: string }
    | { type: "SAVE_RETRY"; index: number }
    | { type: "MEMORY_START"; index: number }
    | { type: "MEMORY_OK"; index: number }
    | { type: "MEMORY_ERR"; index: number; error: string }
    | { type: "MEMORY_RETRY"; index: number }
    | { type: "RESET"; states: MessageActionsState };

function messageActionsReducer(
    state: MessageActionsState,
    action: MessageAction,
): MessageActionsState {
    if (action.type === "RESET") {
        return action.states;
    }

    const prev = state[action.index] ?? defaultActionState;

    switch (action.type) {
        case "SAVE_START":
            return {
                ...state,
                [action.index]: {
                    ...prev,
                    save: "extracting",
                    saveError: null,
                },
            };
        case "SAVE_OK":
            return { ...state, [action.index]: { ...prev, save: "saved" } };
        case "SAVE_ERR":
            return {
                ...state,
                [action.index]: {
                    ...prev,
                    save: "error",
                    saveError: action.error,
                },
            };
        case "SAVE_RETRY":
            return {
                ...state,
                [action.index]: { ...prev, save: "idle", saveError: null },
            };
        case "MEMORY_START":
            return {
                ...state,
                [action.index]: {
                    ...prev,
                    memory: "extracting",
                    memoryError: null,
                },
            };
        case "MEMORY_OK":
            return { ...state, [action.index]: { ...prev, memory: "saved" } };
        case "MEMORY_ERR":
            return {
                ...state,
                [action.index]: {
                    ...prev,
                    memory: "error",
                    memoryError: action.error,
                },
            };
        case "MEMORY_RETRY":
            return {
                ...state,
                [action.index]: { ...prev, memory: "idle", memoryError: null },
            };
    }
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
        editUserMessageAndRegenerate,
        stopStreaming,
        clearChat,
        setMealType,
        setMealSize,
        setMessageFlag,
        isConfigured,
        canAttachImage,
        currentSessionId,
        loadSession,
    } = useChat();

    const { recipes, createRecipeAsync } = useRecipes();
    const { createPreferenceAsync } = useAiPreferences();
    const { effectiveProvider, effectiveModel, effectiveApiKey } =
        useSettings();

    const [inputValue, setInputValue] = useState("");
    const [showSessionList, setShowSessionList] = useState(false);
    const {
        attachment: imageAttachment,
        isPreparing: isPreparingImage,
        error: imageAttachmentError,
        attachImage,
        clearImage,
    } = useImageAttachment();
    const toast = useToast();
    const [editingMessageIndex, setEditingMessageIndex] = useState<
        number | null
    >(null);
    const [editingMessageValue, setEditingMessageValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const lastUserMessageRef = useRef<{ text: string; imageDataUrl: string } | null>(null);
    const isNearBottomRef = useRef(true);
    const prevMessageCountRef = useRef(0);

    // Per-message action state (save recipe + save to memory)
    const [actionStates, dispatch] = useReducer(
        messageActionsReducer,
        {} as MessageActionsState,
    );

    // Seed reducer state from persisted message flags when session changes
    // or when recipes list changes (e.g. after a deletion).
    useEffect(() => {
        const recipeIds = new Set(recipes.map((r) => r.id));
        const initial: MessageActionsState = {};
        messages.forEach((msg, i) => {
            if (msg.role === "assistant") {
                // Recipe is only considered "saved" if the recipe still exists
                const recipeSaved =
                    !!msg.savedRecipeId && recipeIds.has(msg.savedRecipeId);
                initial[i] = {
                    save: recipeSaved ? "saved" : "idle",
                    saveError: null,
                    memory: msg.memorySaved ? "saved" : "idle",
                    memoryError: null,
                };
            }
        });
        dispatch({ type: "RESET", states: initial });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSessionId, recipes]);

    const handleSaveRecipe = useCallback(
        async (index: number) => {
            const msg = messages[index];
            if (msg?.role !== "assistant") return;

            dispatch({ type: "SAVE_START", index });

            try {
                // Save the current recipe state, not just this one assistant
                // bubble. Users often refine a recipe over several turns
                // ("make it vegetarian", "halve the salt", etc.), so give the
                // extractor enough recent context to reconstruct the latest
                // complete version.
                const snippetStart = Math.max(0, index - 11);
                const conversationMessages = messages
                    .slice(snippetStart, index + 1)
                    .filter((m) => m.content.trim() !== "")
                    .map((m) => ({
                        role: m.role,
                        content: m.importedRecipeContext
                            ? `${m.content}\n\nHidden Chefness recipe URL context:\n${m.importedRecipeContext}`
                            : m.content,
                    }));

                const recipe = await extractRecipeFromConversation({
                    messages: conversationMessages,
                    providerId: effectiveProvider,
                    modelId: effectiveModel,
                    apiKey: effectiveApiKey,
                });
                const saved = await createRecipeAsync(recipe);
                dispatch({ type: "SAVE_OK", index });
                setMessageFlag(index, "savedRecipeId", saved.id);
            } catch (err: unknown) {
                const errMsg =
                    err instanceof Error
                        ? err.message
                        : "Failed to save recipe.";
                dispatch({ type: "SAVE_ERR", index, error: errMsg });
            }
        },
        [
            messages,
            effectiveProvider,
            effectiveModel,
            effectiveApiKey,
            createRecipeAsync,
            setMessageFlag,
        ],
    );

    const handleSaveRetry = useCallback((index: number) => {
        dispatch({ type: "SAVE_RETRY", index });
    }, []);

    const handleSaveMemory = useCallback(
        async (index: number) => {
            const msg = messages[index];
            if (msg?.role !== "assistant") return;

            dispatch({ type: "MEMORY_START", index });

            try {
                // Collect last 6 messages up to (and including) this assistant message
                // for context about what preference was discussed.
                const snippetStart = Math.max(0, index - 5);
                const snippetMessages = messages.slice(snippetStart, index + 1);
                const conversationSnippet = snippetMessages
                    .map(
                        (m) =>
                            `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`,
                    )
                    .join("\n\n");

                const preferenceText = await extractPreference({
                    conversationSnippet,
                    providerId: effectiveProvider,
                    modelId: effectiveModel,
                    apiKey: effectiveApiKey,
                });

                await createPreferenceAsync({ text: preferenceText });
                dispatch({ type: "MEMORY_OK", index });
                setMessageFlag(index, "memorySaved");
            } catch (err: unknown) {
                const errMsg =
                    err instanceof Error
                        ? err.message
                        : "Failed to extract preference.";
                dispatch({ type: "MEMORY_ERR", index, error: errMsg });
            }
        },
        [
            messages,
            effectiveProvider,
            effectiveModel,
            effectiveApiKey,
            createPreferenceAsync,
            setMessageFlag,
        ],
    );

    const handleMemoryRetry = useCallback((index: number) => {
        dispatch({ type: "MEMORY_RETRY", index });
    }, []);

    // Smart auto-scroll: only scroll to bottom when the user is already near the bottom.
    const SCROLL_THRESHOLD = 150;

    const checkIfNearBottom = useCallback(() => {
        const el = messageAreaRef.current;
        if (!el) return true;
        return (
            el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD
        );
    }, []);

    const scrollToBottom = useCallback(
        (behavior: ScrollBehavior = "smooth") => {
            if (behavior === "instant") {
                // During streaming, set scrollTop directly for reliable,
                // immediate scrolling that keeps up with rapid token delivery.
                const el = messageAreaRef.current;
                if (el) {
                    el.scrollTop = el.scrollHeight;
                }
            } else {
                messagesEndRef.current?.scrollIntoView({ behavior });
            }
        },
        [],
    );

    const handleMessageAreaScroll = useCallback(() => {
        isNearBottomRef.current = checkIfNearBottom();
    }, [checkIfNearBottom]);

    useEffect(() => {
        const currentCount = messages.length;
        const prevCount = prevMessageCountRef.current;
        prevMessageCountRef.current = currentCount;

        // A new message was added (user sent a message or new assistant response started)
        // — always scroll to bottom for that.
        if (currentCount > prevCount) {
            isNearBottomRef.current = true;
            scrollToBottom();
            return;
        }

        // Streaming token update — only auto-scroll if user is near the bottom.
        // Use "instant" (scrollTop) instead of smooth scrollIntoView so rapid
        // token delivery (e.g. from OpenRouter) doesn't outrun the animation.
        if (isNearBottomRef.current) {
            scrollToBottom("instant");
        }
    }, [messages, scrollToBottom]);

    const handleSend = useCallback(() => {
        const text = inputValue.trim();
        const imageDataUrl = imageAttachment?.dataUrl ?? "";
        if ((!text && !imageDataUrl) || isStreaming || isPreparingImage) return;
        lastUserMessageRef.current = { text, imageDataUrl };
        setInputValue("");
        clearImage();
        void sendMessage(text, imageDataUrl);
    }, [clearImage, imageAttachment, inputValue, isPreparingImage, isStreaming, sendMessage]);

    const handleImageChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void attachImage(file);
        },
        [attachImage],
    );

    useEffect(() => {
        if (!isStreaming) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            stopStreaming();
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isStreaming, stopStreaming]);

    const handleSuggestionTap = useCallback(
        (text: string) => {
            lastUserMessageRef.current = { text, imageDataUrl: "" };
            void sendMessage(text);
        },
        [sendMessage],
    );

    const handleNewChat = useCallback(() => {
        const startNewChat = () => {
            clearChat();
            setEditingMessageIndex(null);
            setEditingMessageValue("");
            setShowSessionList(false);
            clearImage();
        };

        if (messages.length > 0) {
            void toast
                .ask({
                    title: "Start a new conversation?",
                    message: "The current chat will be saved.",
                    confirmLabel: "New chat",
                    tone: "default",
                })
                .then((confirmed) => {
                    if (confirmed) startNewChat();
                });
            return;
        }
        startNewChat();
    }, [messages.length, clearChat, clearImage, toast]);

    const handleToggleSessionList = useCallback(() => {
        setShowSessionList((prev) => !prev);
    }, []);

    const handleSelectSession = useCallback(
        (sessionId: string) => {
            loadSession(sessionId);
            setEditingMessageIndex(null);
            setEditingMessageValue("");
            setShowSessionList(false);
            clearImage();
        },
        [clearImage, loadSession],
    );

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        input.style.height = "auto";
        const maxHeight = Number.parseFloat(getComputedStyle(input).maxHeight);
        input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    }, [inputValue]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend],
    );

    const handleRetry = useCallback(() => {
        const lastMessage = lastUserMessageRef.current;
        if (lastMessage) {
            void sendMessage(lastMessage.text, lastMessage.imageDataUrl);
        }
    }, [sendMessage]);

    const handleStartEditMessage = useCallback((index: number, content: string) => {
        setEditingMessageIndex(index);
        setEditingMessageValue(content);
    }, []);

    const handleCancelEditMessage = useCallback(() => {
        setEditingMessageIndex(null);
        setEditingMessageValue("");
    }, []);

    const handleSaveEditedMessage = useCallback(
        (index: number) => {
            const text = editingMessageValue.trim();
            if (!text) return;

            void toast
                .ask({
                    title: "Regenerate from this message?",
                    message:
                        "Editing this message will remove all later replies.",
                    confirmLabel: "Regenerate",
                    tone: "default",
                })
                .then((confirmed) => {
                    if (!confirmed) return;
                    lastUserMessageRef.current = {
                        text,
                        imageDataUrl: messages[index]?.imageDataUrl ?? "",
                    };
                    setEditingMessageIndex(null);
                    setEditingMessageValue("");
                    void editUserMessageAndRegenerate(index, text);
                });
        },
        [editingMessageValue, editUserMessageAndRegenerate, messages, toast],
    );

    const handleMealTypeToggle = useCallback(
        (value: MealType) => {
            setMealType((prev: MealType | null) =>
                prev === value ? null : value,
            );
        },
        [setMealType],
    );

    const handleMealSizeToggle = useCallback(
        (value: MealSize) => {
            setMealSize((prev: MealSize | null) =>
                prev === value ? null : value,
            );
        },
        [setMealSize],
    );

    // The input remains available when the LLM is not configured so users can
    // still paste recipe URLs for non-AI JSON-LD import.
    const hasMessages = messages.length > 0;
    const showMealControls = !hasMessages;

    return (
        <div style={styles.root}>
            {renderHeader(
                handleNewChat,
                hasMessages,
                handleToggleSessionList,
                showSessionList,
            )}
            {showSessionList ? (
                <div style={styles.messageArea}>
                    <ChatSessionList
                        onSelectSession={handleSelectSession}
                        currentSessionId={currentSessionId}
                    />
                </div>
            ) : (
                <div
                    ref={messageAreaRef}
                    onScroll={handleMessageAreaScroll}
                    style={styles.messageArea}
                >
                    {!hasMessages ? (
                        renderEmptyState(
                            handleSuggestionTap,
                            isConfigured,
                            onNavigateToSettings,
                        )
                    ) : (
                        <div style={styles.messageList}>
                            {messages.map((msg, i) => {
                                const isLastMsg = i === messages.length - 1;
                                const isActivelyStreaming =
                                    isStreaming && isLastMsg;
                                const showActionBtns =
                                    msg.role === "assistant" &&
                                    msg.content !== "" &&
                                    !isActivelyStreaming;
                                const action =
                                    actionStates[i] ?? defaultActionState;

                                return (
                                    <div
                                        key={i}
                                        style={
                                            msg.role === "user"
                                                ? styles.userRow
                                                : styles.asstRow
                                        }
                                    >
                                        {msg.role === "assistant" ? (
                                            <div
                                                style={styles.asstMessageColumn}
                                            >
                                                <div style={styles.asstBubble}>
                                                    <Markdown
                                                        content={msg.content}
                                                    />
                                                    {msg.content === "" &&
                                                        isStreaming && (
                                                            <span
                                                                style={
                                                                    styles.typing
                                                                }
                                                            >
                                                                ●●●
                                                            </span>
                                                        )}
                                                </div>
                                                {showActionBtns && (
                                                    <div
                                                        style={styles.actionRow}
                                                    >
                                                        {action.save ===
                                                            "idle" && (
                                                            <button
                                                                type="button"
                                                                style={
                                                                    styles.saveBtn
                                                                }
                                                                onClick={() =>
                                                                    void handleSaveRecipe(
                                                                        i,
                                                                    )
                                                                }
                                                            >
                                                                Save Current Recipe
                                                            </button>
                                                        )}
                                                        {action.save ===
                                                            "extracting" && (
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
                                                        {action.save ===
                                                            "saved" && (
                                                            <span
                                                                style={
                                                                    styles.savedLabel
                                                                }
                                                            >
                                                                <Icon
                                                                    name="check"
                                                                    size={14}
                                                                    strokeWidth={3}
                                                                />
                                                                Saved!
                                                            </span>
                                                        )}
                                                        {action.save ===
                                                            "error" && (
                                                            <div
                                                                style={
                                                                    styles.saveErrorRow
                                                                }
                                                            >
                                                                <span
                                                                    style={
                                                                        styles.saveErrorText
                                                                    }
                                                                >
                                                                    {action.saveError ??
                                                                        "Extraction failed."}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    style={
                                                                        styles.saveRetryBtn
                                                                    }
                                                                    onClick={() =>
                                                                        handleSaveRetry(
                                                                            i,
                                                                        )
                                                                    }
                                                                >
                                                                    Try Again
                                                                </button>
                                                            </div>
                                                        )}

                                                        {action.memory ===
                                                            "idle" && (
                                                            <button
                                                                type="button"
                                                                style={
                                                                    styles.memoryBtn
                                                                }
                                                                onClick={() =>
                                                                    void handleSaveMemory(
                                                                        i,
                                                                    )
                                                                }
                                                            >
                                                                <Icon
                                                                    name="brain"
                                                                    size={14}
                                                                />
                                                                Save to Memory
                                                            </button>
                                                        )}
                                                        {action.memory ===
                                                            "extracting" && (
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
                                                        {action.memory ===
                                                            "saved" && (
                                                            <span
                                                                style={
                                                                    styles.memorySavedLabel
                                                                }
                                                            >
                                                                <Icon
                                                                    name="check"
                                                                    size={14}
                                                                    strokeWidth={3}
                                                                />
                                                                Remembered!
                                                            </span>
                                                        )}
                                                        {action.memory ===
                                                            "error" && (
                                                            <div
                                                                style={
                                                                    styles.saveErrorRow
                                                                }
                                                            >
                                                                <span
                                                                    style={
                                                                        styles.saveErrorText
                                                                    }
                                                                >
                                                                    {action.memoryError ??
                                                                        "No preference found in this conversation."}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    style={
                                                                        styles.saveRetryBtn
                                                                    }
                                                                    onClick={() =>
                                                                        handleMemoryRetry(
                                                                            i,
                                                                        )
                                                                    }
                                                                >
                                                                    Try Again
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : editingMessageIndex === i ? (
                                            <div style={styles.userEditBubble}>
                                                <textarea
                                                    value={editingMessageValue}
                                                    onChange={(e) =>
                                                        setEditingMessageValue(
                                                            e.target.value,
                                                        )
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key ===
                                                                "Escape" ||
                                                            (e.key ===
                                                                "Enter" &&
                                                                !e.shiftKey)
                                                        ) {
                                                            e.preventDefault();
                                                            if (
                                                                e.key ===
                                                                "Escape"
                                                            ) {
                                                                handleCancelEditMessage();
                                                            } else {
                                                                handleSaveEditedMessage(
                                                                    i,
                                                                );
                                                            }
                                                        }
                                                    }}
                                                    style={styles.userEditInput}
                                                    rows={3}
                                                    autoFocus
                                                />
                                                <div style={styles.userEditActions}>
                                                    <button
                                                        type="button"
                                                        style={
                                                            styles.userEditCancelBtn
                                                        }
                                                        onClick={
                                                            handleCancelEditMessage
                                                        }
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        style={{
                                                            ...styles.userEditSaveBtn,
                                                            ...(!editingMessageValue.trim()
                                                                ? styles.userEditSaveBtnDisabled
                                                                : {}),
                                                        }}
                                                        disabled={
                                                            !editingMessageValue.trim()
                                                        }
                                                        onClick={() =>
                                                            handleSaveEditedMessage(
                                                                i,
                                                            )
                                                        }
                                                    >
                                                        Save & Regenerate
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={styles.userMessageColumn}>
                                                <div style={styles.userBubble}>
                                                    {msg.imageDataUrl && (
                                                        <img
                                                            src={msg.imageDataUrl}
                                                            alt="User attachment"
                                                            style={styles.messageImage}
                                                        />
                                                    )}
                                                    {msg.content && (
                                                        <span style={styles.msgText}>
                                                            {msg.content}
                                                        </span>
                                                    )}
                                                </div>
                                                {!isStreaming && msg.content && (
                                                    <button
                                                        type="button"
                                                        style={styles.editMessageBtn}
                                                        onClick={() =>
                                                            handleStartEditMessage(
                                                                i,
                                                                msg.content,
                                                            )
                                                        }
                                                    >
                                                        Edit
                                                    </button>
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

            {!showSessionList &&
                renderInputArea(
                    inputValue,
                    setInputValue,
                    handleKeyDown,
                    handleSend,
                    stopStreaming,
                    isStreaming,
                    mealType,
                    mealSize,
                    handleMealTypeToggle,
                    handleMealSizeToggle,
                    inputRef,
                    showMealControls,
                    canAttachImage,
                    imageAttachment,
                    isPreparingImage,
                    imageAttachmentError,
                    imageInputRef,
                    handleImageChange,
                    clearImage,
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
                            ...(sessionListOpen
                                ? styles.sessionsBtnActive
                                : {}),
                        }}
                        aria-label={
                            sessionListOpen ? "Hide sessions" : "Show sessions"
                        }
                    >
                        <Icon name="messageCircle" size={18} strokeWidth={2.25} />
                    </button>
                )}
                {showNewChat && (
                    <button
                        type="button"
                        onClick={onNewChat}
                        style={styles.newChatBtn}
                    >
                        New Chat
                    </button>
                )}
            </div>
        </div>
    );
}

function renderEmptyState(
    onTap: (text: string) => void,
    isConfigured: boolean,
    onNavigateToSettings: () => void,
) {
    return (
        <div style={styles.emptyState}>
            {!isConfigured && (
                <div style={styles.setupCard}>
                    <p style={styles.setupText}>
                        Set up your AI provider in Settings to chat, or paste a
                        recipe link below to import it.
                    </p>
                    <button
                        type="button"
                        onClick={onNavigateToSettings}
                        style={styles.goToSettingsButton}
                    >
                        Go to Settings
                    </button>
                </div>
            )}
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
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void,
    onSend: () => void,
    onStop: () => void,
    isStreaming: boolean,
    mealType: MealType | null,
    mealSize: MealSize | null,
    onMealType: (v: MealType) => void,
    onMealSize: (v: MealSize) => void,
    inputRef: React.RefObject<HTMLTextAreaElement | null>,
    showMealControls: boolean,
    canAttachImage: boolean,
    imageAttachment: ReturnType<typeof useImageAttachment>["attachment"],
    isPreparingImage: boolean,
    imageAttachmentError: string | null,
    imageInputRef: React.RefObject<HTMLInputElement | null>,
    onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
    onClearImage: () => void,
) {
    const sendDisabled = !isStreaming && ((!inputValue.trim() && !imageAttachment) || isPreparingImage);
    return (
        <div style={styles.inputArea}>
            {showMealControls && (
                <>
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
                </>
            )}
            {imageAttachment && (
                <div style={styles.imagePreviewRow}>
                    <img
                        src={imageAttachment.dataUrl}
                        alt={imageAttachment.name}
                        style={styles.imagePreview}
                    />
                    <span style={styles.imagePreviewName}>{imageAttachment.name}</span>
                    <button
                        type="button"
                        onClick={onClearImage}
                        style={styles.removeImageButton}
                        aria-label="Remove attached image"
                    >
                        <Icon name="x" size={16} strokeWidth={2.5} />
                    </button>
                </div>
            )}
            {imageAttachmentError && (
                <p style={styles.imageAttachmentError}>{imageAttachmentError}</p>
            )}
            <div style={styles.inputRow}>
                {canAttachImage && (
                    <>
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={onImageChange}
                            style={styles.hiddenFileInput}
                            disabled={isStreaming || isPreparingImage}
                        />
                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={isStreaming || isPreparingImage}
                            aria-label="Take or attach a photo"
                            style={{
                                ...styles.imageAttachButton,
                                ...(isPreparingImage ? styles.imageAttachButtonDisabled : {}),
                            }}
                        >
                            <Icon name="image" size={20} strokeWidth={2} />
                        </button>
                    </>
                )}
                <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Ask your cooking guru…"
                    style={styles.textInput}
                    disabled={isStreaming}
                    rows={1}
                />
                <button
                    type="button"
                    onClick={isStreaming ? onStop : onSend}
                    disabled={sendDisabled}
                    aria-label={isStreaming ? "Stop streaming response" : "Send message"}
                    style={{
                        ...styles.sendBtn,
                        ...(isStreaming ? styles.stopBtn : {}),
                        ...(sendDisabled ? styles.sendBtnDisabled : {}),
                    }}
                >
                    {isStreaming ? (
                        <>
                            <Icon name="x" size={16} strokeWidth={2.5} />
                            Stop
                        </>
                    ) : (
                        <>
                            <Icon name="send" size={16} strokeWidth={2.25} />
                            Send
                        </>
                    )}
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
        padding: "1rem 1.25rem",
        borderBottom: "1px solid rgba(255, 255, 255, 0.5)",
        background: "rgba(255, 255, 255, 0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: shadows.glass,
        flexShrink: 0,
    },
    headerTitle: {
        fontFamily: fonts.serif,
        fontSize: "1.5rem",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        color: colors.espresso,
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
        backgroundColor: colors.glass,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radii.sm,
        cursor: "pointer",
        minWidth: 40,
        minHeight: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        color: colors.stone600,
        boxShadow: shadows.glass,
    },
    sessionsBtnActive: {
        backgroundColor: colors.saffronTint,
        borderColor: colors.saffronTintBorder,
        color: colors.saffron,
    },
    newChatBtn: {
        padding: "0.5rem 0.875rem",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: colors.saffron,
        backgroundColor: colors.glass,
        border: `1px solid ${colors.saffronTintBorder}`,
        borderRadius: radii.sm,
        cursor: "pointer",
        whiteSpace: "nowrap" as const,
        minHeight: 40,
        boxShadow: shadows.glass,
    },
    messageArea: {
        flex: 1,
        overflowY: "auto",
        padding: "1rem 1.25rem",
        minHeight: 0,
    },
    messageList: {
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
    },
    userRow: { display: "flex", justifyContent: "flex-end" },
    asstRow: { display: "flex", justifyContent: "flex-start" },
    userMessageColumn: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        maxWidth: "80%",
        gap: "0.25rem",
    },
    asstMessageColumn: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        maxWidth: "80%",
        gap: "0.375rem",
    },
    userBubble: {
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "0.75rem 1rem",
        borderRadius: "16px 16px 4px 16px",
        backgroundColor: colors.saffronTint,
        border: `1px solid ${colors.saffronTintBorder}`,
        color: colors.espresso,
        fontSize: "0.9375rem",
        fontWeight: 500,
        lineHeight: 1.45,
        wordBreak: "break-word" as const,
        boxShadow: shadows.glass,
    },
    editMessageBtn: {
        padding: "0.125rem 0.375rem",
        fontSize: "0.75rem",
        fontWeight: 500,
        color: "#6b7280",
        backgroundColor: "transparent",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        minHeight: 26,
    },
    userEditBubble: {
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        width: "min(80%, 520px)",
        padding: "0.625rem",
        borderRadius: "16px 16px 4px 16px",
        backgroundColor: colors.saffronTint,
        border: `1px solid ${colors.saffronTintBorder}`,
    },
    userEditInput: {
        width: "100%",
        minHeight: 88,
        padding: "0.5rem 0.625rem",
        fontSize: "0.9375rem",
        lineHeight: 1.45,
        color: colors.espresso,
        backgroundColor: colors.white,
        border: `1px solid ${colors.saffronTintBorder}`,
        borderRadius: 10,
        resize: "vertical" as const,
        boxSizing: "border-box" as const,
        fontFamily: "inherit",
    },
    userEditActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "0.375rem",
    },
    userEditCancelBtn: {
        padding: "0.375rem 0.75rem",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: colors.stone700,
        backgroundColor: colors.white,
        border: `1px solid ${colors.stone300}`,
        borderRadius: 8,
        cursor: "pointer",
        minHeight: 34,
    },
    userEditSaveBtn: {
        padding: "0.375rem 0.75rem",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: colors.white,
        backgroundColor: colors.saffron,
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        minHeight: 34,
    },
    userEditSaveBtnDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    asstBubble: {
        padding: "0.75rem 1rem",
        borderRadius: "16px 16px 16px 4px",
        backgroundColor: colors.glass,
        border: `1px solid ${colors.glassBorder}`,
        color: colors.espresso,
        fontSize: "0.9375rem",
        lineHeight: 1.55,
        wordBreak: "break-word" as const,
        boxShadow: shadows.glass,
    },
    msgText: { whiteSpace: "pre-wrap" as const },
    messageImage: {
        display: "block",
        width: "100%",
        maxWidth: 280,
        maxHeight: 320,
        objectFit: "cover" as const,
        borderRadius: radii.sm,
    },
    typing: {
        display: "inline-block",
        marginLeft: "0.25rem",
        color: colors.stone400,
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
        fontFamily: fonts.serif,
        fontSize: "1.625rem",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        color: colors.espresso,
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
        color: colors.saffron,
        backgroundColor: colors.glass,
        border: `1px solid ${colors.saffronTintBorder}`,
        borderRadius: radii.pill,
        cursor: "pointer",
        whiteSpace: "nowrap" as const,
        minHeight: 44,
        boxShadow: shadows.glass,
    },
    setupCard: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        padding: "1.25rem",
        border: `1px solid ${colors.saffronTintBorder}`,
        borderRadius: radii.lg,
        backgroundColor: colors.saffronTint,
        maxWidth: 360,
        marginBottom: "1rem",
        boxShadow: shadows.glass,
    },
    setupText: {
        fontSize: "1rem",
        color: colors.stone600,
        textAlign: "center" as const,
        lineHeight: 1.5,
    },
    goToSettingsButton: {
        padding: "0.75rem 1.5rem",
        fontSize: "0.9375rem",
        fontWeight: 600,
        color: colors.white,
        backgroundColor: colors.saffron,
        border: "none",
        borderRadius: radii.md,
        cursor: "pointer",
        minHeight: 48,
        boxShadow: shadows.glassLg,
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
        padding: "0.75rem 1.25rem 1rem",
        borderTop: "1px solid rgba(255, 255, 255, 0.5)",
        background: "rgba(255, 255, 255, 0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: shadows.glassLg,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
    },
    pillRow: {
        display: "flex",
        gap: "0.375rem",
        alignItems: "center",
        flexWrap: "wrap" as const,
    },
    pillLabel: {
        fontSize: "0.75rem",
        fontWeight: 600,
        color: colors.stone600,
        marginRight: "0.125rem",
    },
    pill: {
        padding: "0.375rem 0.75rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: colors.stone600,
        backgroundColor: colors.glass,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: 14,
        cursor: "pointer",
        minHeight: 32,
        lineHeight: "1.4",
        boxShadow: shadows.glass,
    },
    pillActive: {
        color: colors.saffron,
        backgroundColor: colors.saffronTint,
        borderColor: colors.saffronTintBorder,
    },
    imagePreviewRow: {
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.5rem",
        backgroundColor: colors.glass,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radii.md,
        boxShadow: shadows.glass,
    },
    imagePreview: {
        width: 56,
        height: 56,
        objectFit: "cover" as const,
        borderRadius: radii.sm,
        flexShrink: 0,
    },
    imagePreviewName: {
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
        fontSize: "0.8125rem",
        color: colors.stone700,
    },
    removeImageButton: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        padding: 0,
        color: colors.stone600,
        backgroundColor: "transparent",
        border: "none",
        borderRadius: radii.sm,
        cursor: "pointer",
        flexShrink: 0,
    },
    imageAttachmentError: {
        margin: 0,
        fontSize: "0.8125rem",
        color: colors.danger,
    },
    hiddenFileInput: { display: "none" },
    imageAttachButton: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        padding: 0,
        color: colors.saffron,
        backgroundColor: colors.glass,
        border: `1px solid ${colors.saffronTintBorder}`,
        borderRadius: radii.md,
        boxShadow: shadows.glass,
        cursor: "pointer",
        flexShrink: 0,
    },
    imageAttachButtonDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    inputRow: { display: "flex", gap: "0.5rem", alignItems: "flex-end" },
    textInput: {
        flex: 1,
        padding: "0.75rem 1rem",
        fontSize: "1rem",
        lineHeight: 1.5,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radii.md,
        backgroundColor: colors.glass,
        color: colors.espresso,
        minWidth: 0,
        minHeight: 44,
        maxHeight: "calc(1.5em * 6 + 1.25rem)",
        overflowY: "auto" as const,
        resize: "none" as const,
        boxSizing: "border-box" as const,
        fontFamily: "inherit",
        boxShadow: shadows.glass,
    },
    sendBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.375rem",
        padding: "0.75rem 1.25rem",
        fontSize: "0.9375rem",
        fontWeight: 600,
        color: colors.white,
        backgroundColor: colors.saffron,
        border: "none",
        borderRadius: radii.md,
        cursor: "pointer",
        whiteSpace: "nowrap" as const,
        flexShrink: 0,
        minHeight: 44,
        boxShadow: shadows.glassLg,
    },
    stopBtn: {
        backgroundColor: colors.danger,
    },
    sendBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },

    // Action buttons row (below assistant bubble)
    actionRow: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "0.375rem",
        alignItems: "center",
    },
    // Save Recipe button styles
    saveBtn: {
        padding: "0.5rem 0.875rem",
        fontSize: "0.8125rem",
        fontWeight: 500,
        color: colors.saffron,
        backgroundColor: colors.glass,
        border: `1px solid ${colors.saffronTintBorder}`,
        borderRadius: radii.md,
        cursor: "pointer",
        minHeight: 32,
        whiteSpace: "nowrap" as const,
        boxShadow: shadows.glass,
    },
    saveBtnDisabled: {
        opacity: 0.6,
        cursor: "not-allowed",
    },
    savedLabel: {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: colors.success,
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

    // "Save to Memory" button styles
    memoryBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.25rem",
        padding: "0.5rem 0.875rem",
        fontSize: "0.8125rem",
        fontWeight: 500,
        color: colors.roseText,
        backgroundColor: colors.roseTint,
        border: `1px solid ${colors.roseTintBorder}`,
        borderRadius: radii.md,
        cursor: "pointer",
        minHeight: 32,
        whiteSpace: "nowrap" as const,
        boxShadow: shadows.glass,
    },
    memoryBtnDisabled: {
        opacity: 0.6,
        cursor: "not-allowed",
    },
    memorySavedLabel: {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: colors.success,
    },
};
