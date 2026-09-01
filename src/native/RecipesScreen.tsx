import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRecipes } from "@/hooks/useRecipes";
import { useCookingLog } from "@/hooks/useCookingLog";
import { useRecipeAiEditor } from "@/hooks/useRecipeAiEditor";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";
import { recipeToMarkdown } from "@/lib/recipe-markdown";
import type { Recipe, UpdateRecipeInput } from "@/types/recipe";
import type { RecipesStackParamList } from "@/native/navigation-routes";
import { DictationField } from "@/native/DictationField";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import { ListInteractionRow } from "@/native/ListInteractionRow";
import {
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Loading,
  nativeStyles,
} from "@/native/ui";

export function RecipeListScreen({
  navigation,
}: NativeStackScreenProps<RecipesStackParamList, "RecipeList">) {
  const { recipes, isLoading, deleteRecipe } = useRecipes();
  const search = useRecipeSearch(recipes);
  const confirmDelete = (recipe: Recipe) =>
    Alert.alert("Delete recipe?", recipe.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteRecipe(recipe.id),
      },
    ]);
  if (isLoading)
    return (
      <View style={nativeStyles.screen}>
        <Loading />
      </View>
    );
  return (
    <View style={nativeStyles.screen}>
      <FlatList
        data={search.visibleRecipes}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        keyExtractor={(recipe) => recipe.id}
        contentContainerStyle={nativeStyles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          recipes.length > 0 ? (
            <View style={styles.listControls}>
              <DictationField
                accessibilityLabel="Search recipes and ingredients"
                value={search.searchQuery}
                onChangeText={search.setSearchQuery}
                placeholder="Search recipes and ingredients…"
              />
              <View style={nativeStyles.row}>
                <Chip
                  label="Newest"
                  selected={search.sortOption === "newest"}
                  onPress={() => search.setSortOption("newest")}
                />
                <Chip
                  label="Oldest"
                  selected={search.sortOption === "oldest"}
                  onPress={() => search.setSortOption("oldest")}
                />
                <Chip
                  label="A–Z"
                  selected={search.sortOption === "title-asc"}
                  onPress={() => search.setSortOption("title-asc")}
                />
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          recipes.length === 0 ? (
            <Empty
              title="No saved recipes yet"
              body="Chat with your cooking guru and save recipes you like!"
            />
          ) : (
            <Empty
              title="No matching recipes"
              body="Try another title, description, or ingredient."
            />
          )
        }
        renderItem={({ item: recipe }) => (
          <ListInteractionRow
            menuActions={[
              { id: "open", title: "Open", image: "book" },
              { id: "edit", title: "Edit", image: "pencil" },
              {
                id: "delete",
                title: "Delete",
                image: "trash",
                attributes: { destructive: true },
              },
            ]}
            onDelete={() => confirmDelete(recipe)}
            onPress={() =>
              navigation.navigate("RecipeDetail", { recipeId: recipe.id })
            }
            onMenuAction={(id) => {
              if (id === "open")
                navigation.navigate("RecipeDetail", { recipeId: recipe.id });
              if (id === "edit")
                navigation.navigate("RecipeEdit", { recipeId: recipe.id });
              if (id === "delete") confirmDelete(recipe);
            }}
          >
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${recipe.title}. ${recipe.description}. ${recipe.ingredients.length} ingredients, ${recipe.steps.length} steps`}
              accessibilityHint="Opens recipe details; long press for more actions"
            >
              <Card style={styles.menuCard}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                <Text style={nativeStyles.muted}>{recipe.description}</Text>
                <Text style={styles.meta}>
                  {recipe.ingredients.length} ingredients ·{" "}
                  {recipe.steps.length} steps
                </Text>
              </Card>
            </View>
          </ListInteractionRow>
        )}
      />
    </View>
  );
}

export function RecipeDetailScreen({
  route,
  navigation,
}: NativeStackScreenProps<RecipesStackParamList, "RecipeDetail">) {
  const { recipes, isLoading, deleteRecipe } = useRecipes();
  const { createEntryAsync } = useCookingLog();
  const recipe = useMemo(
    () => recipes.find((item) => item.id === route.params.recipeId),
    [recipes, route.params.recipeId],
  );
  const [instruction, setInstruction] = useState("");
  const [logStatus, setLogStatus] = useState<"idle" | "logging" | "logged">(
    "idle",
  );
  const ai = useRecipeAiEditor();
  useEffect(() => {
    if (recipe) navigation.setOptions({ title: recipe.title });
  }, [navigation, recipe]);
  if (isLoading)
    return (
      <View style={nativeStyles.screen}>
        <Loading />
      </View>
    );
  if (!recipe)
    return (
      <View style={nativeStyles.screen}>
        <Empty
          title="Recipe not found"
          body="It may have been deleted from this device."
        />
      </View>
    );
  const shareRecipe = async () => {
    try {
      await Share.share(
        { title: recipe.title, message: recipeToMarkdown(recipe) },
        { subject: recipe.title },
      );
    } catch {
      Alert.alert(
        "Unable to share",
        "The recipe could not be shared. Please try again.",
      );
    }
  };
  const logMeal = async () => {
    setLogStatus("logging");
    try {
      await createEntryAsync({
        title: recipe.title,
        date: new Date().toISOString().slice(0, 10),
        rating: null,
        comment: "",
        recipeId: recipe.id,
      });
      setLogStatus("logged");
    } catch (error) {
      setLogStatus("idle");
      Alert.alert(
        "Couldn’t add to history",
        error instanceof Error ? error.message : "Try again.",
      );
    }
  };
  const showPreviewInfo = () =>
    Alert.alert(
      "Preview information",
      ai.previewModelId
        ? `Model: ${ai.previewModelId}`
        : "Model information is unavailable for this preview.",
    );
  const confirmDelete = () =>
    Alert.alert("Delete recipe?", recipe.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteRecipe(recipe.id);
          navigation.popToTop();
        },
      },
    ]);
  return (
    <View style={nativeStyles.screen}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={nativeStyles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={styles.detailTitle}>
          {recipe.title}
        </Text>
        <Text style={styles.description}>{recipe.description}</Text>
        <View style={nativeStyles.row}>
          <Button
            label={
              logStatus === "logged"
                ? "Cooked ✓"
                : logStatus === "logging"
                  ? "Logging…"
                  : "I Cooked This"
            }
            disabled={logStatus !== "idle"}
            onPress={() => void logMeal()}
          />
          <Button
            label="Edit"
            variant="secondary"
            onPress={() =>
              navigation.navigate("RecipeEdit", { recipeId: recipe.id })
            }
          />
          <Button
            label="Share"
            variant="secondary"
            onPress={() => void shareRecipe()}
          />
          <Button label="Delete" variant="danger" onPress={confirmDelete} />
        </View>
        <Card>
          <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
            Edit with AI
          </Text>
          <Text style={nativeStyles.muted}>
            Describe a change, preview the complete updated recipe, then apply
            it.
          </Text>
          <DictationField
            accessibilityLabel="Recipe edit instructions"
            value={instruction}
            onChangeText={setInstruction}
            multiline
            placeholder="Make it vegetarian and reduce prep time…"
          />
          <Button
            disabled={ai.status === "generating"}
            label={
              ai.status === "generating" ? "Generating…" : "Generate Preview"
            }
            onPress={() => void ai.generateEdit(recipe, instruction)}
          />
          {ai.error && (
            <Text
              accessibilityLiveRegion="assertive"
              style={nativeStyles.error}
            >
              {ai.error}
            </Text>
          )}
          {ai.draftRecipe && (
            <View style={styles.preview}>
              <Pressable
                accessibilityHint="Long press for preview information"
                accessibilityRole="button"
                onAccessibilityTap={showPreviewInfo}
                onLongPress={showPreviewInfo}
                style={styles.previewContent}
              >
                <Text style={styles.recipeTitle}>{ai.draftRecipe.title}</Text>
                <Text style={nativeStyles.muted}>
                  {ai.draftRecipe.description}
                </Text>
                <Text
                  accessibilityRole="header"
                  style={nativeStyles.sectionTitle}
                >
                  Ingredients
                </Text>
                {ai.draftRecipe.ingredients.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.line}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.lineText}>{item}</Text>
                  </View>
                ))}
                <Text
                  accessibilityRole="header"
                  style={nativeStyles.sectionTitle}
                >
                  Steps
                </Text>
                {ai.draftRecipe.steps.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.line}>
                    <Text style={styles.step}>{index + 1}</Text>
                    <Text style={styles.lineText}>{item}</Text>
                  </View>
                ))}
              </Pressable>
              <View style={nativeStyles.row}>
                <Button
                  label={
                    ai.status === "applying" ? "Applying…" : "Apply AI Edit"
                  }
                  disabled={ai.status === "applying"}
                  onPress={() => void ai.applyEdit(recipe.id)}
                />
                <Button
                  label="Cancel"
                  variant="secondary"
                  disabled={ai.status === "applying"}
                  onPress={() => {
                    ai.reset();
                    setInstruction("");
                  }}
                />
              </View>
            </View>
          )}
        </Card>
        <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
          Ingredients
        </Text>
        {recipe.ingredients.map((item, index) => (
          <View
            accessible
            accessibilityLabel={item}
            key={`${item}-${index}`}
            style={styles.line}
          >
            <Text accessible={false} style={styles.bullet}>
              •
            </Text>
            <Text style={styles.lineText}>{item}</Text>
          </View>
        ))}
        <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
          Steps
        </Text>
        {recipe.steps.map((item, index) => (
          <View
            accessible
            accessibilityLabel={`Step ${index + 1}. ${item}`}
            key={`${item}-${index}`}
            style={styles.line}
          >
            <Text accessible={false} style={styles.step}>
              {index + 1}
            </Text>
            <Text style={styles.lineText}>{item}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function RecipeEditScreen({
  route,
  navigation,
}: NativeStackScreenProps<RecipesStackParamList, "RecipeEdit">) {
  const { recipes, isLoading, updateRecipeAsync } = useRecipes();
  const recipe = useMemo(
    () => recipes.find((item) => item.id === route.params.recipeId),
    [recipes, route.params.recipeId],
  );
  if (isLoading)
    return (
      <View style={nativeStyles.screen}>
        <Loading />
      </View>
    );
  if (!recipe)
    return (
      <View style={nativeStyles.screen}>
        <Empty
          title="Recipe not found"
          body="It may have been deleted from this device."
        />
      </View>
    );
  return (
    <RecipeEditForm
      recipe={recipe}
      onSave={updateRecipeAsync}
      onClose={navigation.goBack}
    />
  );
}

function RecipeEditForm({
  recipe,
  onSave,
  onClose,
}: {
  recipe: Recipe;
  onSave: (data: UpdateRecipeInput) => Promise<Recipe>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(recipe.title);
  const [description, setDescription] = useState(recipe.description);
  const [ingredients, setIngredients] = useState(recipe.ingredients.join("\n"));
  const [steps, setSteps] = useState(recipe.steps.join("\n"));
  const save = async () => {
    if (!title.trim()) return Alert.alert("Title required");
    await onSave({
      id: recipe.id,
      title: title.trim(),
      description: description.trim(),
      ingredients: lines(ingredients),
      steps: lines(steps),
    });
    onClose();
  };
  return (
    <View style={nativeStyles.screen}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={nativeStyles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={nativeStyles.label}>Title</Text>
        <Field
          accessibilityLabel="Title"
          value={title}
          onChangeText={setTitle}
        />
        <Text style={nativeStyles.label}>Description</Text>
        <Field
          accessibilityLabel="Description"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Text style={nativeStyles.label}>Ingredients (one per line)</Text>
        <Field
          accessibilityLabel="Ingredients, one per line"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
        />
        <Text style={nativeStyles.label}>Steps (one per line)</Text>
        <Field
          accessibilityLabel="Steps, one per line"
          value={steps}
          onChangeText={setSteps}
          multiline
        />
        <Button label="Save Changes" onPress={() => void save()} />
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </ScrollView>
    </View>
  );
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
const styles = StyleSheet.create({
  listControls: { gap: 12 },
  recipeTitle: {
    fontSize: 19,
    color: colors.espresso,
    fontFamily: nativeFonts.serifBold,
  },
  meta: { color: colors.saffronDeep, fontFamily: nativeFonts.sansSemiBold },
  detailTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: nativeFonts.serifBold,
    color: colors.espresso,
  },
  description: {
    color: colors.stone700,
    fontSize: 17,
    lineHeight: 25,
    fontFamily: nativeFonts.sans,
  },
  line: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bullet: {
    color: colors.saffronDeep,
    fontSize: 22,
    fontFamily: nativeFonts.sans,
  },
  step: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 14,
    overflow: "hidden",
    textAlign: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: colors.saffronTint,
    color: colors.saffronDeep,
    fontFamily: nativeFonts.sansBold,
  },
  lineText: {
    flex: 1,
    color: colors.espresso,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: nativeFonts.sans,
  },
  menuCard: { paddingBottom: 48 },
  preview: {
    gap: 8,
    padding: 12,
    backgroundColor: colors.saffronTint,
    borderRadius: 12,
  },
  previewContent: { gap: 8 },
});
