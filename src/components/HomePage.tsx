import { BottomNavBar, type Tab } from "@/components/BottomNavBar";
import { ChatView } from "@/components/ChatView";
import { HistoryView } from "@/components/HistoryView";
import { RecipeDetailView } from "@/components/RecipeDetailView";
import { RecipeEditView } from "@/components/RecipeEditView";
import { RecipeListView } from "@/components/RecipeListView";
import { SettingsView } from "@/components/SettingsView";
import { useOpenRouterOAuth } from "@/hooks/useOpenRouterOAuth";
import { useState, useCallback } from "react";

type RecipeViewMode = "list" | "detail" | "edit";

export function HomePage() {
  // Process OpenRouter OAuth callback (if redirected back with ?code=).
  // This must run inside TRPCProvider so useSettings() works.
  useOpenRouterOAuth();

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
        {activeTab === "history" && <HistoryView />}
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
};
