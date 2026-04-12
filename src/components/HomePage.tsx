import { BottomNavBar, type Tab } from "@/components/BottomNavBar";
import { ChatView } from "@/components/ChatView";
import { SettingsView } from "@/components/SettingsView";
import { useState, useCallback } from "react";

export function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  const navigateToSettings = useCallback(() => {
    setActiveTab("settings");
  }, []);

  return (
    <div style={styles.root}>
      <div style={styles.content}>
        {activeTab === "chat" && (
          <ChatView onNavigateToSettings={navigateToSettings} />
        )}
        {activeTab === "recipes" && (
          <p style={styles.emptyState}>
            No saved recipes yet. Chat with your cooking guru and save recipes
            you like!
          </p>
        )}
        {activeTab === "history" && (
          <p style={styles.emptyState}>
            No cooking history yet. Chat with your guru, cook something great,
            and log it here!
          </p>
        )}
        {activeTab === "settings" && <SettingsView />}
      </div>
      <BottomNavBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    paddingBottom: 56,
  },
  emptyState: {
    textAlign: "center",
    color: "#6b7280",
    padding: "2rem 1rem",
  },
};
