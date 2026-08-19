import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useRecipes } from "@/hooks/useRecipes";
import { useRecipeAiEditor } from "@/hooks/useRecipeAiEditor";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";
import { recipeToMarkdown } from "@/lib/recipe-markdown";
import type { Recipe } from "@/types/recipe";
import { colors } from "@/theme";
import { Button, Card, Chip, Empty, Field, Loading, ScreenHeader, nativeStyles } from "@/native/ui";

export function RecipesScreen() {
  const { recipes, isLoading, deleteRecipe, updateRecipeAsync } = useRecipes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const search = useRecipeSearch(recipes);
  const selected = useMemo(() => recipes.find((recipe) => recipe.id === selectedId) ?? null, [recipes, selectedId]);
  if (isLoading) return <View style={nativeStyles.screen}><ScreenHeader title="Recipes" /><Loading /></View>;
  if (selected) return <RecipeDetail recipe={selected} editing={editing} setEditing={setEditing} onBack={() => setSelectedId(null)} onDelete={() => { deleteRecipe(selected.id); setSelectedId(null); }} onUpdate={updateRecipeAsync} />;
  return <View style={nativeStyles.screen}><ScreenHeader title="Recipes" /><ScrollView contentContainerStyle={nativeStyles.scroll} keyboardShouldPersistTaps="handled">
    {recipes.length > 0 && <><Field value={search.searchQuery} onChangeText={search.setSearchQuery} placeholder="Search recipes and ingredients…" /><View style={nativeStyles.row}><Chip label="Newest" selected={search.sortOption === "newest"} onPress={() => search.setSortOption("newest")} /><Chip label="Oldest" selected={search.sortOption === "oldest"} onPress={() => search.setSortOption("oldest")} /><Chip label="A–Z" selected={search.sortOption === "title-asc"} onPress={() => search.setSortOption("title-asc")} /></View></>}
    {recipes.length === 0 && <Empty title="No saved recipes yet" body="Chat with your cooking guru and save recipes you like!" />}
    {recipes.length > 0 && search.visibleRecipes.length === 0 && <Empty title="No matching recipes" body="Try another title, description, or ingredient." />}
    {search.visibleRecipes.map((recipe) => <Pressable key={recipe.id} onPress={() => setSelectedId(recipe.id)}><Card><Text style={styles.recipeTitle}>{recipe.title}</Text><Text numberOfLines={3} style={nativeStyles.muted}>{recipe.description}</Text><Text style={styles.meta}>{recipe.ingredients.length} ingredients · {recipe.steps.length} steps</Text></Card></Pressable>)}
  </ScrollView></View>;
}

