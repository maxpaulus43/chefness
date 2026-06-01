import { colors, fonts, shadows, radii } from "@/theme";
import {
    type RecipeSortOption,
    useRecipeSearch,
} from "@/hooks/useRecipeSearch";
import { useRecipes } from "@/hooks/useRecipes";
import { useToast } from "@/hooks/useToast";
import type { Recipe } from "@/types/recipe";
import DeleteButton from "./DeleteButton";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DESCRIPTION_MAX_LENGTH = 100;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecipeListViewProps {
    onSelectRecipe: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipeListView({ onSelectRecipe }: RecipeListViewProps) {
    const { recipes, isLoading, error, deleteRecipe } = useRecipes();
    const toast = useToast();
    const {
        searchQuery,
        setSearchQuery,
        sortOption,
        setSortOption,
        visibleRecipes,
    } = useRecipeSearch(recipes);

    const handleDeleteRecipe = (recipe: Recipe) => {
        void toast
            .ask({
                title: `Delete "${recipe.title}"?`,
                message: "This cannot be undone.",
                confirmLabel: "Delete",
                tone: "danger",
            })
            .then((confirmed) => {
                if (confirmed) deleteRecipe(recipe.id);
            });
    };

    if (isLoading) {
        return (
            <div style={styles.centered}>
                <p style={styles.loadingText}>Loading recipes…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.centered}>
                <p style={styles.errorText}>
                    Failed to load recipes. Please try again later.
                </p>
            </div>
        );
    }

    if (recipes.length === 0) {
        return (
            <div style={styles.centered}>
                <p style={styles.emptyText}>
                    No saved recipes yet. Chat with your cooking guru and save
                    recipes you like!
                </p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.headerRow}>
                <h1 style={styles.header}>Recipes</h1>
                <span style={styles.recipeCount}>
                    {recipes.length} saved
                </span>
            </div>
            <div style={styles.controls}>
                <label style={styles.searchLabel}>
                    <span style={styles.visuallyHidden}>Search recipes</span>
                    <input
                        aria-label="Search recipes"
                        placeholder="Search recipes"
                        style={styles.searchInput}
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </label>
                <label style={styles.sortLabel}>
                    <span style={styles.visuallyHidden}>Sort recipes</span>
                    <select
                        aria-label="Sort recipes"
                        style={styles.sortSelect}
                        value={sortOption}
                        onChange={(event) =>
                            setSortOption(event.target.value as RecipeSortOption)
                        }
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="title-asc">Title A–Z</option>
                        <option value="title-desc">Title Z–A</option>
                    </select>
                </label>
            </div>
            {visibleRecipes.length === 0 ? (
                <p style={styles.noResultsText}>No recipes match your search.</p>
            ) : (
                <ul style={styles.list}>
                    {visibleRecipes.map((recipe: Recipe) => (
                        <li style={styles.cardContainer} key={recipe.id}>
                            <button
                                style={styles.card}
                                type="button"
                                onClick={() => onSelectRecipe(recipe.id)}
                            >
                                <span style={styles.cardContent}>
                                    <span style={styles.cardTitle}>
                                        {recipe.title}
                                    </span>
                                    {recipe.description && (
                                        <span style={styles.cardDescription}>
                                            {truncate(
                                                recipe.description,
                                                DESCRIPTION_MAX_LENGTH,
                                            )}
                                        </span>
                                    )}
                                </span>
                                <span aria-hidden="true" style={styles.cardChevron}>
                                    ›
                                </span>
                            </button>
                            <DeleteButton
                                onDelete={() => handleDeleteRecipe(recipe)}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trimEnd() + "…";
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: "1.5rem 1rem",
        maxWidth: 600,
        margin: "0 auto",
        minWidth: 0,
    },
    headerRow: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "1rem",
        margin: "0 0 0.75rem",
    },
    header: {
        fontFamily: fonts.serif,
        fontSize: "2rem",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        margin: 0,
        color: colors.espresso,
    },
    recipeCount: {
        color: colors.stone500,
        flexShrink: 0,
        fontSize: "0.8125rem",
        fontWeight: 600,
    },
    controls: {
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        marginBottom: "0.875rem",
        padding: "0.375rem",
        backgroundColor: colors.glass,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radii.lg,
        boxShadow: shadows.glass,
    },
    searchLabel: {
        flex: "1 1 auto",
        minWidth: 0,
    },
    sortLabel: {
        flex: "0 0 128px",
        minWidth: 0,
    },
    visuallyHidden: {
        border: 0,
        clip: "rect(0 0 0 0)",
        height: 1,
        margin: -1,
        overflow: "hidden",
        padding: 0,
        position: "absolute" as const,
        whiteSpace: "nowrap" as const,
        width: 1,
    },
    searchInput: {
        border: 0,
        borderRadius: radii.md,
        boxSizing: "border-box" as const,
        backgroundColor: colors.glassStrong,
        color: colors.espresso,
        fontSize: "0.875rem",
        minHeight: 40,
        outline: "none",
        padding: "0.5625rem 0.75rem",
        width: "100%",
    },
    sortSelect: {
        border: 0,
        borderRadius: radii.md,
        boxSizing: "border-box" as const,
        backgroundColor: colors.saffronTint,
        color: colors.espresso,
        cursor: "pointer",
        fontSize: "0.8125rem",
        fontWeight: 700,
        minHeight: 40,
        outline: "none",
        padding: "0.5625rem 0.5rem",
        width: "100%",
    },
    list: {
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        listStyle: "none",
        margin: 0,
        padding: 0,
    },
    cardContainer: {
        display: "flex",
        alignItems: "stretch",
        gap: "0.375rem",
        backgroundColor: colors.glassStrong,
        border: `1px solid ${colors.glassBorder}`,
        boxShadow: shadows.glass,
        padding: "0.375rem",
        borderRadius: radii.lg,
        width: "100%",
        boxSizing: "border-box" as const,
    },
    card: {
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flex: "1 1 auto",
        minWidth: 0,
        border: "none",
        borderRadius: radii.md,
        backgroundColor: "transparent",
        cursor: "pointer",
        padding: "0.75rem",
        textAlign: "left" as const,
        boxSizing: "border-box" as const,
    },
    cardContent: {
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        flex: "1 1 auto",
        minWidth: 0,
    },
    cardTitle: {
        fontSize: "1rem",
        fontWeight: 700,
        color: colors.espresso,
        lineHeight: 1.25,
    },
    cardDescription: {
        fontSize: "0.8125rem",
        fontWeight: 400,
        color: colors.stone600,
        lineHeight: 1.35,
    },
    cardChevron: {
        color: colors.stone400,
        flexShrink: 0,
        fontSize: "1.5rem",
        lineHeight: 1,
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
        fontSize: "0.9375rem",
    },
    errorText: {
        textAlign: "center" as const,
        color: colors.danger,
        fontSize: "0.9375rem",
        lineHeight: 1.5,
    },
    emptyText: {
        textAlign: "center" as const,
        color: colors.stone600,
        fontSize: "0.9375rem",
        lineHeight: 1.5,
        maxWidth: 320,
    },
    noResultsText: {
        color: colors.stone600,
        fontSize: "0.9375rem",
        lineHeight: 1.5,
        margin: "1.5rem 0 0",
        textAlign: "center" as const,
    },
};
