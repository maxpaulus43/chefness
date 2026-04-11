import { BottomNavBar, type Tab } from "@/components/BottomNavBar";
import { useState } from "react";

export function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div style={styles.root}>
      <div style={styles.content}>{renderTab(activeTab)}</div>
      <BottomNavBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

function renderTab(tab: Tab) {
  switch (tab) {
    case "chat":
      return <div>Chat view coming soon</div>;
    case "recipes":
      return (
        <p style={styles.emptyState}>
          No saved recipes yet. Chat with your cooking guru and save recipes you
          like!
        </p>
      );
    case "history":
      return (
        <p style={styles.emptyState}>
          No cooking history yet. Chat with your guru, cook something great, and
          log it here!
        </p>
      );
    case "settings":
      return <div>Settings coming soon</div>;
  }
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
