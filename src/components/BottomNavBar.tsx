import { colors, shadows } from "@/theme";
import { Icon, type IconName } from "@/components/Icon";

export type Tab = "chat" | "recipes" | "history" | "settings";

const tabs: readonly { id: Tab; label: string; icon: IconName }[] = [
  { id: "chat", label: "Chat", icon: "messageCircle" },
  { id: "recipes", label: "Recipes", icon: "bookOpen" },
  { id: "history", label: "History", icon: "clock" },
  { id: "settings", label: "Settings", icon: "settings" },
] as const;

interface BottomNavBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomNavBar({ activeTab, onTabChange }: BottomNavBarProps) {
  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>
        {tabs.map(({ id, label, icon }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              style={{
                ...styles.item,
                color: isActive ? colors.saffron : colors.stone500,
              }}
              onClick={() => onTabChange(id)}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                style={{ ...styles.icon, opacity: isActive ? 1 : 0.7 }}
                aria-hidden
              >
                <Icon name={icon} size={20} strokeWidth={2.25} />
              </span>
              <span style={styles.label}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    width: "100%",
    maxWidth: 480,
    margin: "0 auto",
    background: "rgba(255, 255, 255, 0.6)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderTop: "1px solid rgba(255, 255, 255, 0.5)",
    boxShadow: shadows.glass,
    zIndex: 1000,
  },
  inner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    padding: "0.5rem",
  },
  item: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.125rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0.375rem 0.5rem",
    borderRadius: 10,
    color: colors.stone500,
    fontWeight: 500,
    minHeight: 48,
  },
  icon: {
    fontSize: "1.125rem",
    lineHeight: 1,
  },
  label: {
    fontSize: "0.6875rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
  },
};
