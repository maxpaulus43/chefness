import {
    type RecipeSortOption,
    useRecipeSearch,
} from "@/hooks/useRecipeSearch";
import { useRecipes } from "@/hooks/useRecipes";
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
    const {
        searchQuery,
        setSearchQuery,
        sortOption,
        setSortOption,
        visibleRecipes,
    } = useRecipeSearch(recipes);

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
            <h1 style={styles.header}>Recipes</h1>
            <div style={styles.controls}>
                <label style={styles.searchLabel}>
                    <span style={styles.controlLabel}>Search recipes</span>
                    <input
                        aria-label="Search recipes"
                        placeholder="Search by title, description, or ingredient"
                        style={styles.searchInput}
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </label>
                <label style={styles.sortLabel}>
                    <span style={styles.controlLabel}>Sort by</span>
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
                <div style={styles.list}>
                    {visibleRecipes.map((recipe: Recipe) => (
                        <div style={styles.cardContainer} key={recipe.id}>
                            <button
                                style={styles.card}
                                type="button"
                                onClick={() => onSelectRecipe(recipe.id)}
                            >
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
                            </button>
                            <DeleteButton
                                onDelete={() => deleteRecipe(recipe.id)}
                            />
                        </div>
                    ))}
                </div>
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
    header: {
        fontSize: "1.5rem",
        fontWeight: 700,
        margin: "0 0 1rem",
        color: "#111827",
    },
    controls: {
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-end",
        marginBottom: "1rem",
        flexWrap: "wrap" as const,
    },
    searchLabel: {
        display: "flex",
        flex: "1 1 260px",
        flexDirection: "column",
        gap: "0.375rem",
    },
    sortLabel: {
        display: "flex",
        flex: "0 1 180px",
        flexDirection: "column",
        gap: "0.375rem",
    },
    controlLabel: {
        color: "#374151",
        fontSize: "0.8125rem",
        fontWeight: 600,
    },
    searchInput: {
        border: "1px solid #d1d5db",
        borderRadius: 10,
        boxSizing: "border-box" as const,
        color: "#111827",
        fontSize: "0.9375rem",
        padding: "0.625rem 0.75rem",
        width: "100%",
    },
    sortSelect: {
        border: "1px solid #d1d5db",
        borderRadius: 10,
        boxSizing: "border-box" as const,
        color: "#111827",
        fontSize: "0.9375rem",
        padding: "0.625rem 0.75rem",
        width: "100%",
    },
    list: {
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
    },
    cardContainer: {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        border: "1px solid #e5e7eb",
        padding: "0.875rem 1rem",
        borderRadius: 12,
        minHeight: 44,
        width: "100%",
        cursor: "pointer",
    },
    card: {
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        backgroundColor: "#fff",
        textAlign: "left" as const,
        boxSizing: "border-box" as const,
    },
    cardTitle: {
        fontSize: "1rem",
        fontWeight: 600,
        color: "#111827",
        lineHeight: 1.4,
    },
    cardDescription: {
        fontSize: "0.875rem",
        fontWeight: 400,
        color: "#6b7280",
        lineHeight: 1.4,
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
        fontSize: "0.9375rem",
    },
    errorText: {
        textAlign: "center" as const,
        color: "#dc2626",
        fontSize: "0.9375rem",
        lineHeight: 1.5,
    },
    emptyText: {
        textAlign: "center" as const,
        color: "#6b7280",
        fontSize: "0.9375rem",
        lineHeight: 1.5,
        maxWidth: 320,
    },
    noResultsText: {
        color: "#6b7280",
        fontSize: "0.9375rem",
        lineHeight: 1.5,
        margin: "1.5rem 0 0",
        textAlign: "center" as const,
    },
};
