import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActionSheetIOS,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  deleteChatImages,
  storeChatImage,
} from "@/lib/chat-image-storage.native";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import Markdown from "react-native-markdown-display";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useRecipes } from "@/hooks/useRecipes";
import { FREE_RECIPE_LIMIT } from "@/lib/recipe-access";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { useSettings } from "@/hooks/useSettings";
import { extractRecipeFromConversation } from "@/lib/recipe-extractor";
import { extractPreference } from "@/lib/preference-extractor";
import { formatOpenRouterError } from "@/lib/openrouter-error";
import { useAccessibilityPreferences } from "@/native/accessibility";
import { isNearChatBottom } from "@/native/chat-scroll";
import { DictationField } from "@/native/DictationField";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import { Button, Chip, Field, Loading, nativeStyles } from "@/native/ui";

const mealTypes = ["breakfast", "lunch", "dinner", "snack", "dessert"] as const;
const mealSizes = ["1", "2", "4", "6+"] as const;
const prompts = [
  "What should I cook tonight?",
  "Help me use up leftover chicken",
  "Suggest a quick healthy lunch",
];

function showMessageInfo(message: ChatMessage) {
  Alert.alert(
    "Message information",
    message.modelId
      ? `Model: ${message.modelId}`
      : "Model information is unavailable for this message.",
  );
}

