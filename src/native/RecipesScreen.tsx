import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRecipes } from "@/hooks/useRecipes";
import { useRecipeAiEditor } from "@/hooks/useRecipeAiEditor";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";
import { recipeToMarkdown } from "@/lib/recipe-markdown";
import type { Recipe, UpdateRecipeInput } from "@/types/recipe";
import type { RecipesStackParamList } from "@/native/navigation-routes";
import { colors } from "@/theme";
import { ListInteractionRow } from "@/native/ListInteractionRow";
import { Button, Card, Chip, Empty, Field, Loading, nativeStyles } from "@/native/ui";

export function RecipeListScreen({ navigation }: NativeStackScreenProps<RecipesStackParamList, "RecipeList">) {
  const { recipes, isLoading, deleteRecipe } = useRecipes();
  const search = useRecipeSearch(recipes);
  const confirmDelete = (recipe: Recipe) => Alert.alert("Delete recipe?", recipe.title, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => deleteRecipe(recipe.id) },
  ]);
  if (isLoading) return <View style={nativeStyles.screen}><Loading /></View>;
  return <View style={nativeStyles.screen}><ScrollView contentContainerStyle={nativeStyles.scroll} keyboardShouldPersistTaps="handled">
    {recipes.length > 0 && <><Field value={search.searchQuery} onChangeText={search.setSearchQuery} placeholder="Search recipes and ingredients…" /><View style={nativeStyles.row}><Chip label="Newest" selected={search.sortOption === "newest"} onPress={() => search.setSortOption("newest")} /><Chip label="Oldest" selected={search.sortOption === "oldest"} onPress={() => search.setSortOption("oldest")} /><Chip label="A–Z" selected={search.sortOption === "title-asc"} onPress={() => search.setSortOption("title-asc")} /></View></>}
    {recipes.length === 0 && <Empty title="No saved recipes yet" body="Chat with your cooking guru and save recipes you like!" />}
    {recipes.length > 0 && search.visibleRecipes.length === 0 && <Empty title="No matching recipes" body="Try another title, description, or ingredient." />}
    {search.visibleRecipes.map((recipe) => <ListInteractionRow
      key={recipe.id}
      menuActions={[
        { id: "open", title: "Open", image: "book" },
        { id: "edit", title: "Edit", image: "pencil" },
        { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } },
      ]}
      onDelete={() => confirmDelete(recipe)}
      onPress={() => navigation.navigate("RecipeDetail", { recipeId: recipe.id })}
      onMenuAction={(id) => {
        if (id === "open") navigation.navigate("RecipeDetail", { recipeId: recipe.id });
        if (id === "edit") navigation.navigate("RecipeEdit", { recipeId: recipe.id });
        if (id === "delete") confirmDelete(recipe);
      }}
    ><View accessibilityRole="button" accessibilityHint="Opens recipe details; long press for more actions"><Card><Text style={styles.recipeTitle}>{recipe.title}</Text><Text numberOfLines={3} style={nativeStyles.muted}>{recipe.description}</Text><Text style={styles.meta}>{recipe.ingredients.length} ingredients · {recipe.steps.length} steps</Text></Card></View></ListInteractionRow>)}
  </ScrollView></View>;
}

