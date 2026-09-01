import { colors, fonts, shadows, radii } from "@/theme";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useToast } from "@/hooks/useToast";
import type { ChatSession } from "@/types/chat-session";
import { useCallback } from "react";
import DeleteButton from "./DeleteButton";

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
  onDeleteAll: () => void;
  currentSessionId: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatSessionList({
  onSelectSession,
  onDeleteAll,
  currentSessionId,
}: ChatSessionListProps) {
  const { sessions, isLoading, deleteSession, deleteAllSessions } =
    useChatSessions();
  const toast = useToast();

  const handleDelete = useCallback(
    (e: React.MouseEvent, session: ChatSession) => {
      e.stopPropagation();
      void toast
        .ask({
          title: `Delete "${session.title}"?`,
          message: "This cannot be undone.",
          confirmLabel: "Delete",
          tone: "danger",
        })
        .then((confirmed) => {
          if (confirmed) deleteSession(session.id);
        });
    },
    [deleteSession, toast],
  );

  const handleDeleteAll = useCallback(() => {
    void toast
      .ask({
        title: "Delete all conversations?",
        message: "This cannot be undone.",
        confirmLabel: "Delete All",
        tone: "danger",
      })
      .then((confirmed) => {
        if (confirmed) void deleteAllSessions().then(onDeleteAll);
      });
  }, [deleteAllSessions, onDeleteAll, toast]);

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
          <p style={styles.emptyText}>No conversations yet. Start chatting!</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>Chat History</h2>
        <button
          type="button"
          onClick={handleDeleteAll}
          style={styles.deleteAllBtn}
        >
          Delete All Chats
        </button>
      </div>
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
                  <span style={styles.cardTitle}>{session.title}</span>
                  <span style={styles.cardDate}>
                    {formatSessionDate(session.updatedAt)}
                  </span>
                </div>
                {preview && <span style={styles.cardPreview}>{preview}</span>}
              </div>
              <DeleteButton onDelete={(e) => handleDelete(e, session)} />
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
    borderBottom: `1px solid ${colors.glassBorder}`,
    flexShrink: 0,
  },
  headerTitle: {
    fontFamily: fonts.serif,
    fontSize: "1.125rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: colors.espresso,
    margin: 0,
  },
  deleteAllBtn: {
    padding: "0.5rem 0.875rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: colors.danger,
    backgroundColor: colors.dangerTint,
    border: `1px solid ${colors.dangerTintBorder}`,
    borderRadius: radii.sm,
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
    backgroundColor: colors.glass,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.md,
    boxShadow: shadows.glass,
    cursor: "pointer",
    textAlign: "left" as const,
    minHeight: 44,
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    fontSize: "inherit",
  },
  cardActive: {
    borderColor: colors.saffron,
    backgroundColor: colors.saffronTint,
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
    color: colors.espresso,
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
    color: colors.stone600,
    lineHeight: 1.4,
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  cardPreview: {
    fontSize: "0.8125rem",
    color: colors.stone600,
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
    color: colors.stone400,
    cursor: "pointer",
    flexShrink: 0,
    borderRadius: radii.sm,
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
    color: colors.stone600,
    fontSize: "0.9375rem",
  },
  emptyText: {
    textAlign: "center" as const,
    color: colors.stone600,
    fontSize: "0.9375rem",
    lineHeight: 1.5,
    maxWidth: 320,
  },
};
