import { colors, fonts, shadows, radii } from "@/theme";
import { Icon } from "@/components/Icon";
import { useRecipes } from "@/hooks/useRecipes";
import { useRecipeAiEditor } from "@/hooks/useRecipeAiEditor";
import { useCookingLog } from "@/hooks/useCookingLog";
import { useClipboard } from "@/hooks/useClipboard";
import { useToast } from "@/hooks/useToast";
import { recipeToMarkdown } from "@/lib/recipe-markdown";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecipeDetailViewProps {
  recipeId: string;
  onBack: () => void;
  onEdit: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipeDetailView({
  recipeId,
  onBack,
  onEdit,
}: RecipeDetailViewProps) {
  const { recipes, isLoading, error, deleteRecipe, isDeleting } = useRecipes();
  const { createEntryAsync } = useCookingLog();
  const { copyToClipboard, copied, error: clipboardError } = useClipboard();
  const toast = useToast();
  const {
    status: aiEditStatus,
    draftRecipe,
    error: aiEditError,
    isConfigured: isAiConfigured,
    generateEdit,
    applyEdit,
    reset: resetAiEdit,
  } = useRecipeAiEditor();

  const [logStatus, setLogStatus] = useState<
    "idle" | "logging" | "logged" | "error"
  >("idle");
  const [logError, setLogError] = useState<string | null>(null);
  const [showAiEdit, setShowAiEdit] = useState(false);
  const [aiEditInstruction, setAiEditInstruction] = useState("");

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
          <Icon name="arrowLeft" size={16} strokeWidth={2.5} />
          Back
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
          <Icon name="arrowLeft" size={16} strokeWidth={2.5} />
          Back
        </button>
        <div style={styles.centered}>
          <p style={styles.notFoundText}>Recipe not found.</p>
        </div>
      </div>
    );
  }

  const handleCopyMarkdown = () => {
    const markdown = recipeToMarkdown(recipe);
    void copyToClipboard(markdown);
  };

  const handleDelete = () => {
    void toast
      .ask({
        title: `Delete "${recipe.title}"?`,
        message: "This cannot be undone.",
        confirmLabel: "Delete",
        tone: "danger",
      })
      .then((confirmed) => {
        if (!confirmed) return;
        deleteRecipe(recipeId);
        onBack();
      });
  };

  const handleLogCook = async () => {
    setLogStatus("logging");
    setLogError(null);
    try {
      await createEntryAsync({
        title: recipe.title,
        date: new Date().toISOString().slice(0, 10),
        rating: null,
        comment: "",
        recipeId: recipe.id,
      });
      setLogStatus("logged");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to log meal.";
      setLogStatus("error");
      setLogError(errMsg);
    }
  };

  const handleLogRetry = () => {
    setLogStatus("idle");
    setLogError(null);
  };

  const handleToggleAiEdit = () => {
    setShowAiEdit((prev) => !prev);
  };

  const handleGenerateAiEdit = () => {
    void generateEdit(recipe, aiEditInstruction);
  };

  const handleApplyAiEdit = () => {
    void applyEdit(recipe.id);
  };

  const handleCancelAiEdit = () => {
    resetAiEdit();
    setAiEditInstruction("");
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <button type="button" style={styles.backButton} onClick={onBack}>
          <Icon name="arrowLeft" size={16} strokeWidth={2.5} />
          Back
        </button>
      </div>

      <h1 style={styles.title}>{recipe.title}</h1>

      {recipe.description && (
        <p style={styles.description}>{recipe.description}</p>
      )}

      <section style={styles.actionPanel} aria-label="Recipe actions">
        <div style={styles.primaryActionRow}>
          {logStatus === "idle" && (
            <button
              type="button"
              style={styles.primaryLogBtn}
              onClick={() => void handleLogCook()}
            >
              <Icon name="check" size={16} strokeWidth={3} />I Cooked This!
            </button>
          )}
          {logStatus === "logging" && (
            <button
              type="button"
              style={{ ...styles.primaryLogBtn, ...styles.logBtnDisabled }}
              disabled
            >
              Logging…
            </button>
          )}
          {logStatus === "logged" && (
            <span style={styles.loggedLabel}>
              <Icon name="check" size={14} strokeWidth={3} />
              Logged!
            </span>
          )}
          {logStatus === "error" && (
            <div style={styles.logErrorRow}>
              <span style={styles.logErrorText}>
                {logError ?? "Failed to log meal."}
              </span>
              <button
                type="button"
                style={styles.logRetryBtn}
                onClick={handleLogRetry}
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <div style={styles.actionGrid}>
          <button
            type="button"
            style={copied ? styles.copyButtonCopied : styles.copyButton}
            onClick={handleCopyMarkdown}
          >
            {copied ? (
              <>
                <Icon name="check" size={15} strokeWidth={3} />
                Copied!
              </>
            ) : (
              <>
                <Icon name="clipboard" size={15} />
                Copy
              </>
            )}
          </button>
          <button type="button" style={styles.editButton} onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            style={showAiEdit ? styles.aiEditButtonActive : styles.aiEditButton}
            onClick={handleToggleAiEdit}
            aria-pressed={showAiEdit}
          >
            <Icon name="sparkles" size={15} />
            AI Edit
          </button>
          <button
            type="button"
            style={styles.deleteButton}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              "Deleting…"
            ) : (
              <>
                <Icon name="trash" size={15} />
                Delete
              </>
            )}
          </button>
        </div>
      </section>

      {clipboardError && <p style={styles.clipboardError}>{clipboardError}</p>}

      {showAiEdit && (
        <section style={styles.aiEditPanel}>
          <div style={styles.aiEditHeader}>
            <div>
              <h2 style={styles.aiEditTitle}>Edit with AI</h2>
              <p style={styles.aiEditHelp}>
                Describe the change you want. Chefness will preview a complete
                updated recipe before saving.
              </p>
            </div>
          </div>

          {!isAiConfigured && (
            <p style={styles.aiEditError}>
              Connect OpenRouter in Settings to use AI recipe edits.
            </p>
          )}

          <textarea
            value={aiEditInstruction}
            onChange={(e) => setAiEditInstruction(e.target.value)}
            placeholder="e.g. Make this dairy-free, halve the salt, and add an air fryer option"
            style={styles.aiEditTextarea}
            rows={3}
            disabled={
              aiEditStatus === "generating" || aiEditStatus === "applying"
            }
          />

          <div style={styles.aiEditActions}>
            <button
              type="button"
              style={styles.aiEditGenerateButton}
              onClick={handleGenerateAiEdit}
              disabled={
                !isAiConfigured ||
                aiEditInstruction.trim().length === 0 ||
                aiEditStatus === "generating" ||
                aiEditStatus === "applying"
              }
            >
              {aiEditStatus === "generating"
                ? "Generating…"
                : "Preview Changes"}
            </button>
            <button
              type="button"
              style={styles.aiEditCancelButton}
              onClick={handleCancelAiEdit}
              disabled={
                aiEditStatus === "generating" || aiEditStatus === "applying"
              }
            >
              Clear
            </button>
          </div>

          {aiEditError && <p style={styles.aiEditError}>{aiEditError}</p>}
          {aiEditStatus === "applied" && (
            <p style={styles.aiEditSuccess}>
              <Icon name="check" size={15} strokeWidth={3} />
              Recipe updated!
            </p>
          )}

          {draftRecipe && (
            <div style={styles.aiEditPreview}>
              <h3 style={styles.aiEditPreviewTitle}>Preview</h3>
              <h4 style={styles.aiEditPreviewRecipeTitle}>
                {draftRecipe.title}
              </h4>
              {draftRecipe.description && (
                <p style={styles.aiEditPreviewDescription}>
                  {draftRecipe.description}
                </p>
              )}
              <div style={styles.aiEditPreviewGrid}>
                <div>
                  <h5 style={styles.aiEditPreviewSectionTitle}>Ingredients</h5>
                  <ul style={styles.aiEditPreviewList}>
                    {draftRecipe.ingredients.map((ingredient, i) => (
                      <li key={i}>{ingredient}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 style={styles.aiEditPreviewSectionTitle}>Steps</h5>
                  <ol style={styles.aiEditPreviewList}>
                    {draftRecipe.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
              <div style={styles.aiEditActions}>
                <button
                  type="button"
                  style={styles.aiEditApplyButton}
                  onClick={handleApplyAiEdit}
                  disabled={aiEditStatus === "applying"}
                >
                  {aiEditStatus === "applying" ? "Applying…" : "Apply Changes"}
                </button>
                <button
                  type="button"
                  style={styles.aiEditCancelButton}
                  onClick={handleCancelAiEdit}
                  disabled={aiEditStatus === "applying"}
                >
                  Discard Preview
                </button>
              </div>
            </div>
          )}
        </section>
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
    color: colors.stone600,
    fontSize: "1rem",
  },
  errorText: {
    textAlign: "center" as const,
    color: colors.danger,
    fontSize: "1rem",
    lineHeight: 1.5,
  },
  notFoundText: {
    textAlign: "center" as const,
    color: colors.stone600,
    fontSize: "1rem",
    lineHeight: 1.5,
  },
  headerRow: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: "1rem",
    gap: "0.5rem",
  },
  backButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    padding: "0.5rem 0.875rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: colors.saffron,
    backgroundColor: colors.saffronTint,
    border: `1px solid ${colors.saffronTintBorder}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    minHeight: 44,
  },
  actionPanel: {
    backgroundColor: colors.glass,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.lg,
    boxShadow: shadows.glass,
    padding: "0.75rem",
    margin: "0 0 1.5rem",
  },
  primaryActionRow: {
    marginBottom: "0.625rem",
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "0.5rem",
  },
  copyButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    padding: "0.5rem 0.875rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.stone700,
    backgroundColor: colors.glass,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.sm,
    boxShadow: shadows.glass,
    cursor: "pointer",
    minHeight: 44,
    whiteSpace: "nowrap" as const,
    width: "100%",
  },
  copyButtonCopied: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    padding: "0.5rem 0.875rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.success,
    backgroundColor: colors.successTint,
    border: `1px solid ${colors.successTintBorder}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    minHeight: 44,
    whiteSpace: "nowrap" as const,
    width: "100%",
  },
  clipboardError: {
    fontSize: "0.8125rem",
    color: colors.danger,
    backgroundColor: colors.dangerTint,
    border: `1px solid ${colors.dangerTintBorder}`,
    borderRadius: radii.sm,
    padding: "0.5rem 0.75rem",
    margin: "0 0 1rem",
  },
  aiEditPanel: {
    backgroundColor: colors.roseTint,
    border: `1px solid ${colors.roseTintBorder}`,
    borderRadius: radii.md,
    padding: "1rem",
    marginBottom: "1.5rem",
  },
  aiEditHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "0.75rem",
    marginBottom: "0.75rem",
  },
  aiEditTitle: {
    fontFamily: fonts.serif,
    fontSize: "1.125rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: colors.roseText,
    margin: "0 0 0.25rem",
  },
  aiEditHelp: {
    fontSize: "0.875rem",
    color: colors.roseText,
    lineHeight: 1.5,
    margin: 0,
  },
  aiEditTextarea: {
    width: "100%",
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
    minHeight: 88,
    padding: "0.75rem",
    borderRadius: radii.md,
    border: `1px solid ${colors.roseTintBorder}`,
    backgroundColor: colors.white,
    color: colors.espresso,
    fontSize: "1rem",
    lineHeight: 1.5,
    outline: "none",
  },
  aiEditActions: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap" as const,
    alignItems: "center",
    marginTop: "0.75rem",
  },
  aiEditGenerateButton: {
    padding: "0.625rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 700,
    color: colors.white,
    backgroundColor: colors.roseText,
    border: `1px solid ${colors.roseText}`,
    borderRadius: radii.md,
    boxShadow: shadows.glassLg,
    cursor: "pointer",
    minHeight: 44,
  },
  aiEditApplyButton: {
    padding: "0.625rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 700,
    color: colors.white,
    backgroundColor: colors.success,
    border: `1px solid ${colors.success}`,
    borderRadius: radii.md,
    boxShadow: shadows.glassLg,
    cursor: "pointer",
    minHeight: 44,
  },
  aiEditCancelButton: {
    padding: "0.625rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: colors.stone700,
    backgroundColor: colors.glass,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.md,
    boxShadow: shadows.glass,
    cursor: "pointer",
    minHeight: 44,
  },
  aiEditError: {
    fontSize: "0.875rem",
    color: colors.danger,
    backgroundColor: colors.dangerTint,
    border: `1px solid ${colors.dangerTintBorder}`,
    borderRadius: radii.sm,
    padding: "0.5rem 0.75rem",
    margin: "0.75rem 0 0",
    lineHeight: 1.4,
  },
  aiEditSuccess: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    fontSize: "0.875rem",
    color: colors.success,
    backgroundColor: colors.successTint,
    border: `1px solid ${colors.successTintBorder}`,
    borderRadius: radii.sm,
    padding: "0.5rem 0.75rem",
    margin: "0.75rem 0 0",
    lineHeight: 1.4,
  },
  aiEditPreview: {
    backgroundColor: colors.white,
    border: `1px solid ${colors.roseTintBorder}`,
    borderRadius: radii.md,
    padding: "1rem",
    marginTop: "1rem",
  },
  aiEditPreviewTitle: {
    fontSize: "0.875rem",
    fontWeight: 700,
    color: colors.roseText,
    margin: "0 0 0.5rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  aiEditPreviewRecipeTitle: {
    fontSize: "1.125rem",
    fontWeight: 700,
    color: colors.espresso,
    margin: "0 0 0.375rem",
  },
  aiEditPreviewDescription: {
    fontSize: "0.9375rem",
    color: colors.stone600,
    lineHeight: 1.5,
    margin: "0 0 0.75rem",
  },
  aiEditPreviewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "0.875rem",
  },
  aiEditPreviewSectionTitle: {
    fontSize: "0.9375rem",
    fontWeight: 700,
    color: colors.stone700,
    margin: "0 0 0.375rem",
  },
  aiEditPreviewList: {
    margin: 0,
    paddingLeft: "1.25rem",
    color: colors.espresso,
    fontSize: "0.9375rem",
    lineHeight: 1.5,
  },
  editButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    padding: "0.5rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: colors.saffron,
    backgroundColor: colors.saffronTint,
    border: `1px solid ${colors.saffronTintBorder}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    minHeight: 44,
    width: "100%",
  },
  aiEditButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    padding: "0.5rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: colors.roseText,
    backgroundColor: colors.roseTint,
    border: `1px solid ${colors.roseTintBorder}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    minHeight: 44,
    width: "100%",
  },
  aiEditButtonActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    padding: "0.5rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: colors.white,
    backgroundColor: colors.roseText,
    border: `1px solid ${colors.roseText}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    minHeight: 44,
    width: "100%",
  },
  deleteButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    padding: "0.5rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: colors.danger,
    backgroundColor: colors.dangerTint,
    border: `1px solid ${colors.dangerTintBorder}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    minHeight: 44,
    width: "100%",
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: "1.75rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: colors.espresso,
    margin: "0 0 0.5rem",
    lineHeight: 1.3,
  },
  description: {
    fontSize: "1.0625rem",
    color: colors.stone600,
    lineHeight: 1.6,
    margin: "0 0 1rem",
  },
  section: {
    marginBottom: "1.75rem",
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: "1.25rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: colors.espresso,
    margin: "0 0 0.75rem",
    paddingBottom: "0.5rem",
    borderBottom: `1px solid ${colors.glassBorder}`,
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
    color: colors.espresso,
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
    color: colors.espresso,
    lineHeight: 1.6,
    paddingLeft: "0.25rem",
    paddingBottom: "0.5rem",
    borderBottom: `1px solid ${colors.glassBorder}`,
  },

  // "I Cooked This!" button styles
  logBtn: {
    padding: "0.5rem 0.875rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: colors.saffron,
    backgroundColor: colors.saffronTint,
    border: `1px solid ${colors.saffronTintBorder}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    minHeight: 44,
    whiteSpace: "nowrap" as const,
  },
  primaryLogBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    width: "100%",
    padding: "0.75rem 1rem",
    fontSize: "1rem",
    fontWeight: 700,
    color: colors.white,
    backgroundColor: colors.saffron,
    border: `1px solid ${colors.saffron}`,
    borderRadius: radii.md,
    boxShadow: shadows.glassLg,
    cursor: "pointer",
    minHeight: 48,
    whiteSpace: "nowrap" as const,
  },
  logBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  loggedLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.25rem",
    fontSize: "1rem",
    fontWeight: 700,
    color: colors.success,
    backgroundColor: colors.successTint,
    border: `1px solid ${colors.successTintBorder}`,
    borderRadius: radii.md,
    padding: "0.75rem 1rem",
    minHeight: 48,
  },
  logErrorRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.375rem",
    flexWrap: "wrap" as const,
    padding: "0.625rem 0.75rem",
    backgroundColor: colors.dangerTint,
    border: `1px solid ${colors.dangerTintBorder}`,
    borderRadius: radii.md,
  },
  logErrorText: {
    fontSize: "0.8125rem",
    color: colors.danger,
    lineHeight: 1.4,
  },
  logRetryBtn: {
    padding: "0.25rem 0.625rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: colors.danger,
    backgroundColor: colors.dangerTint,
    border: `1px solid ${colors.dangerTintBorder}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    minHeight: 28,
  },
};
