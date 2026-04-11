import { useRecipes } from "@/hooks/useRecipes";

function App() {
  const {
    recipes,
    isLoading,
    error,
    createRecipe,
    isCreating,
    deleteRecipe,
    isDeleting,
  } = useRecipes();

  const handleCreate = () => {
    createRecipe({
      title: `Recipe #${recipes.length + 1}`,
      description: "A delicious test recipe created via tRPC.",
      ingredients: ["Ingredient A", "Ingredient B"],
      steps: ["Step 1: Mix ingredients.", "Step 2: Cook for 20 min."],
    });
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>🍳 Chefness</h1>
      <p style={{ color: "#666", marginTop: "0.5rem" }}>
        tRPC + localStorage smoke test
      </p>

      <button
        onClick={handleCreate}
        disabled={isCreating}
        style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", fontSize: "1rem" }}
      >
        {isCreating ? "Creating…" : "+ Add dummy recipe"}
      </button>

      <section style={{ marginTop: "2rem" }}>
        <h2>Recipes ({recipes.length})</h2>

        {isLoading && <p>Loading…</p>}
        {error && (
          <p style={{ color: "red" }}>Error: {error.message}</p>
        )}

        {recipes.length === 0 && !isLoading && (
          <p style={{ color: "#999" }}>
            No recipes yet — click the button above to create one.
          </p>
        )}

        <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
          {recipes.map((recipe) => (
            <li
              key={recipe.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "1rem",
                marginBottom: "0.75rem",
              }}
            >
              <strong>{recipe.title}</strong>
              <p style={{ margin: "0.25rem 0", color: "#555" }}>
                {recipe.description}
              </p>
              <p style={{ fontSize: "0.8rem", color: "#999" }}>
                Created: {new Date(recipe.createdAt).toLocaleString()}
              </p>
              <button
                onClick={() => deleteRecipe(recipe.id)}
                disabled={isDeleting}
                style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