export function RecipeDetailScreen({ route, navigation }: NativeStackScreenProps<RecipesStackParamList, "RecipeDetail">) {
  const { recipes, isLoading, deleteRecipe } = useRecipes();
  const recipe = useMemo(() => recipes.find((item) => item.id === route.params.recipeId), [recipes, route.params.recipeId]);
  const [instruction, setInstruction] = useState("");
  const ai = useRecipeAiEditor();
  useEffect(() => { if (recipe) navigation.setOptions({ title: recipe.title }); }, [navigation, recipe]);
  if (isLoading) return <View style={nativeStyles.screen}><Loading /></View>;
  if (!recipe) return <View style={nativeStyles.screen}><Empty title="Recipe not found" body="It may have been deleted from this device." /></View>;
  const shareRecipe = async () => {
    try {
      await Share.share(
        { title: recipe.title, message: recipeToMarkdown(recipe) },
        { subject: recipe.title },
      );
    } catch {
      Alert.alert("Unable to share", "The recipe could not be shared. Please try again.");
    }
  };
  const copyMarkdown = async () => {
    try {
      await Clipboard.setStringAsync(recipeToMarkdown(recipe));
      Alert.alert("Copied", "Recipe copied as Markdown.");
    } catch {
      Alert.alert("Unable to copy", "The recipe could not be copied. Please try again.");
    }
  };
  const confirmDelete = () => Alert.alert("Delete recipe?", recipe.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { deleteRecipe(recipe.id); navigation.popToTop(); } }]);
  return <View style={nativeStyles.screen}><ScrollView contentContainerStyle={nativeStyles.scroll}>
    <Text style={styles.detailTitle}>{recipe.title}</Text><Text style={styles.description}>{recipe.description}</Text><View style={nativeStyles.row}><Button label="Edit" variant="secondary" onPress={() => navigation.navigate("RecipeEdit", { recipeId: recipe.id })} /><Button label="Share" variant="secondary" onPress={() => void shareRecipe()} /><Button label="Copy Markdown" variant="secondary" onPress={() => void copyMarkdown()} /><Button label="Delete" variant="danger" onPress={confirmDelete} /></View>
    <Card><Text style={nativeStyles.sectionTitle}>Edit with AI</Text><Text style={nativeStyles.muted}>Describe a change, preview the complete updated recipe, then apply it.</Text><Field value={instruction} onChangeText={setInstruction} multiline placeholder="Make it vegetarian and reduce prep time…" /><Button disabled={ai.status === "generating"} label={ai.status === "generating" ? "Generating…" : "Generate Preview"} onPress={() => void ai.generateEdit(recipe, instruction)} />{ai.error && <Text style={nativeStyles.error}>{ai.error}</Text>}{ai.draftRecipe && <View style={styles.preview}>
      <Text style={styles.recipeTitle}>{ai.draftRecipe.title}</Text>
      <Text style={nativeStyles.muted}>{ai.draftRecipe.description}</Text>
      <Text style={nativeStyles.sectionTitle}>Ingredients</Text>
      {ai.draftRecipe.ingredients.map((item, index) => <View key={`${item}-${index}`} style={styles.line}><Text style={styles.bullet}>•</Text><Text style={styles.lineText}>{item}</Text></View>)}
      <Text style={nativeStyles.sectionTitle}>Steps</Text>
      {ai.draftRecipe.steps.map((item, index) => <View key={`${item}-${index}`} style={styles.line}><Text style={styles.step}>{index + 1}</Text><Text style={styles.lineText}>{item}</Text></View>)}
      <View style={nativeStyles.row}><Button label={ai.status === "applying" ? "Applying…" : "Apply AI Edit"} disabled={ai.status === "applying"} onPress={() => void ai.applyEdit(recipe.id)} /><Button label="Cancel" variant="secondary" disabled={ai.status === "applying"} onPress={() => { ai.reset(); setInstruction(""); }} /></View>
    </View>}</Card>
    <Text style={nativeStyles.sectionTitle}>Ingredients</Text>{recipe.ingredients.map((item, index) => <View key={`${item}-${index}`} style={styles.line}><Text style={styles.bullet}>•</Text><Text style={styles.lineText}>{item}</Text></View>)}
    <Text style={nativeStyles.sectionTitle}>Steps</Text>{recipe.steps.map((item, index) => <View key={`${item}-${index}`} style={styles.line}><Text style={styles.step}>{index + 1}</Text><Text style={styles.lineText}>{item}</Text></View>)}
  </ScrollView></View>;
}

export function RecipeEditScreen({ route, navigation }: NativeStackScreenProps<RecipesStackParamList, "RecipeEdit">) {
  const { recipes, isLoading, updateRecipeAsync } = useRecipes();
  const recipe = useMemo(() => recipes.find((item) => item.id === route.params.recipeId), [recipes, route.params.recipeId]);
  if (isLoading) return <View style={nativeStyles.screen}><Loading /></View>;
  if (!recipe) return <View style={nativeStyles.screen}><Empty title="Recipe not found" body="It may have been deleted from this device." /></View>;
  return <RecipeEditForm recipe={recipe} onSave={updateRecipeAsync} onClose={navigation.goBack} />;
}

function RecipeEditForm({ recipe, onSave, onClose }: { recipe: Recipe; onSave: (data: UpdateRecipeInput) => Promise<Recipe>; onClose: () => void }) {
  const [title, setTitle] = useState(recipe.title); const [description, setDescription] = useState(recipe.description);
  const [ingredients, setIngredients] = useState(recipe.ingredients.join("\n")); const [steps, setSteps] = useState(recipe.steps.join("\n"));
  const save = async () => { if (!title.trim()) return Alert.alert("Title required"); await onSave({ id: recipe.id, title: title.trim(), description: description.trim(), ingredients: lines(ingredients), steps: lines(steps) }); onClose(); };
  return <View style={nativeStyles.screen}><ScrollView contentContainerStyle={nativeStyles.scroll} keyboardShouldPersistTaps="handled"><Text style={nativeStyles.label}>Title</Text><Field value={title} onChangeText={setTitle} /><Text style={nativeStyles.label}>Description</Text><Field value={description} onChangeText={setDescription} multiline /><Text style={nativeStyles.label}>Ingredients (one per line)</Text><Field value={ingredients} onChangeText={setIngredients} multiline /><Text style={nativeStyles.label}>Steps (one per line)</Text><Field value={steps} onChangeText={setSteps} multiline /><Button label="Save Changes" onPress={() => void save()} /><Button label="Cancel" variant="secondary" onPress={onClose} /></ScrollView></View>;
}

function lines(value: string) { return value.split("\n").map((line) => line.trim()).filter(Boolean); }
const styles = StyleSheet.create({ recipeTitle: { fontSize: 19, color: colors.espresso, fontWeight: "700" }, meta: { color: colors.saffronDeep, fontWeight: "600" }, detailTitle: { fontSize: 32, lineHeight: 38, fontWeight: "700", color: colors.espresso }, description: { color: colors.stone700, fontSize: 17, lineHeight: 25 }, line: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, bullet: { color: colors.saffronDeep, fontSize: 22 }, step: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", textAlign: "center", paddingTop: 4, backgroundColor: colors.saffronTint, color: colors.saffronDeep, fontWeight: "700" }, lineText: { flex: 1, color: colors.espresso, fontSize: 16, lineHeight: 24 }, preview: { gap: 8, padding: 12, backgroundColor: colors.saffronTint, borderRadius: 12 } });
