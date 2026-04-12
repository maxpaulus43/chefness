import { BottomNavBar, type Tab } from "@/components/BottomNavBar";
import { ChatView } from "@/components/ChatView";
import { RecipeDetailView } from "@/components/RecipeDetailView";
import { RecipeEditView } from "@/components/RecipeEditView";
import { RecipeListView } from "@/components/RecipeListView";
import { SettingsView } from "@/components/SettingsView";
import { useState, useCallback } from "react";

type RecipeViewMode = "list" | "detail" | "edit";

export function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recipeViewMode, setRecipeViewMode] = useState<RecipeViewMode>("list");

  const navigateToSettings = useCallback(() => {
    setActiveTab("settings");
  }, []);

  const handleSelectRecipe = useCallback((id: string) => {
    setSelectedRecipeId(id);
    setRecipeViewMode("detail");
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedRecipeId(null);
    setRecipeViewMode("list");
  }, []);

  const handleEditRecipe = useCallback(() => {
    setRecipeViewMode("edit");
  }, []);

  const handleEditBack = useCallback(() => {
    setRecipeViewMode("detail");
  }, []);

  const handleEditSave = useCallback(() => {
    setRecipeViewMode("detail");
  }, []);

  const renderRecipesTab = () => {
    if (recipeViewMode === "edit" && selectedRecipeId) {
      return (
        <RecipeEditView
          recipeId={selectedRecipeId}
          onBack={handleEditBack}
          onSave={handleEditSave}
        />
      );
    }
    if (recipeViewMode === "detail" && selectedRecipeId) {
      return (
        <RecipeDetailView
          recipeId={selectedRecipeId}
          onBack={handleBackToList}
          onEdit={handleEditRecipe}
        />
      );
    }
    return <RecipeListView onSelectRecipe={handleSelectRecipe} />;
  };

  return (
    <div style={styles.root}>
      <div style={styles.content}>
        {activeTab === "chat" && (
          <ChatView onNavigateToSettings={navigateToSettings} />
        )}
        {activeTab === "recipes" && renderRecipesTab()}
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
