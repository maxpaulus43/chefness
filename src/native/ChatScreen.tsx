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
  TextInput,
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
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useAccessibilityPreferences } from "@/native/accessibility";
import { isNearChatBottom } from "@/native/chat-scroll";
import { DictationField } from "@/native/DictationField";
import { haptics } from "@/native/haptics";
import { popIn, riseIn, springs } from "@/native/motion";
import { Celebration, PressableScale, TypingDots } from "@/native/motion-views";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import { Button, Chip, Field, nativeStyles } from "@/native/ui";

const mealTypes = ["breakfast", "lunch", "dinner", "snack", "dessert"] as const;
const mealSizes = ["1", "2", "4", "6+"] as const;
const prompts = [
  "What should I cook tonight?",
  "Help me use up leftover chicken",
  "Suggest a quick healthy lunch",
];

/**
 * The send control fills into a saffron disc as soon as there is something to
 * send, and swaps to a stop control while a response streams.
 */
function SendButton({
  active,
  streaming,
  disabled,
  onPress,
}: {
  active: boolean;
  streaming: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const filled = active || streaming;
  const progress = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    progress.set(withSpring(filled ? 1 : 0, springs.bouncy));
  }, [filled, progress]);
  const discStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.55 + 0.45 * progress.get() }],
  }));
  const outlineStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ rotate: `${(1 - progress.get()) * -45}deg` }],
  }));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={streaming ? "Stop response" : "Send message"}
      accessibilityHint={
        streaming
          ? "Stops Chefness from generating more text"
          : "Sends your message to Chefness"
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic={null}
      onPress={onPress}
      scaleTo={0.88}
      style={[styles.iconButton, disabled && styles.disabledButton]}
    >
      <Animated.View style={[styles.sendDisc, discStyle]} />
      <Animated.View style={[styles.sendGlyph, outlineStyle]}>
        <Ionicons
          accessible={false}
          name="arrow-up-circle-outline"
          size={30}
          color={colors.stone400}
        />
      </Animated.View>
      <Animated.View style={[styles.sendGlyph, fillStyle]}>
        <Ionicons
          accessible={false}
          name={streaming ? "stop" : "arrow-up"}
          size={22}
          color={colors.white}
        />
      </Animated.View>
    </PressableScale>
  );
}

