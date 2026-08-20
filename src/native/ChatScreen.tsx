import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActionSheetIOS,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import { useChat } from "@/hooks/useChat";
import { useRecipes } from "@/hooks/useRecipes";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { useSettings } from "@/hooks/useSettings";
import { extractRecipeFromConversation } from "@/lib/recipe-extractor";
import { extractPreference } from "@/lib/preference-extractor";
import { useAccessibilityPreferences } from "@/native/accessibility";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import { Button, Chip, Field, nativeStyles } from "@/native/ui";

const mealTypes = ["breakfast", "lunch", "dinner", "snack", "dessert"] as const;
const mealSizes = ["1", "2", "4", "6+"] as const;
const prompts = [
  "What should I cook tonight?",
  "Help me use up leftover chicken",
  "Suggest a quick healthy lunch",
];

export function ChatScreen({
  chat,
  openSettings,
  openEdit,
}: {
  chat: ReturnType<typeof useChat>;
  openSettings: () => void;
  openEdit: (index: number, content: string) => void;
}) {
  const { createRecipeAsync } = useRecipes();
  const { createPreferenceAsync } = useAiPreferences();
  const { effectiveProvider, effectiveModel, effectiveApiKey } = useSettings();
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const wasStreaming = useRef(chat.isStreaming);
  const { reduceTransparency } = useAccessibilityPreferences();

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [chat.messages]);
  useEffect(() => {
    if (
      wasStreaming.current &&
      !chat.isStreaming &&
      chat.messages[chat.messages.length - 1]?.role === "assistant"
    ) {
      AccessibilityInfo.announceForAccessibility("Chefness response complete");
    }
    wasStreaming.current = chat.isStreaming;
  }, [chat.isStreaming, chat.messages]);

  const submit = () => {
    if ((!text.trim() && !image) || chat.isStreaming) return;
    const sent = text.trim();
    setText("");
    const sentImage = image;
    setImage("");
    void chat.sendMessage(sent, sentImage);
  };

  const receiveImage = (result: ImagePicker.ImagePickerResult) => {
    const asset = result.assets?.[0];
    if (!result.canceled && asset)
      setImage(
        asset.base64
          ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
          : asset.uri,
      );
  };

  const chooseImage = () => {
    const takePhoto = () =>
      void ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.72,
        base64: true,
      }).then(receiveImage);
    const chooseFromLibrary = () =>
      void ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.72,
        base64: true,
      }).then(receiveImage);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Attach a photo",
          options: ["Cancel", "Take Photo", "Photo Library"],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) takePhoto();
          if (index === 2) chooseFromLibrary();
        },
      );
      return;
    }
    Alert.alert("Attach a photo", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Take Photo", onPress: takePhoto },
      { text: "Photo Library", onPress: chooseFromLibrary },
    ]);
  };

  const retryLastMessage = () => {
    for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
      const message = chat.messages[index];
      if (message?.role === "user") {
        void chat.editUserMessageAndRegenerate(index, message.content);
        return;
      }
    }
  };

  const saveRecipe = async (index: number) => {
    setBusyAction(`recipe-${index}`);
    try {
      const recipe = await extractRecipeFromConversation({
        messages: chat.messages.slice(0, index + 1),
        providerId: effectiveProvider,
        modelId: effectiveModel,
        apiKey: effectiveApiKey,
      });
      const saved = await createRecipeAsync(recipe);
      chat.setMessageFlag(index, "savedRecipeId", saved.id);
      Alert.alert("Recipe saved", saved.title);
    } catch (error) {
      Alert.alert(
        "Couldn’t save recipe",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const saveMemory = async (index: number) => {
    setBusyAction(`memory-${index}`);
    try {
      const start = Math.max(0, index - 2);
      const snippet = chat.messages
        .slice(start, index + 1)
        .map((message) => `${message.role}: ${message.content}`)
        .join("\n");
      const preference = await extractPreference({
        conversationSnippet: snippet,
        providerId: effectiveProvider,
        modelId: effectiveModel,
        apiKey: effectiveApiKey,
      });
      await createPreferenceAsync({ text: preference });
      chat.setMessageFlag(index, "memorySaved", true);
      Alert.alert("Saved to memory", preference);
    } catch (error) {
      Alert.alert(
        "Couldn’t save memory",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={nativeStyles.screen}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        scrollsToTop={false}
      >
        {!chat.messages.length && (
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>What are we cooking?</Text>
            <Text style={nativeStyles.muted}>
              Ask your personal cooking guru for ideas, recipes, substitutions,
              or step-by-step help.
            </Text>
            <Text style={nativeStyles.label}>Meal type</Text>
            <View style={nativeStyles.row}>
              {mealTypes.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  selected={chat.mealType === item}
                  onPress={() => chat.setMealType(item)}
                />
              ))}
            </View>
            <Text style={nativeStyles.label}>Cooking for</Text>
            <View style={nativeStyles.row}>
              {mealSizes.map((item) => (
                <Chip
                  key={item}
                  label={item === "6+" ? "6+ people" : item}
                  selected={chat.mealSize === item}
                  onPress={() => chat.setMealSize(item)}
                />
              ))}
            </View>
            {prompts.map((prompt) => (
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Fills the message field with this suggestion"
                key={prompt}
                style={styles.prompt}
                onPress={() => setText(prompt)}
              >
                <Text style={styles.promptText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {!chat.isConfigured && (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens OpenRouter connection settings"
            onPress={openSettings}
            style={styles.setup}
          >
            <Text style={styles.setupText}>
              Connect OpenRouter in Settings to start chatting →
            </Text>
          </Pressable>
        )}
        {chat.messages.map((message, index) => (
          <View
            key={`${message.role}-${index}`}
            style={[
              styles.bubble,
              message.role === "user"
                ? styles.userBubble
                : styles.assistantBubble,
            ]}
          >
            <View
              accessible
              accessibilityLabel={`${message.role === "user" ? "You" : "Chefness"}: ${message.content || (chat.isStreaming ? "Thinking" : "")}`}
            >
              {message.imageDataUrl ? (
                <Image
                  accessible
                  accessibilityLabel="Attached photo"
                  source={{ uri: message.imageDataUrl }}
                  style={styles.messageImage}
                />
              ) : null}
              {message.role === "assistant" && message.content ? (
                <Markdown style={markdownStyles}>{message.content}</Markdown>
              ) : (
                <Text selectable style={styles.messageText}>
                  {message.content || (chat.isStreaming ? "Thinking…" : "")}
                </Text>
              )}
            </View>
            {message.role === "user" && !chat.isStreaming ? (
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Opens this message for editing, then regenerates the response"
                style={styles.editMessage}
                onPress={() => openEdit(index, message.content)}
              >
                <Ionicons
                  accessible={false}
                  name="pencil-outline"
                  size={15}
                  color={colors.stone600}
                />
                <Text style={styles.editMessageText}>Edit & regenerate</Text>
              </Pressable>
            ) : null}
            {message.role === "assistant" && message.content ? (
              <View style={nativeStyles.row}>
                <Button
                  label={
                    message.savedRecipeId
                      ? "Recipe Saved ✓"
                      : busyAction === `recipe-${index}`
                        ? "Saving Recipe…"
                        : "Save Recipe"
                  }
                  variant="secondary"
                  disabled={!!message.savedRecipeId || !!busyAction}
                  onPress={() => void saveRecipe(index)}
                />
                <Button
                  label={
                    message.memorySaved
                      ? "Saved to Memory ✓"
                      : busyAction === `memory-${index}`
                        ? "Saving Memory…"
                        : "Save to Memory"
                  }
                  variant="secondary"
                  disabled={!!message.memorySaved || !!busyAction}
                  onPress={() => void saveMemory(index)}
                />
              </View>
            ) : null}
          </View>
        ))}
        {chat.error && (
          <View accessibilityLiveRegion="assertive" style={styles.errorBox}>
            <Text style={nativeStyles.error}>{chat.error}</Text>
            <Button
              label="Retry"
              variant="secondary"
              onPress={retryLastMessage}
            />
          </View>
        )}
      </ScrollView>
      {image ? (
        <View style={styles.preview}>
          <Image
            accessible
            accessibilityLabel="Photo ready to send"
            source={{ uri: image }}
            style={styles.previewImage}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove attached photo"
            accessibilityHint="Removes the photo before sending"
            style={styles.iconButton}
            onPress={() => setImage("")}
          >
            <Ionicons
              accessible={false}
              name="close-circle"
              size={28}
              color={colors.danger}
            />
          </Pressable>
        </View>
      ) : null}
      <View
        style={[styles.composer, reduceTransparency && styles.opaqueComposer]}
      >
        {chat.canAttachImage && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach photo"
            accessibilityHint="Choose the camera or photo library"
            style={styles.iconButton}
            onPress={chooseImage}
          >
            <Ionicons
              accessible={false}
              name="camera-outline"
              size={27}
              color={colors.saffronDeep}
            />
          </Pressable>
        )}
        <Field
          accessibilityLabel="Message"
          value={text}
          onChangeText={setText}
          placeholder="Ask your cooking guru…"
          multiline
          style={styles.composerField}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            chat.isStreaming ? "Stop response" : "Send message"
          }
          accessibilityHint={
            chat.isStreaming
              ? "Stops Chefness from generating more text"
              : "Sends your message to Chefness"
          }
          style={styles.iconButton}
          onPress={chat.isStreaming ? chat.stopStreaming : submit}
        >
          <Ionicons
            accessible={false}
            name={chat.isStreaming ? "stop-circle" : "send"}
            size={28}
            color={colors.saffronDeep}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  editMessage: {
    minHeight: 44,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
  },
  editMessageText: {
    color: colors.stone600,
    fontSize: 12,
    fontFamily: nativeFonts.sansSemiBold,
  },
  messages: { padding: 14, gap: 12, flexGrow: 1 },
  welcome: { gap: 12, paddingVertical: 20 },
  welcomeTitle: {
    fontSize: 28,
    fontFamily: nativeFonts.serifBold,
    color: colors.espresso,
  },
  prompt: {
    minHeight: 44,
    justifyContent: "center",
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  promptText: {
    color: colors.saffronDeep,
    fontFamily: nativeFonts.sansSemiBold,
  },
  setup: {
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.saffronTint,
    borderRadius: 12,
    padding: 14,
  },
  setupText: { color: colors.saffronDeep, fontFamily: nativeFonts.sansBold },
  bubble: { maxWidth: "92%", padding: 13, borderRadius: 17, gap: 9 },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.saffronTint },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stone200,
  },
  messageText: {
    color: colors.espresso,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: nativeFonts.sans,
  },
  messageImage: { width: 220, height: 160, borderRadius: 12 },
  errorBox: {
    gap: 8,
    padding: 12,
    backgroundColor: colors.dangerTint,
    borderRadius: 12,
  },
  composer: {
    minHeight: 66,
    paddingHorizontal: 8,
    paddingVertical: 9,
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stone200,
    backgroundColor: colors.glassStrong,
  },
  opaqueComposer: { backgroundColor: colors.white, borderTopWidth: 1 },
  composerField: { flex: 1, maxHeight: 160 },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  previewImage: { width: 64, height: 64, borderRadius: 10 },
});

const markdownStyles = {
  body: {
    color: colors.espresso,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: nativeFonts.sans,
  },
  heading1: {
    color: colors.espresso,
    fontSize: 23,
    fontFamily: nativeFonts.serifBold,
    marginTop: 4,
    marginBottom: 8,
  },
  heading2: {
    color: colors.espresso,
    fontSize: 19,
    fontFamily: nativeFonts.serifBold,
    marginTop: 4,
    marginBottom: 6,
  },
  paragraph: { marginTop: 0, marginBottom: 8 },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  strong: { fontFamily: nativeFonts.sansBold },
  link: { color: colors.saffronDeep },
};
