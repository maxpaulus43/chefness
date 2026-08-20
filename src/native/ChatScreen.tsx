import { useEffect, useRef, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import { useChat } from "@/hooks/useChat";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useRecipes } from "@/hooks/useRecipes";
import { useCookingLog } from "@/hooks/useCookingLog";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { useSettings } from "@/hooks/useSettings";
import { extractRecipeFromConversation } from "@/lib/recipe-extractor";
import { extractPreference } from "@/lib/preference-extractor";
import { colors } from "@/theme";
import { Button, Chip, Field, ScreenHeader, nativeStyles } from "@/native/ui";

const mealTypes = ["breakfast", "lunch", "dinner", "snack", "dessert"] as const;
const mealSizes = ["1", "2", "4", "6+"] as const;
const prompts = ["What should I cook tonight?", "Help me use up leftover chicken", "Suggest a quick healthy lunch"];

export function ChatScreen({ openSettings }: { openSettings: () => void }) {
  const chat = useChat();
  const { sessions, deleteSession } = useChatSessions();
  const { createRecipeAsync } = useRecipes();
  const { createEntryAsync } = useCookingLog();
  const { createPreferenceAsync } = useAiPreferences();
  const { effectiveProvider, effectiveModel, effectiveApiKey } = useSettings();
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => { scroll.current?.scrollToEnd({ animated: true }); }, [chat.messages]);

  const submit = () => {
    if ((!text.trim() && !image) || chat.isStreaming) return;
    const sent = text.trim(); setText(""); const sentImage = image; setImage("");
    void chat.sendMessage(sent, sentImage);
  };

  const receiveImage = (result: ImagePicker.ImagePickerResult) => {
    const asset = result.assets?.[0];
    if (!result.canceled && asset) setImage(asset.base64 ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}` : asset.uri);
  };

  const chooseImage = () => {
    Alert.alert("Attach a photo", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Take Photo", onPress: () => void ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.72, base64: true }).then(receiveImage) },
      { text: "Photo Library", onPress: () => void ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.72, base64: true }).then(receiveImage) },
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
      const recipe = await extractRecipeFromConversation({ messages: chat.messages.slice(0, index + 1), providerId: effectiveProvider, modelId: effectiveModel, apiKey: effectiveApiKey });
      const saved = await createRecipeAsync(recipe);
      chat.setMessageFlag(index, "savedRecipeId", saved.id);
      Alert.alert("Recipe saved", saved.title);
    } catch (error) { Alert.alert("Couldn’t save recipe", error instanceof Error ? error.message : "Try again."); }
    finally { setBusyAction(null); }
  };

  const logMeal = async (content: string) => {
    const title = content.split("\n").find(Boolean)?.replace(/[#*_`]/g, "").trim().slice(0, 100) ?? "Cooked meal";
    await createEntryAsync({ title, date: new Date().toISOString().slice(0, 10), rating: null, comment: "", recipeId: null });
    Alert.alert("Added to history", title);
  };

  const saveMemory = async (index: number) => {
    setBusyAction(`memory-${index}`);
    try {
      const start = Math.max(0, index - 2);
      const snippet = chat.messages.slice(start, index + 1).map((message) => `${message.role}: ${message.content}`).join("\n");
      const preference = await extractPreference({ conversationSnippet: snippet, providerId: effectiveProvider, modelId: effectiveModel, apiKey: effectiveApiKey });
      await createPreferenceAsync({ text: preference }); chat.setMessageFlag(index, "memorySaved", true);
      Alert.alert("Saved to memory", preference);
    } catch (error) { Alert.alert("Couldn’t save memory", error instanceof Error ? error.message : "Try again."); }
    finally { setBusyAction(null); }
  };

  const newChat = () => {
    if (!chat.messages.length) return chat.clearChat();
    Alert.alert("Start a new chat?", "This conversation stays in your history.", [{ text: "Cancel", style: "cancel" }, { text: "New Chat", onPress: chat.clearChat }]);
  };

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={nativeStyles.screen}>
    <ScreenHeader title="Chefness" action={<View style={styles.headerActions}><Pressable accessibilityLabel="Chat history" onPress={() => setSessionsOpen(true)}><Ionicons name="time-outline" size={25} color={colors.espresso} /></Pressable><Pressable accessibilityLabel="New chat" onPress={newChat}><Ionicons name="add-circle-outline" size={27} color={colors.saffronDeep} /></Pressable></View>} />
    <ScrollView ref={scroll} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
      {!chat.messages.length && <View style={styles.welcome}><Text style={styles.welcomeTitle}>What are we cooking?</Text><Text style={nativeStyles.muted}>Ask your personal cooking guru for ideas, recipes, substitutions, or step-by-step help.</Text>
        <Text style={nativeStyles.label}>Meal type</Text><View style={nativeStyles.row}>{mealTypes.map((item) => <Chip key={item} label={item} selected={chat.mealType === item} onPress={() => chat.setMealType(item)} />)}</View>
        <Text style={nativeStyles.label}>Cooking for</Text><View style={nativeStyles.row}>{mealSizes.map((item) => <Chip key={item} label={item === "6+" ? "6+ people" : item} selected={chat.mealSize === item} onPress={() => chat.setMealSize(item)} />)}</View>
        {prompts.map((prompt) => <Pressable key={prompt} style={styles.prompt} onPress={() => setText(prompt)}><Text style={styles.promptText}>{prompt}</Text></Pressable>)}
      </View>}
      {!chat.isConfigured && <Pressable onPress={openSettings} style={styles.setup}><Text style={styles.setupText}>Connect OpenRouter in Settings to start chatting →</Text></Pressable>}
      {chat.messages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.assistantBubble]}>
        {message.imageDataUrl ? <Image source={{ uri: message.imageDataUrl }} style={styles.messageImage} /> : null}
        {message.role === "assistant" && message.content ? <Markdown style={markdownStyles}>{message.content}</Markdown> : <Text selectable style={styles.messageText}>{message.content || (chat.isStreaming ? "Thinking…" : "")}</Text>}
        {message.role === "user" && !chat.isStreaming ? <Pressable style={styles.editMessage} onPress={() => { setEditingMessage(index); setEditDraft(message.content); }}><Ionicons name="pencil-outline" size={15} color={colors.stone600} /><Text style={styles.editMessageText}>Edit & regenerate</Text></Pressable> : null}
        {message.role === "assistant" && message.content ? <View style={nativeStyles.row}>
          <Button label={message.savedRecipeId ? "Saved ✓" : busyAction === `recipe-${index}` ? "Saving…" : "Save Recipe"} disabled={!!message.savedRecipeId || !!busyAction} variant="secondary" onPress={() => void saveRecipe(index)} />
          <Button label="I cooked this" variant="secondary" onPress={() => void logMeal(message.content)} />
          <Button label={message.memorySaved ? "Remembered ✓" : busyAction === `memory-${index}` ? "Saving…" : "Save Memory"} disabled={!!message.memorySaved || !!busyAction} variant="secondary" onPress={() => void saveMemory(index)} />
        </View> : null}
      </View>)}
      {chat.error && <View style={styles.errorBox}><Text style={nativeStyles.error}>{chat.error}</Text><Button label="Retry" variant="secondary" onPress={retryLastMessage} /></View>}
    </ScrollView>
    {image ? <View style={styles.preview}><Image source={{ uri: image }} style={styles.previewImage} /><Pressable onPress={() => setImage("")}><Ionicons name="close-circle" size={28} color={colors.danger} /></Pressable></View> : null}
    <View style={styles.composer}>
      {chat.canAttachImage && <Pressable accessibilityLabel="Attach photo" onPress={chooseImage}><Ionicons name="camera-outline" size={27} color={colors.saffronDeep} /></Pressable>}
      <Field value={text} onChangeText={setText} placeholder="Ask your cooking guru…" multiline style={styles.composerField} />
      <Pressable accessibilityLabel={chat.isStreaming ? "Stop response" : "Send message"} onPress={chat.isStreaming ? chat.stopStreaming : submit}><Ionicons name={chat.isStreaming ? "stop-circle" : "send"} size={28} color={colors.saffronDeep} /></Pressable>
    </View>
    <Modal visible={sessionsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSessionsOpen(false)}><View style={nativeStyles.screen}><ScreenHeader title="Chat History" action={<Button label="Done" variant="secondary" onPress={() => setSessionsOpen(false)} />} /><ScrollView contentContainerStyle={nativeStyles.scroll}>{sessions.length === 0 && <Text style={nativeStyles.muted}>No saved conversations yet.</Text>}{sessions.map((session) => <Pressable key={session.id} style={styles.session} onPress={() => { chat.loadSession(session.id); setSessionsOpen(false); }}><View style={{ flex: 1 }}><Text style={nativeStyles.label}>{session.title}</Text><Text style={nativeStyles.muted}>{new Date(session.updatedAt).toLocaleDateString()} · {session.messages.length} messages</Text></View><Pressable accessibilityLabel="Delete chat" onPress={() => Alert.alert("Delete conversation?", session.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteSession(session.id) }])}><Ionicons name="trash-outline" size={22} color={colors.danger} /></Pressable></Pressable>)}</ScrollView></View></Modal>
    <Modal visible={editingMessage !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingMessage(null)}><View style={nativeStyles.screen}><ScreenHeader title="Edit Message" /><View style={nativeStyles.scroll}><Field autoFocus multiline value={editDraft} onChangeText={setEditDraft} /><Button label="Save & Regenerate" disabled={!editDraft.trim()} onPress={() => { const index = editingMessage; setEditingMessage(null); if (index !== null) void chat.editUserMessageAndRegenerate(index, editDraft.trim()); }} /><Button label="Cancel" variant="secondary" onPress={() => setEditingMessage(null)} /></View></View></Modal>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", gap: 18, alignItems: "center" }, editMessage: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 4 }, editMessageText: { color: colors.stone600, fontSize: 12, fontWeight: "600" }, messages: { padding: 14, gap: 12, flexGrow: 1 }, welcome: { gap: 12, paddingVertical: 20 }, welcomeTitle: { fontSize: 28, fontWeight: "700", color: colors.espresso }, prompt: { padding: 13, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.stone200 }, promptText: { color: colors.saffronDeep, fontWeight: "600" }, setup: { backgroundColor: colors.saffronTint, borderRadius: 12, padding: 14 }, setupText: { color: colors.saffronDeep, fontWeight: "700" }, bubble: { maxWidth: "92%", padding: 13, borderRadius: 17, gap: 9 }, userBubble: { alignSelf: "flex-end", backgroundColor: colors.saffronTint }, assistantBubble: { alignSelf: "flex-start", backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.stone200 }, messageText: { color: colors.espresso, fontSize: 16, lineHeight: 23 }, messageImage: { width: 220, height: 160, borderRadius: 12 }, errorBox: { gap: 8, padding: 12, backgroundColor: colors.dangerTint, borderRadius: 12 }, composer: { minHeight: 66, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", gap: 10, alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.stone200, backgroundColor: colors.glassStrong }, composerField: { flex: 1, maxHeight: 100 }, preview: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 }, previewImage: { width: 64, height: 64, borderRadius: 10 }, session: { padding: 15, backgroundColor: colors.white, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 12 },
});

const markdownStyles = {
  body: { color: colors.espresso, fontSize: 16, lineHeight: 23 },
  heading1: { color: colors.espresso, fontSize: 23, fontWeight: "700" as const, marginTop: 4, marginBottom: 8 },
  heading2: { color: colors.espresso, fontSize: 19, fontWeight: "700" as const, marginTop: 4, marginBottom: 6 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  strong: { fontWeight: "700" as const },
  link: { color: colors.saffronDeep },
};
