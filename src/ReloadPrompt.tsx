import { useRegisterSW } from "virtual:pwa-register/react";

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      console.log("SW registered:", registration);
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  function close() {
    setOfflineReady(false);
    setNeedRefresh(false);
  }

  if (!offlineReady && !needRefresh) return null;

  return (
    <div style={styles.container}>
      <div style={styles.toast}>
        <p style={styles.message}>
          {offlineReady
            ? "App ready to work offline."
            : "New content available. Click reload to update."}
        </p>
        <div style={styles.actions}>
          {needRefresh && (
            <button
              style={styles.reloadButton}
              onClick={() => updateServiceWorker(true)}
            >
              Reload
            </button>
          )}
          <button style={styles.closeButton} onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: "1rem",
    right: "1rem",
    zIndex: 9999,
  },
  toast: {
    background: "#1f2937",
    color: "#f9fafb",
    borderRadius: "0.5rem",
    padding: "1rem 1.25rem",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    maxWidth: "22rem",
  },
  message: {
    margin: 0,
    fontSize: "0.875rem",
    lineHeight: 1.4,
  },
  actions: {
    display: "flex",
    gap: "0.5rem",
    justifyContent: "flex-end",
  },
  reloadButton: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "0.375rem",
    padding: "0.375rem 0.75rem",
    cursor: "pointer",
    fontSize: "0.8125rem",
    fontWeight: 600,
  },
  closeButton: {
    background: "transparent",
    color: "#9ca3af",
    border: "1px solid #4b5563",
    borderRadius: "0.375rem",
    padding: "0.375rem 0.75rem",
    cursor: "pointer",
    fontSize: "0.8125rem",
  },
};

export default ReloadPrompt;
