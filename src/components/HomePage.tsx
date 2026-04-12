import { BottomNavBar, type Tab } from "@/components/BottomNavBar";
import { ChatView } from "@/components/ChatView";
import { RecipeListView } from "@/components/RecipeListView";
import { SettingsView } from "@/components/SettingsView";
import { useState, useCallback } from "react";

export function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const navigateToSettings = useCallback(() => {
    setActiveTab("settings");
  }, []);

  const handleSelectRecipe = useCallback((id: string) => {
    setSelectedRecipeId(id);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedRecipeId(null);
  }, []);

  return (
    <div style={styles.root}>
      <div style={styles.content}>
        {activeTab === "chat" && (
          <ChatView onNavigateToSettings={navigateToSettings} />
        )}
        {activeTab === "recipes" && (
          selectedRecipeId ? (
            <div style={styles.detailPlaceholder}>
              <button
                type="button"
                style={styles.backButton}
                onClick={handleBackToList}
              >
                ← Back
              </button>
              <p style={styles.detailText}>
                Recipe detail for {selectedRecipeId} — coming soon
              </p>
            </div>
          ) : (
            <RecipeListView onSelectRecipe={handleSelectRecipe} />
          )
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
  detailPlaceholder: {
    padding: "1.5rem 1rem",
    maxWidth: 600,
    margin: "0 auto",
  },
  backButton: {
    padding: "0.5rem 0.875rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 44,
    marginBottom: "1rem",
  },
  detailText: {
    fontSize: "1rem",
    color: "#374151",
    lineHeight: 1.5,
  },
};
