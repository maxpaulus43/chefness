import { useChatSessions } from "@/hooks/useChatSessions";
import type { ChatSession } from "@/types/chat-session";
import { useCallback } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSessionDate(isoDate: string): string {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 1,
    );
    const sessionDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );

    if (sessionDay.getTime() === today.getTime()) return "Today";
    if (sessionDay.getTime() === yesterday.getTime()) return "Yesterday";

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(date);
}

function truncatePreview(content: string, maxLength = 60): string {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength).trimEnd() + "…";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatSessionListProps {
    onSelectSession: (id: string) => void;
    currentSessionId: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatSessionList({
    onSelectSession,
    currentSessionId,
}: ChatSessionListProps) {
    const { sessions, isLoading, deleteSession } = useChatSessions();

    const handleDelete = useCallback(
        (e: React.MouseEvent, session: ChatSession) => {
            e.stopPropagation();
            const confirmed = window.confirm(
                `Delete "${session.title}"? This cannot be undone.`,
            );
            if (confirmed) {
                deleteSession(session.id);
            }
        },
        [deleteSession],
    );

    if (isLoading) {
        return (
            <div style={styles.container}>
                <div style={styles.centered}>
                    <p style={styles.loadingText}>Loading conversations…</p>
                </div>
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div style={styles.container}>
                <div style={styles.centered}>
                    <p style={styles.emptyText}>
                        No conversations yet. Start chatting!
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.list}>
                {sessions.map((session) => {
                    const isActive = session.id === currentSessionId;
                    const lastMessage =
                        session.messages.length > 0
                            ? session.messages[session.messages.length - 1]
                            : null;
                    const preview = lastMessage
                        ? truncatePreview(lastMessage.content)
                        : "";

                    return (
                        <button
                            key={session.id}
                            type="button"
                            style={{
                                ...styles.card,
                                ...(isActive ? styles.cardActive : {}),
                            }}
                            onClick={() => onSelectSession(session.id)}
                        >
                            <div style={styles.cardContent}>
                                <div style={styles.cardTop}>
                                    <span style={styles.cardTitle}>
                                        {session.title}
                                    </span>
                                    <span style={styles.cardDate}>
                                        {formatSessionDate(session.updatedAt)}
                                    </span>
                                </div>
                                {preview && (
                                    <span style={styles.cardPreview}>
                                        {preview}
                                    </span>
                                )}
                            </div>
                            <div
                                style={styles.deleteBtn}
                                role="button"
                                tabIndex={0}
                                aria-label={`Delete "${session.title}"`}
                                onClick={(e) => handleDelete(e, session)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        handleDelete(
                                            e as unknown as React.MouseEvent,
                                            session,
                                        );
                                    }
                                }}
                            >
                                ×
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
    container: {
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
        flexShrink: 0,
    },
    headerTitle: {
        fontSize: "1.125rem",
        fontWeight: 700,
        color: "#111827",
        margin: 0,
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
    list: {
        flex: 1,
        overflowY: "auto",
        padding: "0.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
    },
    card: {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        width: "100%",
        padding: "0.75rem 1rem",
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left" as const,
        minHeight: 44,
        boxSizing: "border-box" as const,
        fontFamily: "inherit",
        fontSize: "inherit",
    },
    cardActive: {
        borderColor: "#3b82f6",
        backgroundColor: "#eff6ff",
    },
    cardContent: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        minWidth: 0,
    },
    cardTop: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "0.5rem",
    },
    cardTitle: {
        fontSize: "0.9375rem",
        fontWeight: 600,
        color: "#111827",
        lineHeight: 1.4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
        flex: 1,
        minWidth: 0,
    },
    cardDate: {
        fontSize: "0.75rem",
        fontWeight: 400,
        color: "#6b7280",
        lineHeight: 1.4,
        whiteSpace: "nowrap" as const,
        flexShrink: 0,
    },
    cardPreview: {
        fontSize: "0.8125rem",
        color: "#6b7280",
        lineHeight: 1.4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
    },
    deleteBtn: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 44,
        minHeight: 44,
        fontSize: "1.25rem",
        fontWeight: 700,
        color: "#9ca3af",
        cursor: "pointer",
        flexShrink: 0,
        borderRadius: 8,
        userSelect: "none" as const,
    },
    centered: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
    },
    loadingText: {
        textAlign: "center" as const,
        color: "#6b7280",
        fontSize: "0.9375rem",
    },
    emptyText: {
        textAlign: "center" as const,
        color: "#6b7280",
        fontSize: "0.9375rem",
        lineHeight: 1.5,
        maxWidth: 320,
    },
};