export function ChatScreen({
  chat,
  openSettings,
}: {
  chat: ReturnType<typeof useChat>;
  openSettings: () => void;
}) {
  const { createRecipeAsync, canCreateRecipe } = useRecipes();
  const { createPreferenceAsync } = useAiPreferences();
  const { effectiveProvider, effectiveModel, effectiveApiKey } = useSettings();
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  const lastSubmittedMessage = useRef<{
    text: string;
    imageDataUrl: string;
  } | null>(null);
  const shouldAutoScroll = useRef(true);
  const hasUserScrolled = useRef(false);
  const wasStreaming = useRef(chat.isStreaming);
  const { reduceTransparency } = useAccessibilityPreferences();
  const headerHeight = useHeaderHeight();

  const updateAutoScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasUserScrolled.current) return;
    const { contentSize, layoutMeasurement, contentOffset } = event.nativeEvent;
    shouldAutoScroll.current = isNearChatBottom(
      contentSize.height,
      layoutMeasurement.height,
      contentOffset.y,
    );
  };

  useEffect(() => {
    hasUserScrolled.current = false;
    shouldAutoScroll.current = true;
    requestAnimationFrame(() => {
      list.current?.scrollToEnd({ animated: false });
    });
  }, [chat.currentSessionId]);

  useEffect(() => {
    if (!chat.error) return;
    hasUserScrolled.current = false;
    shouldAutoScroll.current = true;
    const frame = requestAnimationFrame(() => {
      list.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [chat.error]);

  useEffect(() => {
    if (editingIndex === null) return;

    const scrollToEditor = () => {
      list.current?.scrollToIndex({
        index: editingIndex,
        animated: true,
        viewPosition: 0.5,
      });
    };
    const frame = requestAnimationFrame(scrollToEditor);
    const keyboardSubscription = Keyboard.addListener(
      "keyboardDidShow",
      scrollToEditor,
    );

    return () => {
      cancelAnimationFrame(frame);
      keyboardSubscription.remove();
    };
  }, [editingIndex]);

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
    if ((!text.trim() && !image) || chat.isStreaming || isDictating) return;
    const sent = text.trim();
    const sentImage = image;
    lastSubmittedMessage.current = { text: sent, imageDataUrl: sentImage };
    setText("");
    setImage("");
    Keyboard.dismiss();
    hasUserScrolled.current = false;
    shouldAutoScroll.current = true;
    void chat.sendMessage(sent, sentImage);
  };

  const receiveImage = async (result: ImagePicker.ImagePickerResult) => {
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    try {
      const storedImage = await storeChatImage(
        asset.uri,
        asset.width,
        asset.height,
      );
      if (image) deleteChatImages([image]);
      setImage(storedImage);
    } catch {
      Alert.alert("Couldn’t attach photo", "Please choose another photo.");
    }
  };

  const chooseImage = () => {
    const takePhoto = async () => {
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Camera access needed",
            "Allow Chefness to use the camera in iOS Settings.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => void Linking.openSettings(),
              },
            ],
          );
          return;
        }
        await receiveImage(
          await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.9,
          }),
        );
      } catch {
        Alert.alert(
          "Couldn’t open camera",
          "Please check camera access and try again.",
        );
      }
    };
    const chooseFromLibrary = () =>
      void ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      }).then(receiveImage);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Attach a photo",
          options: ["Cancel", "Take Photo", "Photo Library"],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) void takePhoto();
          if (index === 2) chooseFromLibrary();
        },
      );
      return;
    }
    Alert.alert("Attach a photo", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Take Photo", onPress: () => void takePhoto() },
      { text: "Photo Library", onPress: chooseFromLibrary },
    ]);
  };

  const retryLastMessage = () => {
    Keyboard.dismiss();
    hasUserScrolled.current = false;
    shouldAutoScroll.current = true;
    for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
      const message = chat.messages[index];
      if (message?.role === "user") {
        void chat.editUserMessageAndRegenerate(index, message.content);
        return;
      }
    }
    const pending = lastSubmittedMessage.current;
    if (pending) {
      void chat.sendMessage(pending.text, pending.imageDataUrl);
    }
  };

  const saveRecipe = async (index: number) => {
    if (!canCreateRecipe) {
      Alert.alert(
        "Unlock unlimited recipes",
        `The free version saves up to ${FREE_RECIPE_LIMIT} recipes. Upgrade once to save and import unlimited recipes.`,
        [
          { text: "Not Now", style: "cancel" },
          { text: "View Upgrade", onPress: openSettings },
        ],
      );
      return;
    }
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
        formatOpenRouterError(
          error,
          "OpenRouter couldn’t prepare this recipe to save.",
        ),
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
        formatOpenRouterError(
          error,
          "OpenRouter couldn’t prepare this memory to save.",
        ),
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
      style={nativeStyles.screen}
    >
      <FlatList
        ref={list}
        data={chat.messages}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        keyExtractor={(_message, index) => String(index)}
        contentContainerStyle={styles.messages}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="never"
        scrollsToTop={false}
        scrollEventThrottle={16}
        onScroll={updateAutoScroll}
        onLayout={() => {
          if (shouldAutoScroll.current) {
            list.current?.scrollToEnd({ animated: false });
          }
        }}
        onScrollBeginDrag={() => {
          hasUserScrolled.current = true;
          shouldAutoScroll.current = false;
        }}
        onContentSizeChange={() => {
          if (shouldAutoScroll.current) {
            list.current?.scrollToEnd({ animated: !chat.isStreaming });
          }
        }}
        ListHeaderComponent={
          <>
            {!chat.messages.length && (
              <View style={styles.welcome}>
                <Text style={styles.welcomeTitle}>What are we cooking?</Text>
                <Text style={nativeStyles.muted}>
                  Ask your personal cooking guru for ideas, recipes,
                  substitutions, or step-by-step help.
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
          </>
        }
        renderItem={({ item: message, index }) => (
          <View
            key={`${message.role}-${index}`}
            style={[
              styles.bubble,
              message.role === "user"
                ? styles.userBubble
                : styles.assistantBubble,
            ]}
          >
            {message.imageDataUrl ? (
              <Image
                accessible
                accessibilityLabel="Attached photo"
                source={{ uri: message.imageDataUrl }}
                style={styles.messageImage}
              />
            ) : null}
            {editingIndex === index ? (
              <>
                <Field
                  accessibilityLabel="Message to edit"
                  autoFocus
                  multiline
                  value={editDraft}
                  onChangeText={setEditDraft}
                />
                <View style={nativeStyles.row}>
                  <Button
                    label="Save & Regenerate"
                    disabled={!editDraft.trim()}
                    onPress={() => {
                      setEditingIndex(null);
                      void chat.editUserMessageAndRegenerate(
                        index,
                        editDraft.trim(),
                      );
                    }}
                  />
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => setEditingIndex(null)}
                  />
                </View>
              </>
            ) : (
              <>
                <Pressable
                  accessible
                  accessibilityLabel={`${message.role === "user" ? "You" : "Chefness"}: ${message.content || (chat.isStreaming ? "Thinking" : "")}`}
                  accessibilityHint={
                    message.role === "assistant"
                      ? "Long press for message information"
                      : undefined
                  }
                  accessibilityRole={
                    message.role === "assistant" ? "button" : undefined
                  }
                  delayLongPress={400}
                  onAccessibilityTap={
                    message.role === "assistant"
                      ? () => showMessageInfo(message)
                      : undefined
                  }
                  onLongPress={
                    message.role === "assistant"
                      ? () => showMessageInfo(message)
                      : undefined
                  }
                >
                  {message.role === "assistant" && message.content ? (
                    <Markdown style={markdownStyles}>
                      {message.content}
                    </Markdown>
                  ) : message.role === "assistant" && chat.isStreaming ? (
                    <Loading compact label="Thinking" />
                  ) : (
                    <Text selectable style={styles.messageText}>
                      {message.content}
                    </Text>
                  )}
                </Pressable>
                {message.role === "user" && !chat.isStreaming ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint="Edits this message inline, then regenerates the response"
                    style={styles.editMessage}
                    onPress={() => {
                      setEditDraft(message.content);
                      setEditingIndex(index);
                    }}
                  >
                    <Ionicons
                      accessible={false}
                      name="pencil-outline"
                      size={15}
                      color={colors.stone600}
                    />
                    <Text style={styles.editMessageText}>
                      Edit & regenerate
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
            {message.role === "assistant" &&
            message.content &&
            !chat.isStreaming ? (
              <View style={nativeStyles.row}>
                <Button
                  label={
                    message.savedRecipeId
                      ? "Recipe Saved ✓"
                      : busyAction === `recipe-${index}`
                        ? "Saving Recipe"
                        : "Save Recipe"
                  }
                  variant="secondary"
                  disabled={!!message.savedRecipeId || !!busyAction}
                  loading={busyAction === `recipe-${index}`}
                  onPress={() => void saveRecipe(index)}
                />
                <Button
                  label={
                    message.memorySaved
                      ? "Saved to Memory ✓"
                      : busyAction === `memory-${index}`
                        ? "Saving Memory"
                        : "Save to Memory"
                  }
                  variant="secondary"
                  disabled={!!message.memorySaved || !!busyAction}
                  loading={busyAction === `memory-${index}`}
                  onPress={() => void saveMemory(index)}
                />
              </View>
            ) : null}
          </View>
        )}
        ListFooterComponent={
          chat.error ? (
            <View
              accessibilityLiveRegion="assertive"
              style={[
                styles.errorBox,
                chat.isRecipeLimitError && styles.recipeLimitBox,
              ]}
            >
              <Text
                style={
                  chat.isRecipeLimitError
                    ? styles.recipeLimitText
                    : nativeStyles.error
                }
              >
                {chat.error}
              </Text>
              <Button
                label={
                  chat.isRecipeLimitError && !canCreateRecipe
                    ? "Open Settings"
                    : "Retry"
                }
                variant="secondary"
                onPress={
                  chat.isRecipeLimitError && !canCreateRecipe
                    ? openSettings
                    : retryLastMessage
                }
              />
            </View>
          ) : null
        }
      />
      {editingIndex === null && image ? (
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
            onPress={() => {
              deleteChatImages([image]);
              setImage("");
            }}
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
      {editingIndex === null ? (
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
          <DictationField
            accessibilityLabel="Message"
            value={text}
            onChangeText={setText}
            onDictatingChange={setIsDictating}
            placeholder="Ask your cooking guru…"
            multiline
            containerStyle={styles.composerField}
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
            accessibilityState={{
              disabled: !chat.isStreaming && isDictating,
            }}
            disabled={!chat.isStreaming && isDictating}
            style={[
              styles.iconButton,
              !chat.isStreaming && isDictating && styles.disabledButton,
            ]}
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
      ) : null}
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
  recipeLimitBox: { backgroundColor: colors.saffronTint },
  recipeLimitText: {
    color: colors.saffronDeep,
    lineHeight: 20,
    fontFamily: nativeFonts.sansBold,
  },
  composer: {
    minHeight: 66,
    paddingHorizontal: 8,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
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
  disabledButton: { opacity: 0.5 },
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
