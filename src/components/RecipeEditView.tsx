import { useRecipes } from "@/hooks/useRecipes";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecipeEditViewProps {
  recipeId: string;
  onBack: () => void;
  onSave: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipeEditView({
  recipeId,
  onBack,
  onSave,
}: RecipeEditViewProps) {
  const { recipes, isLoading, error, updateRecipeAsync, isUpdating } =
    useRecipes();

  // Local form state — leads during editing, synced from hook data on load.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");

  const recipe = recipes.find((r) => r.id === recipeId);

  // Populate local state when recipe data becomes available.
  /* eslint-disable react-hooks/set-state-in-effect -- intentional: syncing local form state from fetched data */
  useEffect(() => {
    if (recipe) {
      setTitle(recipe.title);
      setDescription(recipe.description);
      setIngredientsText(recipe.ingredients.join("\n"));
      setStepsText(recipe.steps.join("\n"));
    }
  }, [recipe]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (isLoading) {
    return (
      <div style={styles.centered}>
        <p style={styles.loadingText}>Loading recipe…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <button type="button" style={styles.cancelButton} onClick={onBack}>
          ← Back
        </button>
        <div style={styles.centered}>
          <p style={styles.errorText}>
            Failed to load recipes. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div style={styles.container}>
        <button type="button" style={styles.cancelButton} onClick={onBack}>
          ← Back
        </button>
        <div style={styles.centered}>
          <p style={styles.notFoundText}>Recipe not found.</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    const ingredients = ingredientsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await updateRecipeAsync({
        id: recipeId,
        title: title.trim(),
        description: description.trim(),
        ingredients,
        steps,
      });
      onSave();
    } catch {
      // Mutation error is handled by TanStack Query; the button re-enables
      // via isUpdating going back to false so the user can retry.
    }
  };

  const isTitleValid = title.trim().length > 0;

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Edit Recipe</h1>

      <div style={styles.field}>
        <label htmlFor="edit-title" style={styles.label}>Title</label>
        <input
          id="edit-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Recipe title"
          style={styles.input}
        />
      </div>

      <div style={styles.field}>
        <label htmlFor="edit-description" style={styles.label}>Description</label>
        <textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description of the recipe"
          style={styles.textarea}
          rows={3}
        />
      </div>

      <div style={styles.field}>
        <label htmlFor="edit-ingredients" style={styles.label}>
          Ingredients (one per line)
        </label>
        <textarea
          id="edit-ingredients"
          value={ingredientsText}
          onChange={(e) => setIngredientsText(e.target.value)}
          placeholder={"1 cup flour\n2 eggs\n1/2 tsp salt"}
          style={styles.textarea}
          rows={6}
        />
      </div>

      <div style={styles.field}>
        <label htmlFor="edit-steps" style={styles.label}>
          Steps (one per line)
        </label>
        <textarea
          id="edit-steps"
          value={stepsText}
          onChange={(e) => setStepsText(e.target.value)}
          placeholder={"Mix dry ingredients\nAdd eggs and stir\nBake at 350°F"}
          style={styles.textarea}
          rows={6}
        />
      </div>

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.cancelButton}
          onClick={onBack}
          disabled={isUpdating}
        >
          Cancel
        </button>
        <button
          type="button"
          style={{
            ...styles.saveButton,
            opacity: !isTitleValid || isUpdating ? 0.5 : 1,
          }}
          onClick={handleSave}
          disabled={!isTitleValid || isUpdating}
        >
          {isUpdating ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "1.5rem 1rem 2rem",
    maxWidth: 600,
    margin: "0 auto",
    minWidth: 0,
  },
  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    minHeight: 200,
  },
  header: {
    fontSize: "1.5rem",
    fontWeight: 700,
    margin: "0 0 1.5rem",
    color: "#111827",
  },
  field: { marginBottom: "1.25rem" },
  label: {
    display: "block",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "0.375rem",
  },
  input: {
    width: "100%",
    padding: "0.625rem 0.75rem",
    fontSize: "1rem",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111827",
    boxSizing: "border-box" as const,
    minHeight: 44,
  },
  textarea: {
    width: "100%",
    padding: "0.625rem 0.75rem",
    fontSize: "1rem",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111827",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    lineHeight: 1.5,
    resize: "vertical" as const,
  },
  actions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1.5rem",
  },
  cancelButton: {
    flex: 1,
    padding: "0.75rem 1rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#374151",
    backgroundColor: "#f3f4f6",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 44,
  },
  saveButton: {
    flex: 1,
    padding: "0.75rem 1rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#3b82f6",
    border: "1px solid #3b82f6",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 44,
  },
  loadingText: {
    textAlign: "center" as const,
    color: "#6b7280",
    fontSize: "1rem",
  },
  errorText: {
    textAlign: "center" as const,
    color: "#dc2626",
    fontSize: "1rem",
    lineHeight: 1.5,
  },
  notFoundText: {
    textAlign: "center" as const,
    color: "#6b7280",
    fontSize: "1rem",
    lineHeight: 1.5,
  },
};
