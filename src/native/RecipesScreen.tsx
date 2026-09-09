import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRecipes } from "@/hooks/useRecipes";
import { useCookingLog } from "@/hooks/useCookingLog";
import { useRecipeAiEditor } from "@/hooks/useRecipeAiEditor";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";
import { recipeToMarkdown } from "@/lib/recipe-markdown";
import type { Recipe, UpdateRecipeInput } from "@/types/recipe";
import type { RecipesStackParamList } from "@/native/navigation-routes";
import { DictationField } from "@/native/DictationField";
import { haptics } from "@/native/haptics";
import {
  layoutTransition,
  popIn,
  riseIn,
  useStaggeredEntering,
} from "@/native/motion";
import { Celebration, PressableScale } from "@/native/motion-views";
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
  const enteringFor = useStaggeredEntering();
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
      <Animated.FlatList
        data={search.visibleRecipes}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        itemLayoutAnimation={layoutTransition}
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
              icon="book-outline"
              title="No saved recipes yet"
              body="Chat with your cooking guru and save recipes you like!"
            />
          ) : (
            <Empty
              icon="search-outline"
              title="No matching recipes"
              body="Try another title, description, or ingredient."
            />
          )
        }
        renderItem={({ item: recipe, index }) => (
          <Animated.View
            entering={enteringFor(index)}
            exiting={FadeOut.duration(180)}
          >
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
                  <View style={styles.metaRow}>
                    <Ionicons
                      accessible={false}
                      name="list-outline"
                      size={15}
                      color={colors.saffronDeep}
                    />
                    <Text style={styles.meta}>
                      {recipe.ingredients.length} ingredients
                    </Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Ionicons
                      accessible={false}
                      name="footsteps-outline"
                      size={15}
                      color={colors.saffronDeep}
                    />
                    <Text style={styles.meta}>{recipe.steps.length} steps</Text>
                  </View>
                </Card>
              </View>
            </ListInteractionRow>
          </Animated.View>
        )}
      />
    </View>
  );
}

/**
 * A recipe line the cook can tap to check off while working through the
 * recipe. Checked state is deliberately ephemeral; it resets when the screen
 * is left.
 */
function ChecklistLine({
  text,
  marker,
  checked,
  onToggle,
  accessibilityLabel,
}: {
  text: string;
  marker: string | number;
  checked: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Toggles whether this is done"
      haptic="soft"
      scaleTo={0.985}
      style={styles.checkLine}
      onPress={onToggle}
    >
      <View style={[styles.marker, checked && styles.markerChecked]}>
        {checked ? (
          <Animated.View key="check" entering={popIn()}>
            <Ionicons
              accessible={false}
              name="checkmark"
              size={17}
              color={colors.white}
            />
          </Animated.View>
        ) : (
          <Text accessible={false} style={styles.markerText}>
            {marker}
          </Text>
        )}
      </View>
      <Text style={[styles.lineText, checked && styles.lineTextChecked]}>
        {text}
      </Text>
    </PressableScale>
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
  const [cookedBurst, setCookedBurst] = useState(0);
  const [stepsBurst, setStepsBurst] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<number[]>([]);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
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
      haptics.success();
      setCookedBurst((count) => count + 1);
    } catch (error) {
      setLogStatus("idle");
      haptics.error();
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
  const toggleIngredient = (index: number) =>
    setCheckedIngredients((current) =>
      current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index],
    );
  const toggleStep = (index: number) => {
    const next = checkedSteps.includes(index)
      ? checkedSteps.filter((value) => value !== index)
      : [...checkedSteps, index];
    setCheckedSteps(next);
    if (next.length === recipe.steps.length && recipe.steps.length > 1) {
      haptics.success();
      setStepsBurst((count) => count + 1);
    }
  };
  const allStepsDone =
    recipe.steps.length > 0 && checkedSteps.length === recipe.steps.length;
  return (
    <View style={nativeStyles.screen}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={nativeStyles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={riseIn()}>
          <Text accessibilityRole="header" style={styles.detailTitle}>
            {recipe.title}
          </Text>
        </Animated.View>
        <Animated.View entering={riseIn().delay(50)}>
          <Text style={styles.description}>{recipe.description}</Text>
        </Animated.View>
        <Animated.View entering={riseIn().delay(110)} style={nativeStyles.row}>
          <View style={styles.celebrated}>
            <Button
              label={
                logStatus === "logged"
                  ? "Cooked"
                  : logStatus === "logging"
                    ? "Logging…"
                    : "I Cooked This"
              }
              icon={logStatus === "logged" ? undefined : "flame-outline"}
              variant={logStatus === "logged" ? "success" : "primary"}
              haptic="medium"
              disabled={logStatus !== "idle"}
              onPress={() => void logMeal()}
            />
            <Celebration burst={cookedBurst} />
          </View>
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
        </Animated.View>
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
              ai.status === "generating"
                ? "Generating Preview"
                : "Generate Preview"
            }
            loading={ai.status === "generating"}
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
                    ai.status === "applying"
                      ? "Applying AI Edit"
                      : "Apply AI Edit"
                  }
                  disabled={ai.status === "applying"}
                  loading={ai.status === "applying"}
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
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
            Ingredients
          </Text>
          <Text style={styles.sectionHint}>Tap to check off</Text>
        </View>
        {recipe.ingredients.map((item, index) => (
          <ChecklistLine
            key={`${item}-${index}`}
            text={item}
            marker=""
            checked={checkedIngredients.includes(index)}
            onToggle={() => toggleIngredient(index)}
            accessibilityLabel={item}
          />
        ))}
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
            Steps
          </Text>
          {allStepsDone ? (
            <Animated.View entering={popIn()} style={styles.doneBadge}>
              <Ionicons
                accessible={false}
                name="checkmark-circle"
                size={16}
                color={colors.success}
              />
              <Text style={styles.doneBadgeText}>All done</Text>
            </Animated.View>
          ) : null}
          <Celebration burst={stepsBurst} />
        </View>
        {recipe.steps.map((item, index) => (
          <ChecklistLine
            key={`${item}-${index}`}
            text={item}
            marker={index + 1}
            checked={checkedSteps.includes(index)}
            onToggle={() => toggleStep(index)}
            accessibilityLabel={`Step ${index + 1}. ${item}`}
          />
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
        <Button
          label="Save Changes"
          haptic="medium"
          onPress={() => void save()}
        />
        <Button
          label="Cancel"
          variant="secondary"
          haptic={null}
          onPress={onClose}
        />
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
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { color: colors.saffronDeep, fontFamily: nativeFonts.sansSemiBold },
  metaDot: { color: colors.stone400, marginHorizontal: 2 },
  celebrated: { position: "relative" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    position: "relative",
  },
  sectionHint: {
    color: colors.stone500,
    fontSize: 13,
    fontFamily: nativeFonts.sans,
  },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.successTint,
    borderWidth: 1,
    borderColor: colors.successTintBorder,
  },
  doneBadgeText: {
    color: colors.success,
    fontSize: 13,
    fontFamily: nativeFonts.sansBold,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.saffronTint,
    borderWidth: 1.5,
    borderColor: colors.saffronTintBorder,
  },
  markerChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  markerText: {
    color: colors.saffronDeep,
    fontSize: 14,
    fontFamily: nativeFonts.sansBold,
  },
  lineTextChecked: {
    color: colors.stone400,
    textDecorationLine: "line-through",
  },
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
  checkLine: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    minHeight: 44,
    paddingVertical: 4,
  },
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