function RecipeDetail({ recipe, editing, setEditing, onBack, onDelete, onUpdate }: { recipe: Recipe; editing: boolean; setEditing: (value: boolean) => void; onBack: () => void; onDelete: () => void; onUpdate: (data: { id: string; title?: string; description?: string; ingredients?: string[]; steps?: string[] }) => Promise<Recipe> }) {
  const [title, setTitle] = useState(recipe.title); const [description, setDescription] = useState(recipe.description);
  const [ingredients, setIngredients] = useState(recipe.ingredients.join("\n")); const [steps, setSteps] = useState(recipe.steps.join("\n"));
  const [instruction, setInstruction] = useState("");
  const ai = useRecipeAiEditor();
  useEffect(() => { setTitle(recipe.title); setDescription(recipe.description); setIngredients(recipe.ingredients.join("\n")); setSteps(recipe.steps.join("\n")); }, [recipe]);
  const save = async () => { if (!title.trim()) return Alert.alert("Title required"); await onUpdate({ id: recipe.id, title: title.trim(), description: description.trim(), ingredients: lines(ingredients), steps: lines(steps) }); setEditing(false); };
  const share = async () => { await Clipboard.setStringAsync(recipeToMarkdown(recipe)); Alert.alert("Copied", "Recipe copied as Markdown."); };
  const confirmDelete = () => Alert.alert("Delete recipe?", recipe.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: onDelete }]);

  return <View style={nativeStyles.screen}><ScreenHeader title={editing ? "Edit Recipe" : "Recipe"} action={<Pressable accessibilityLabel="Back" onPress={onBack}><Ionicons name="close" size={26} color={colors.espresso} /></Pressable>} /><ScrollView contentContainerStyle={nativeStyles.scroll}>
    {editing ? <><Text style={nativeStyles.label}>Title</Text><Field value={title} onChangeText={setTitle} /><Text style={nativeStyles.label}>Description</Text><Field value={description} onChangeText={setDescription} multiline /><Text style={nativeStyles.label}>Ingredients (one per line)</Text><Field value={ingredients} onChangeText={setIngredients} multiline /><Text style={nativeStyles.label}>Steps (one per line)</Text><Field value={steps} onChangeText={setSteps} multiline /><Button label="Save Changes" onPress={() => void save()} /><Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} /></> : <>
      <Text style={styles.detailTitle}>{recipe.title}</Text><Text style={styles.description}>{recipe.description}</Text><View style={nativeStyles.row}><Button label="Edit" variant="secondary" onPress={() => setEditing(true)} /><Button label="Copy / Share" variant="secondary" onPress={() => void share()} /><Button label="Delete" variant="danger" onPress={confirmDelete} /></View>
      <Card><Text style={nativeStyles.sectionTitle}>Edit with AI</Text><Text style={nativeStyles.muted}>Describe a change, preview the complete updated recipe, then apply it.</Text><Field value={instruction} onChangeText={setInstruction} multiline placeholder="Make it vegetarian and reduce prep time…" /><Button disabled={ai.status === "generating"} label={ai.status === "generating" ? "Generating…" : "Generate Preview"} onPress={() => void ai.generateEdit(recipe, instruction)} />{ai.error && <Text style={nativeStyles.error}>{ai.error}</Text>}{ai.draftRecipe && <View style={styles.preview}><Text style={styles.recipeTitle}>{ai.draftRecipe.title}</Text><Text style={nativeStyles.muted}>{ai.draftRecipe.description}</Text><Text style={nativeStyles.label}>{ai.draftRecipe.ingredients.length} ingredients · {ai.draftRecipe.steps.length} steps</Text><Button label={ai.status === "applying" ? "Applying…" : "Apply AI Edit"} disabled={ai.status === "applying"} onPress={() => void ai.applyEdit(recipe.id)} /></View>}</Card>
      <Text style={nativeStyles.sectionTitle}>Ingredients</Text>{recipe.ingredients.map((item, index) => <View key={`${item}-${index}`} style={styles.line}><Text style={styles.bullet}>•</Text><Text style={styles.lineText}>{item}</Text></View>)}
      <Text style={nativeStyles.sectionTitle}>Steps</Text>{recipe.steps.map((item, index) => <View key={`${item}-${index}`} style={styles.line}><Text style={styles.step}>{index + 1}</Text><Text style={styles.lineText}>{item}</Text></View>)}
    </>}
  </ScrollView></View>;
}
function lines(value: string) { return value.split("\n").map((line) => line.trim()).filter(Boolean); }
const styles = StyleSheet.create({ recipeTitle: { fontSize: 19, color: colors.espresso, fontWeight: "700" }, meta: { color: colors.saffronDeep, fontWeight: "600" }, detailTitle: { fontSize: 32, lineHeight: 38, fontWeight: "700", color: colors.espresso }, description: { color: colors.stone700, fontSize: 17, lineHeight: 25 }, line: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, bullet: { color: colors.saffronDeep, fontSize: 22 }, step: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", textAlign: "center", paddingTop: 4, backgroundColor: colors.saffronTint, color: colors.saffronDeep, fontWeight: "700" }, lineText: { flex: 1, color: colors.espresso, fontSize: 16, lineHeight: 24 }, preview: { gap: 8, padding: 12, backgroundColor: colors.saffronTint, borderRadius: 12 } });
