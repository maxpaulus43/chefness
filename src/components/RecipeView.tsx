import { useCallback, useState } from "react";
import { RecipeEditView } from "./RecipeEditView";
import { RecipeDetailView } from "./RecipeDetailView";
import { RecipeListView } from "./RecipeListView";

type RecipeViewMode = "list" | "detail" | "edit";

export default function RecipeView() {
    const [recipeViewMode, setRecipeViewMode] =
        useState<RecipeViewMode>("list");
    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(
        null,
    );

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
}
