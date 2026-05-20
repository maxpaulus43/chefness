import { editRecipeWithPrompt } from "@/lib/recipe-extractor";
import type { Recipe, CreateRecipeInput } from "@/types/recipe";
import { useState } from "react";
import { useRecipes } from "@/hooks/useRecipes";
import { useSettings } from "@/hooks/useSettings";

type AiEditStatus = "idle" | "generating" | "preview" | "applying" | "applied" | "error";

export function useRecipeAiEditor() {
  const { updateRecipeAsync } = useRecipes();
  const {
    effectiveProvider,
    effectiveModel,
    effectiveApiKey,
    isConfigured,
  } = useSettings();

  const [status, setStatus] = useState<AiEditStatus>("idle");
  const [draftRecipe, setDraftRecipe] = useState<CreateRecipeInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateEdit = async (recipe: Recipe, instruction: string) => {
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) {
      setStatus("error");
      setError("Enter an edit request first.");
      return null;
    }

    if (!isConfigured) {
      setStatus("error");
      setError("Set up your AI provider in Settings before using AI edits.");
      return null;
    }

    setStatus("generating");
    setError(null);
    setDraftRecipe(null);

    try {
      const editedRecipe = await editRecipeWithPrompt({
        recipe,
        instruction: trimmedInstruction,
        providerId: effectiveProvider,
        modelId: effectiveModel,
        apiKey: effectiveApiKey,
      });
      setDraftRecipe(editedRecipe);
      setStatus("preview");
      return editedRecipe;
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to edit recipe with AI.";
      setStatus("error");
      setError(errMsg);
      return null;
    }
  };

  const applyEdit = async (recipeId: string) => {
    if (!draftRecipe) {
      setStatus("error");
      setError("Generate an AI edit before applying changes.");
      return;
    }

    setStatus("applying");
    setError(null);

    try {
      await updateRecipeAsync({ id: recipeId, ...draftRecipe });
      setDraftRecipe(null);
      setStatus("applied");
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to apply recipe changes.";
      setStatus("error");
      setError(errMsg);
    }
  };

  const reset = () => {
    setStatus("idle");
    setDraftRecipe(null);
    setError(null);
  };

  return {
    status,
    draftRecipe,
    error,
    isConfigured,
    generateEdit,
    applyEdit,
    reset,
  } as const;
}
