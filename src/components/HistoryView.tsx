import { useCookingLog } from "@/hooks/useCookingLog";
import type { CookingLogEntry } from "@/types/cooking-log";
import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEntryDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year == null || month == null || day == null) return isoDate;

  const entryDate = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  );

  if (entryDate.getTime() === today.getTime()) return "Today";
  if (entryDate.getTime() === yesterday.getTime()) return "Yesterday";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(entryDate);
}

// ---------------------------------------------------------------------------
// Sub-component: Entry Card
// ---------------------------------------------------------------------------

interface EntryCardProps {
  entry: CookingLogEntry;
  onUpdateRating: (id: string, rating: "up" | "down" | null) => void;
  onUpdateComment: (id: string, comment: string) => void;
  onDelete: (id: string) => void;
}

function EntryCard({
  entry,
  onUpdateRating,
  onUpdateComment,
  onDelete,
}: EntryCardProps) {
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentDraft, setCommentDraft] = useState(entry.comment);

  const handleToggleRating = useCallback(
    (value: "up" | "down") => {
      onUpdateRating(entry.id, entry.rating === value ? null : value);
    },
    [entry.id, entry.rating, onUpdateRating],
  );

  const handleOpenCommentEditor = useCallback(() => {
    setCommentDraft(entry.comment);
    setIsEditingComment(true);
  }, [entry.comment]);

  const handleSaveComment = useCallback(() => {
    onUpdateComment(entry.id, commentDraft);
    setIsEditingComment(false);
  }, [entry.id, commentDraft, onUpdateComment]);

  const handleCancelComment = useCallback(() => {
    setIsEditingComment(false);
    setCommentDraft(entry.comment);
  }, [entry.comment]);

  const handleDelete = useCallback(() => {
    if (window.confirm(`Delete "${entry.title}" from your cooking history?`)) {
      onDelete(entry.id);
    }
  }, [entry.id, entry.title, onDelete]);

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardHeaderLeft}>
          <span style={styles.cardTitle}>{entry.title}</span>
          <span style={styles.cardDate}>{formatEntryDate(entry.date)}</span>
        </div>
        <button
          type="button"
          style={styles.deleteButton}
          onClick={handleDelete}
          aria-label="Delete entry"
        >
          🗑️
        </button>
      </div>

      <div style={styles.ratingRow}>
        <button
          type="button"
          style={{
            ...styles.ratingButton,
            ...(entry.rating === "up" ? styles.ratingUpActive : {}),
          }}
          onClick={() => handleToggleRating("up")}
          aria-label="Thumbs up"
          aria-pressed={entry.rating === "up"}
        >
          👍
        </button>
        <button
          type="button"
          style={{
            ...styles.ratingButton,
            ...(entry.rating === "down" ? styles.ratingDownActive : {}),
          }}
          onClick={() => handleToggleRating("down")}
          aria-label="Thumbs down"
          aria-pressed={entry.rating === "down"}
        >
          👎
        </button>
      </div>

      {isEditingComment ? (
        <div style={styles.commentEditor}>
          <textarea
            style={styles.commentTextarea}
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Add a note…"
            rows={3}
            autoFocus
          />
          <div style={styles.commentActions}>
            <button
              type="button"
              style={styles.commentSaveButton}
              onClick={handleSaveComment}
            >
              Save
            </button>
            <button
              type="button"
              style={styles.commentCancelButton}
              onClick={handleCancelComment}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.commentSection}>
          {entry.comment ? (
            <p style={styles.commentText}>{entry.comment}</p>
          ) : null}
          <button
            type="button"
            style={styles.commentToggle}
            onClick={handleOpenCommentEditor}
          >
            {entry.comment ? "Edit note" : "Add note"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HistoryView() {
  const { entries, isLoading, error, updateEntry, deleteEntry } =
    useCookingLog();

  const handleUpdateRating = useCallback(
    (id: string, rating: "up" | "down" | null) => {
      updateEntry({ id, rating });
    },
    [updateEntry],
  );

  const handleUpdateComment = useCallback(
    (id: string, comment: string) => {
      updateEntry({ id, comment });
    },
    [updateEntry],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteEntry(id);
    },
    [deleteEntry],
  );

  if (isLoading) {
    return (
      <div style={styles.centered}>
        <p style={styles.loadingText}>Loading cooking history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.centered}>
        <p style={styles.errorText}>
          Failed to load cooking history. Please try again later.
        </p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={styles.centered}>
        <p style={styles.emptyText}>
          No cooking history yet. Chat with your guru, cook something great, and
          log it here!
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>History</h1>
      <div style={styles.list}>
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onUpdateRating={handleUpdateRating}
            onUpdateComment={handleUpdateComment}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "1.5rem 1rem",
    maxWidth: 600,
    margin: "0 auto",
    minWidth: 0,
  },
  header: {
    fontSize: "1.5rem",
    fontWeight: 700,
    margin: "0 0 1rem",
    color: "#111827",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.875rem 1rem",
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    width: "100%",
    boxSizing: "border-box" as const,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "0.5rem",
  },
  cardHeaderLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "0.125rem",
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
    lineHeight: 1.4,
  },
  cardDate: {
    fontSize: "0.8125rem",
    fontWeight: 400,
    color: "#6b7280",
    lineHeight: 1.4,
  },
  deleteButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1.125rem",
    padding: "0.375rem",
    minWidth: 44,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    flexShrink: 0,
  },
  ratingRow: {
    display: "flex",
    gap: "0.5rem",
  },
  ratingButton: {
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: "1.25rem",
    minWidth: 44,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.375rem 0.75rem",
    transition: "background 0.15s, border-color 0.15s",
  },
  ratingUpActive: {
    background: "#dcfce7",
    borderColor: "#22c55e",
  },
  ratingDownActive: {
    background: "#fee2e2",
    borderColor: "#ef4444",
  },
  commentSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  commentText: {
    fontSize: "0.875rem",
    color: "#374151",
    lineHeight: 1.5,
    margin: 0,
    whiteSpace: "pre-wrap" as const,
  },
  commentToggle: {
    background: "none",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: "0.8125rem",
    fontWeight: 500,
    padding: "0.25rem 0",
    textAlign: "left" as const,
    alignSelf: "flex-start",
    minHeight: 44,
    display: "flex",
    alignItems: "center",
  },
  commentEditor: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  commentTextarea: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "0.5rem",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    resize: "vertical" as const,
    lineHeight: 1.5,
    minHeight: 60,
  },
  commentActions: {
    display: "flex",
    gap: "0.5rem",
  },
  commentSaveButton: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "0.5rem 1rem",
    minHeight: 44,
  },
  commentCancelButton: {
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: "0.8125rem",
    fontWeight: 500,
    padding: "0.5rem 1rem",
    minHeight: 44,
  },
  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    minHeight: 200,
  },
  loadingText: {
    textAlign: "center" as const,
    color: "#6b7280",
    fontSize: "0.9375rem",
  },
  errorText: {
    textAlign: "center" as const,
    color: "#dc2626",
    fontSize: "0.9375rem",
    lineHeight: 1.5,
  },
  emptyText: {
    textAlign: "center" as const,
    color: "#6b7280",
    fontSize: "0.9375rem",
    lineHeight: 1.5,
    maxWidth: 320,
  },
};