function showMessageInfo(message: ChatMessage, selectText: () => void) {
  Alert.alert(
    "Message information",
    message.modelId
      ? `Model: ${message.modelId}`
      : "Model information is unavailable for this message.",
    [
      { text: "Select & Copy", onPress: selectText },
      { text: "Cancel", style: "cancel" },
    ],
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
  const [composerKey, setComposerKey] = useState(0);
  const [image, setImage] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );
  const [selectingMessage, setSelectingMessage] = useState<ChatMessage | null>(
    null,
  );
  const [editDraft, setEditDraft] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [bursts, setBursts] = useState<Record<string, number>>({});
  // Only messages added after the current session appeared animate in, so
  // opening a long conversation does not cascade dozens of bubbles.
  const [seenSessionId, setSeenSessionId] = useState(chat.currentSessionId);
  const [animateFromIndex, setAnimateFromIndex] = useState(
    chat.messages.length,
  );
  if (seenSessionId !== chat.currentSessionId) {
    setSeenSessionId(chat.currentSessionId);
    setAnimateFromIndex(chat.messages.length);
  }
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
  const editingIndex = editingMessage
    ? chat.messages.indexOf(editingMessage)
    : -1;

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
    haptics.error();
    hasUserScrolled.current = false;
    shouldAutoScroll.current = true;
    const frame = requestAnimationFrame(() => {
      list.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [chat.error]);

  useEffect(() => {
    if (editingIndex < 0) return;

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
      haptics.soft();
      AccessibilityInfo.announceForAccessibility("Chefness response complete");
    }
    wasStreaming.current = chat.isStreaming;
  }, [chat.isStreaming, chat.messages]);

  const submit = () => {
    if ((!text.trim() && !image) || chat.isStreaming || isDictating) return;
    const sent = text.trim();
    const sentImage = image;
    haptics.medium();
    lastSubmittedMessage.current = { text: sent, imageDataUrl: sentImage };
    setText("");
    setComposerKey((key) => key + 1);
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

  const celebrate = (key: string) => {
    haptics.success();
    setBursts((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));
  };

  const saveRecipe = async (index: number) => {
    if (!canCreateRecipe) {
      haptics.warning();
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
      celebrate(`recipe-${index}`);
      AccessibilityInfo.announceForAccessibility(
        `Recipe saved: ${saved.title}`,
      );
    } catch (error) {
      haptics.error();
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
      celebrate(`memory-${index}`);
      AccessibilityInfo.announceForAccessibility(
        `Saved to memory: ${preference}`,
      );
    } catch (error) {
      haptics.error();
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
                <Animated.View entering={riseIn()}>
                  <Text style={styles.welcomeTitle}>What are we cooking?</Text>
                </Animated.View>
                <Animated.View entering={riseIn().delay(60)}>
                  <Text style={nativeStyles.muted}>
                    Ask your personal cooking guru for ideas, recipes,
                    substitutions, or step-by-step help.
                  </Text>
                </Animated.View>
                <Animated.View
                  entering={riseIn().delay(140)}
                  style={styles.welcomeGroup}
                >
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
                </Animated.View>
                <Animated.View
                  entering={riseIn().delay(220)}
                  style={styles.welcomeGroup}
                >
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
                </Animated.View>
                {prompts.map((prompt, index) => (
                  <Animated.View
                    key={prompt}
                    entering={riseIn().delay(300 + index * 70)}
                  >
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityHint="Fills the message field with this suggestion"
                      haptic="select"
                      scaleTo={0.97}
                      style={styles.prompt}
                      onPress={() => setText(prompt)}
                    >
                      <Ionicons
                        accessible={false}
                        name="sparkles-outline"
                        size={17}
                        color={colors.saffron}
                      />
                      <Text style={styles.promptText}>{prompt}</Text>
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            )}
            {!chat.isConfigured && (
              <Animated.View entering={riseIn().delay(120)}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityHint="Opens OpenRouter connection settings"
                  onPress={openSettings}
                  scaleTo={0.97}
                  style={styles.setup}
                >
                  <Text style={styles.setupText}>
                    Connect OpenRouter in Settings to start chatting →
                  </Text>
                </PressableScale>
              </Animated.View>
            )}
          </>
        }
        renderItem={({ item: message, index }) => (
          <Animated.View
            key={`${message.role}-${index}`}
            entering={index >= animateFromIndex ? riseIn() : undefined}
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
                      setEditingMessage(null);
                      void chat.editUserMessageAndRegenerate(
                        index,
                        editDraft.trim(),
                      );
                    }}
                  />
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => setEditingMessage(null)}
                  />
                </View>
              </>
            ) : (
              <>
                {selectingMessage === message ? (
                  <View>
                    <TextInput
                      accessibilityLabel="Selectable assistant message"
                      autoFocus
                      multiline
                      readOnly
                      scrollEnabled={false}
                      selectTextOnFocus
                      showSoftInputOnFocus={false}
                      style={styles.selectableMessage}
                      value={message.content}
                    />
                    <Pressable
                      accessibilityRole="button"
                      style={styles.doneSelecting}
                      onPress={() => setSelectingMessage(null)}
                    >
                      <Text style={styles.doneSelectingText}>Done</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessible
                    accessibilityLabel={`${message.role === "user" ? "You" : "Chefness"}: ${message.content || (chat.isStreaming ? "Thinking" : "")}`}
                    accessibilityHint={
                      message.role === "assistant"
                        ? "Long press for message information and text selection"
                        : undefined
                    }
                    accessibilityRole={
                      message.role === "assistant" ? "button" : undefined
                    }
                    delayLongPress={400}
                    onAccessibilityTap={
                      message.role === "assistant"
                        ? () =>
                            showMessageInfo(message, () =>
                              setSelectingMessage(message),
                            )
                        : undefined
                    }
                    onLongPress={
                      message.role === "assistant"
                        ? () =>
                            showMessageInfo(message, () =>
                              setSelectingMessage(message),
                            )
                        : undefined
                    }
                  >
                    {message.role === "assistant" && message.content ? (
                      <Markdown style={markdownStyles}>
                        {message.content}
                      </Markdown>
                    ) : message.role === "assistant" && chat.isStreaming ? (
                      <TypingDots />
                    ) : (
                      <Text selectable style={styles.messageText}>
                        {message.content}
                      </Text>
                    )}
                  </Pressable>
                )}
                {message.role === "user" && !chat.isStreaming ? (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityHint="Edits this message inline, then regenerates the response"
                    haptic="select"
                    scaleTo={0.94}
                    style={styles.editMessage}
                    onPress={() => {
                      setEditDraft(message.content);
                      setEditingMessage(message);
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
                  </PressableScale>
                ) : null}
              </>
            )}
            {message.role === "assistant" &&
            message.content &&
            !chat.isStreaming ? (
              <Animated.View
                entering={FadeIn.duration(220)}
                style={nativeStyles.row}
              >
                <View style={styles.celebrated}>
                  <Button
                    label={
                      message.savedRecipeId
                        ? "Recipe Saved"
                        : busyAction === `recipe-${index}`
                          ? "Saving Recipe"
                          : "Save Recipe"
                    }
                    variant={message.savedRecipeId ? "success" : "secondary"}
                    icon="bookmark-outline"
                    disabled={!!message.savedRecipeId || !!busyAction}
                    loading={busyAction === `recipe-${index}`}
                    onPress={() => void saveRecipe(index)}
                  />
                  <Celebration burst={bursts[`recipe-${index}`] ?? 0} />
                </View>
                <View style={styles.celebrated}>
                  <Button
                    label={
                      message.memorySaved
                        ? "Saved to Memory"
                        : busyAction === `memory-${index}`
                          ? "Saving Memory"
                          : "Save to Memory"
                    }
                    variant={message.memorySaved ? "success" : "secondary"}
                    icon="sparkles-outline"
                    disabled={!!message.memorySaved || !!busyAction}
                    loading={busyAction === `memory-${index}`}
                    onPress={() => void saveMemory(index)}
                  />
                  <Celebration burst={bursts[`memory-${index}`] ?? 0} />
                </View>
              </Animated.View>
            ) : null}
          </Animated.View>
        )}
        ListFooterComponent={
          chat.error ? (
            <Animated.View
              accessibilityLiveRegion="assertive"
              entering={riseIn()}
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
            </Animated.View>
          ) : null
        }
      />
      {editingIndex < 0 && image ? (
        <Animated.View
          entering={popIn()}
          exiting={FadeOut.duration(140)}
          style={styles.preview}
        >
          <Image
            accessible
            accessibilityLabel="Photo ready to send"
            source={{ uri: image }}
            style={styles.previewImage}
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Remove attached photo"
            accessibilityHint="Removes the photo before sending"
            haptic="select"
            scaleTo={0.85}
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
          </PressableScale>
        </Animated.View>
      ) : null}
      {editingIndex < 0 ? (
        <View
          style={[styles.composer, reduceTransparency && styles.opaqueComposer]}
        >
          <View style={styles.composerInner}>
            {chat.canAttachImage && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Attach photo"
                accessibilityHint="Choose the camera or photo library"
                scaleTo={0.88}
                style={styles.iconButton}
                onPress={chooseImage}
              >
                <Ionicons
                  accessible={false}
                  name="camera-outline"
                  size={27}
                  color={colors.saffronDeep}
                />
              </PressableScale>
            )}
            <DictationField
              key={composerKey}
              accessibilityLabel="Message"
              value={text}
              onChangeText={setText}
              onDictatingChange={setIsDictating}
              placeholder="Ask your cooking guru…"
              multiline
              containerStyle={styles.composerField}
            />
            <SendButton
              active={!!text.trim() || !!image}
              streaming={chat.isStreaming}
              disabled={!chat.isStreaming && isDictating}
              onPress={chat.isStreaming ? chat.stopStreaming : submit}
            />
          </View>
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
  messages: {
    padding: 14,
    gap: 12,
    flexGrow: 1,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  welcome: { gap: 12, paddingVertical: 20 },
  welcomeGroup: { gap: 12 },
  welcomeTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: nativeFonts.serifBold,
    color: colors.espresso,
  },
  prompt: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    shadowColor: colors.espresso,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  promptText: {
    flex: 1,
    color: colors.saffronDeep,
    fontFamily: nativeFonts.sansSemiBold,
  },
  celebrated: { position: "relative" },
  setup: {
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.saffronTint,
    borderRadius: 12,
    padding: 14,
  },
  setupText: { color: colors.saffronDeep, fontFamily: nativeFonts.sansBold },
  bubble: { maxWidth: "92%", padding: 13, borderRadius: 19, gap: 9 },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.saffronTint,
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stone200,
    borderBottomLeftRadius: 6,
    shadowColor: colors.espresso,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  messageText: {
    color: colors.espresso,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: nativeFonts.sans,
  },
  selectableMessage: {
    color: colors.espresso,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: nativeFonts.sans,
    padding: 0,
  },
  doneSelecting: {
    minHeight: 44,
    alignSelf: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  doneSelectingText: {
    color: colors.saffronDeep,
    fontFamily: nativeFonts.sansSemiBold,
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
  composerInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisc: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.saffron,
    shadowColor: colors.saffronDeep,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  sendGlyph: { position: "absolute" },
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
