import { BottomNavBar, type Tab } from "@/components/BottomNavBar";
import { ChatView } from "@/components/ChatView";
import { RecipeDetailView } from "@/components/RecipeDetailView";
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
            <RecipeDetailView
              recipeId={selectedRecipeId}
              onBack={handleBackToList}
            />
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
};
