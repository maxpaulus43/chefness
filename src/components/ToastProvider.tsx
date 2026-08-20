import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { colors, fonts, radii, shadows } from "@/theme";
import {
  ToastContext,
  type ToastApi,
  type ToastAskOptions,
  type ToastNotifyOptions,
  type ToastTone,
} from "@/contexts/toast-context";

type ToastItem =
  | (Required<Pick<ToastNotifyOptions, "message">> & {
      id: string;
      kind: "notify";
      title?: string;
      tone: ToastTone;
    })
  | (Required<Pick<ToastAskOptions, "message">> & {
      id: string;
      kind: "ask";
      title?: string;
      confirmLabel: string;
      cancelLabel: string;
      tone: ToastTone;
      resolve: (confirmed: boolean) => void;
    });

type AskToastItem = Extract<ToastItem, { kind: "ask" }>;

interface ToastProviderProps {
  children: ReactNode;
}

const DEFAULT_NOTIFY_DURATION_MS = 4200;

function normalizeNotifyOptions(
  options: ToastNotifyOptions | string,
): ToastNotifyOptions {
  return typeof options === "string" ? { message: options } : options;
}

function normalizeAskOptions(
  options: ToastAskOptions | string,
): ToastAskOptions {
  return typeof options === "string" ? { message: options } : options;
}

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getActiveAsk(items: ToastItem[]): AskToastItem | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.kind === "ask") return item;
  }

  return null;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef(new Map<string, number>());
  const activeAsk = getActiveAsk(items);

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (rawOptions: ToastNotifyOptions | string) => {
      const options = normalizeNotifyOptions(rawOptions);
      const id = createToastId();
      const durationMs = options.durationMs ?? DEFAULT_NOTIFY_DURATION_MS;

      setItems((current) => [
        ...current,
        {
          id,
          kind: "notify",
          title: options.title,
          message: options.message,
          tone: options.tone ?? "default",
        },
      ]);

      if (durationMs > 0) {
        const timer = window.setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  const ask = useCallback(
    (rawOptions: ToastAskOptions | string) => {
      const options = normalizeAskOptions(rawOptions);
      const id = createToastId();

      return new Promise<boolean>((resolve) => {
        const resolveAndDismiss = (confirmed: boolean) => {
          resolve(confirmed);
          dismiss(id);
        };

        setItems((current) => [
          ...current,
          {
            id,
            kind: "ask",
            title: options.title,
            message: options.message,
            confirmLabel: options.confirmLabel ?? "Confirm",
            cancelLabel: options.cancelLabel ?? "Cancel",
            tone: options.tone ?? "default",
            resolve: resolveAndDismiss,
          },
        ]);
      });
    },
    [dismiss],
  );

  const toast = useMemo<ToastApi>(
    () => ({ notify, ask, dismiss }),
    [ask, dismiss, notify],
  );

  useEffect(() => {
    if (!activeAsk) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      activeAsk.resolve(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeAsk]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {activeAsk ? (
        <button
          type="button"
          aria-label="Dismiss confirmation"
          style={styles.backdrop}
          onClick={() => activeAsk.resolve(false)}
        />
      ) : null}
      <div
        aria-live="polite"
        aria-relevant="additions removals"
        style={styles.viewport}
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const toneStyles = getToneStyles(item.tone);

  return (
    <div
      role={item.kind === "ask" ? "alertdialog" : "status"}
      aria-modal={item.kind === "ask" ? "true" : undefined}
      style={{ ...styles.card, borderColor: toneStyles.border }}
    >
      <div style={styles.contentRow}>
        <div
          aria-hidden="true"
          style={{ ...styles.accent, backgroundColor: toneStyles.accent }}
        />
        <div style={styles.content}>
          {item.title ? <p style={styles.title}>{item.title}</p> : null}
          <p style={styles.message}>{item.message}</p>
        </div>
        {item.kind === "notify" ? (
          <button
            type="button"
            aria-label="Dismiss notification"
            style={styles.closeButton}
            onClick={() => onDismiss(item.id)}
          >
            ×
          </button>
        ) : null}
      </div>
      {item.kind === "ask" ? (
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelButton}
            onClick={() => item.resolve(false)}
          >
            {item.cancelLabel}
          </button>
          <button
            type="button"
            style={{
              ...styles.confirmButton,
              backgroundColor: toneStyles.confirmBackground,
            }}
            onClick={() => item.resolve(true)}
          >
            {item.confirmLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function getToneStyles(tone: ToastTone) {
  if (tone === "danger") {
    return {
      accent: colors.danger,
      border: colors.dangerTintBorder,
      confirmBackground: colors.danger,
    };
  }

  if (tone === "success") {
    return {
      accent: colors.success,
      border: colors.successTintBorder,
      confirmBackground: colors.success,
    };
  }

  return {
    accent: colors.saffron,
    border: colors.saffronTintBorder,
    confirmBackground: colors.saffron,
  };
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 999,
    border: "none",
    padding: 0,
    margin: 0,
    backgroundColor: "rgba(42, 31, 26, 0.28)",
    backdropFilter: "blur(1px)",
    cursor: "default",
  },
  viewport: {
    position: "fixed",
    right: "max(1rem, env(safe-area-inset-right))",
    bottom: "max(1rem, env(safe-area-inset-bottom))",
    left: "max(1rem, env(safe-area-inset-left))",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    alignItems: "center",
    pointerEvents: "none",
  },
  card: {
    width: "min(100%, 420px)",
    padding: "0.875rem",
    borderRadius: radii.lg,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.glassStrong,
    boxShadow: shadows.glassXl,
    backdropFilter: "blur(18px)",
    pointerEvents: "auto",
  },
  contentRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
  },
  accent: {
    width: 6,
    alignSelf: "stretch",
    minHeight: 42,
    borderRadius: radii.pill,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    margin: "0 0 0.25rem",
    fontFamily: fonts.serif,
    color: colors.espresso,
    fontSize: "1rem",
    fontWeight: 700,
  },
  message: {
    margin: 0,
    color: colors.stone700,
    fontSize: "0.925rem",
    lineHeight: 1.45,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.glass,
    color: colors.stone600,
    fontSize: "1.25rem",
    lineHeight: 1,
    cursor: "pointer",
    flexShrink: 0,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.625rem",
    marginTop: "0.875rem",
  },
  cancelButton: {
    minHeight: 40,
    padding: "0 0.875rem",
    borderRadius: radii.pill,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.glass,
    color: colors.stone700,
    fontWeight: 700,
    cursor: "pointer",
  },
  confirmButton: {
    minHeight: 40,
    padding: "0 1rem",
    borderRadius: radii.pill,
    border: "none",
    color: colors.white,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: shadows.glass,
  },
};
