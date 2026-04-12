import { useRecipes } from "@/hooks/useRecipes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecipeDetailViewProps {
  recipeId: string;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipeDetailView({ recipeId, onBack }: RecipeDetailViewProps) {
  const { recipes, isLoading, error } = useRecipes();

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
        <button type="button" style={styles.backButton} onClick={onBack}>
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

  const recipe = recipes.find((r) => r.id === recipeId);

  if (!recipe) {
    return (
      <div style={styles.container}>
        <button type="button" style={styles.backButton} onClick={onBack}>
          ← Back
        </button>
        <div style={styles.centered}>
          <p style={styles.notFoundText}>Recipe not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button type="button" style={styles.backButton} onClick={onBack}>
        ← Back
      </button>

      <h1 style={styles.title}>{recipe.title}</h1>

      {recipe.description && (
        <p style={styles.description}>{recipe.description}</p>
      )}

      {recipe.ingredients.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Ingredients</h2>
          <ul style={styles.ingredientList}>
            {recipe.ingredients.map((item, i) => (
              <li key={i} style={styles.ingredientItem}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Steps</h2>
          <ol style={styles.stepList}>
            {recipe.steps.map((step, i) => (
              <li key={i} style={styles.stepItem}>
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}
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
  backButton: {
    padding: "0.5rem 0.875rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 44,
    marginBottom: "1.25rem",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 0.5rem",
    lineHeight: 1.3,
  },
  description: {
    fontSize: "1.0625rem",
    color: "#6b7280",
    lineHeight: 1.6,
    margin: "0 0 1.5rem",
  },
  section: {
    marginBottom: "1.75rem",
  },
  sectionTitle: {
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 0.75rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid #e5e7eb",
  },
  ingredientList: {
    margin: 0,
    paddingLeft: "1.25rem",
    listStyleType: "disc",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  ingredientItem: {
    fontSize: "1.0625rem",
    color: "#111827",
    lineHeight: 1.5,
    paddingLeft: "0.25rem",
  },
  stepList: {
    margin: 0,
    paddingLeft: "1.25rem",
    listStyleType: "decimal",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  stepItem: {
    fontSize: "1.0625rem",
    color: "#111827",
    lineHeight: 1.6,
    paddingLeft: "0.25rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid #f3f4f6",
  },
};
