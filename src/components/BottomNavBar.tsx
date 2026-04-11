export type Tab = "chat" | "recipes" | "history" | "settings";

const tabs: readonly { id: Tab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "recipes", label: "Recipes" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
] as const;

interface BottomNavBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomNavBar({ activeTab, onTabChange }: BottomNavBarProps) {
  return (
    <nav style={styles.nav}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          style={{
            ...styles.item,
            color: id === activeTab ? "#3b82f6" : "#6b7280",
          }}
          onClick={() => onTabChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    width: "100%",
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    background: "#fff",
    borderTop: "1px solid #e5e7eb",
    zIndex: 1000,
  },
  item: {
    flex: 1,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "0.75rem",
    color: "#6b7280",
    fontWeight: 500,
  },
};
