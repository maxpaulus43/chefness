import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { useChat } from "@/hooks/useChat";
import { useChatSessions } from "@/hooks/useChatSessions";
import { ChatScreen } from "@/native/ChatScreen";
import { HistoryScreen } from "@/native/HistoryScreen";
import { RecipeDetailScreen, RecipeEditScreen, RecipeListScreen } from "@/native/RecipesScreen";
import { ModelSelectionScreen, SettingsScreen } from "@/native/SettingsScreen";
import { linking, type ChatStackParamList, type RecipesStackParamList, type RootTabParamList, type SettingsStackParamList } from "@/native/navigation-routes";
import { Button, Field, nativeStyles } from "@/native/ui";
import { colors } from "@/theme";

const Tabs = createBottomTabNavigator<RootTabParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const RecipesStack = createNativeStackNavigator<RecipesStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const stackScreenOptions = { gestureEnabled: true, headerStyle: { backgroundColor: colors.cream }, headerTintColor: colors.espresso, contentStyle: { backgroundColor: colors.cream } } as const;

function ChatNavigator({ navigation }: { navigation: BottomTabNavigationProp<RootTabParamList, "ChatTab"> }) {
  const chat = useChat();
  const newChat = () => {
    if (!chat.messages.length) return chat.clearChat();
    Alert.alert("Start a new chat?", "This conversation stays in your history.", [{ text: "Cancel", style: "cancel" }, { text: "New Chat", onPress: chat.clearChat }]);
  };

  return <ChatStack.Navigator screenOptions={stackScreenOptions}>
    <ChatStack.Screen name="Chat" options={({ navigation: stackNavigation }) => ({
      title: "Chefness",
      headerRight: () => <View style={{ flexDirection: "row", gap: 18 }}><Pressable accessibilityLabel="Chat history" onPress={() => stackNavigation.navigate("ChatHistory")}><Ionicons name="time-outline" size={25} color={colors.espresso} /></Pressable><Pressable accessibilityLabel="New chat" onPress={newChat}><Ionicons name="add-circle-outline" size={27} color={colors.saffronDeep} /></Pressable></View>,
    })}>
      {(props) => <ChatRoute {...props} chat={chat} openSettings={() => navigation.navigate("SettingsTab", { screen: "Settings" })} />}
    </ChatStack.Screen>
    <ChatStack.Screen name="ChatHistory" options={{ title: "Chat History", presentation: "formSheet" }}>
      {(props) => <ChatHistorySheet {...props} chat={chat} />}
    </ChatStack.Screen>
    <ChatStack.Screen name="EditMessage" options={{ title: "Edit Message", presentation: "formSheet" }}>
      {(props) => <EditMessageSheet {...props} chat={chat} />}
    </ChatStack.Screen>
  </ChatStack.Navigator>;
}

type ChatValue = ReturnType<typeof useChat>;
function ChatRoute({ route, navigation, chat, openSettings }: NativeStackScreenProps<ChatStackParamList, "Chat"> & { chat: ChatValue; openSettings: () => void }) {
  const sessionId = route.params?.sessionId;
  useEffect(() => {
    if (sessionId && sessionId !== chat.currentSessionId) chat.loadSession(sessionId);
  }, [chat, sessionId]);
  return <ChatScreen chat={chat} openSettings={openSettings} openEdit={(index, content) => navigation.navigate("EditMessage", { index, content })} />;
}

function ChatHistorySheet({ navigation, chat }: NativeStackScreenProps<ChatStackParamList, "ChatHistory"> & { chat: ChatValue }) {
  const { sessions, deleteSession } = useChatSessions();
  return <View style={nativeStyles.screen}><ScrollView contentContainerStyle={nativeStyles.scroll}>
    {sessions.length === 0 && <Text style={nativeStyles.muted}>No saved conversations yet.</Text>}
    {sessions.map((session) => <Pressable key={session.id} style={{ padding: 15, backgroundColor: colors.white, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 12 }} onPress={() => { chat.loadSession(session.id); navigation.goBack(); }}><View style={{ flex: 1 }}><Text style={nativeStyles.label}>{session.title}</Text><Text style={nativeStyles.muted}>{new Date(session.updatedAt).toLocaleDateString()} · {session.messages.length} messages</Text></View><Pressable accessibilityLabel="Delete chat" onPress={() => Alert.alert("Delete conversation?", session.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteSession(session.id) }])}><Ionicons name="trash-outline" size={22} color={colors.danger} /></Pressable></Pressable>)}
  </ScrollView></View>;
}

function EditMessageSheet({ route, navigation, chat }: NativeStackScreenProps<ChatStackParamList, "EditMessage"> & { chat: ChatValue }) {
  const { index, content } = route.params;
  const [draft, setDraft] = useState(content);
  return <View style={[nativeStyles.screen, nativeStyles.scroll]}><Field autoFocus multiline value={draft} onChangeText={setDraft} /><Button label="Save & Regenerate" disabled={!draft.trim()} onPress={() => { navigation.goBack(); void chat.editUserMessageAndRegenerate(index, draft.trim()); }} /><Button label="Cancel" variant="secondary" onPress={navigation.goBack} /></View>;
}

function RecipesNavigator() {
  return <RecipesStack.Navigator screenOptions={stackScreenOptions}>
    <RecipesStack.Screen name="RecipeList" component={RecipeListScreen} options={{ title: "Recipes" }} />
    <RecipesStack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: "Recipe" }} />
    <RecipesStack.Screen name="RecipeEdit" component={RecipeEditScreen} options={{ title: "Edit Recipe" }} />
  </RecipesStack.Navigator>;
}

function SettingsNavigator() {
  return <SettingsStack.Navigator screenOptions={stackScreenOptions}>
    <SettingsStack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    <SettingsStack.Screen name="ModelSelection" component={ModelSelectionScreen} options={{ title: "Choose Model", presentation: "formSheet" }} />
  </SettingsStack.Navigator>;
}

const tabIcons: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = { ChatTab: "chatbubble-outline", RecipesTab: "book-outline", HistoryTab: "time-outline", SettingsTab: "settings-outline" };
export function NativeNavigation() {
  return <NavigationContainer linking={linking}>
    <Tabs.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.saffronDeep, tabBarInactiveTintColor: colors.stone500, tabBarStyle: { backgroundColor: colors.glassStrong, borderTopColor: colors.stone300 }, tabBarIcon: ({ color, size }) => <Ionicons name={tabIcons[route.name]} color={color} size={size} /> })}>
      <Tabs.Screen name="ChatTab" component={ChatNavigator} options={{ title: "Chat" }} />
      <Tabs.Screen name="RecipesTab" component={RecipesNavigator} options={{ title: "Recipes" }} />
      <Tabs.Screen name="HistoryTab" component={HistoryScreen} options={{ title: "History", headerShown: true, ...stackScreenOptions }} />
      <Tabs.Screen name="SettingsTab" component={SettingsNavigator} options={{ title: "Settings" }} />
    </Tabs.Navigator>
  </NavigationContainer>;
}
