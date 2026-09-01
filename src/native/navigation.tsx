import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import {
  createBottomTabNavigator,
  type BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { useChat } from "@/hooks/useChat";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useSettings } from "@/hooks/useSettings";
import { ChatScreen } from "@/native/ChatScreen";
import { HistoryScreen } from "@/native/HistoryScreen";
import {
  RecipeDetailScreen,
  RecipeEditScreen,
  RecipeListScreen,
} from "@/native/RecipesScreen";
import { ModelSelectionScreen, SettingsScreen } from "@/native/SettingsScreen";
import {
  linking,
  type ChatStackParamList,
  type RecipesStackParamList,
  type RootTabParamList,
  type SettingsStackParamList,
} from "@/native/navigation-routes";
import { ListInteractionRow } from "@/native/ListInteractionRow";
import { OnboardingScreen } from "@/native/OnboardingScreen";
import { Loading, nativeStyles } from "@/native/ui";
import { decodeSharedUrl } from "@/lib/share-url-encoding";
import { useAccessibilityPreferences } from "@/native/accessibility";
import { nativeColors as colors, nativeFonts } from "@/native/theme";

const Tabs = createBottomTabNavigator<RootTabParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const RecipesStack = createNativeStackNavigator<RecipesStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const stackScreenOptions = {
  gestureEnabled: true,
  headerStyle: { backgroundColor: colors.cream as string },
  headerTitleStyle: { fontFamily: nativeFonts.serifBold },
  headerBackTitleStyle: { fontFamily: nativeFonts.sans },
  headerTintColor: colors.espresso as string,
  contentStyle: { backgroundColor: colors.cream },
} as const;

function ChatNavigator({
  navigation,
}: {
  navigation: BottomTabNavigationProp<RootTabParamList, "ChatTab">;
}) {
  const chat = useChat();
  const newChat = () => {
    if (!chat.messages.length) return chat.clearChat();
    Alert.alert(
      "Start a new chat?",
      "This conversation stays in your history.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "New Chat", onPress: chat.clearChat },
      ],
    );
  };

  return (
    <ChatStack.Navigator screenOptions={stackScreenOptions}>
      <ChatStack.Screen
        name="Chat"
        options={({ navigation: stackNavigation }) => ({
          title: "Chefness",
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chat history"
                accessibilityHint="Opens saved conversations"
                style={styles.headerButton}
                onPress={() => stackNavigation.navigate("ChatHistory")}
              >
                <Ionicons
                  accessible={false}
                  name="time-outline"
                  size={25}
                  color={colors.espresso}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New chat"
                accessibilityHint="Starts a new conversation"
                style={styles.headerButton}
                onPress={newChat}
              >
                <Ionicons
                  accessible={false}
                  name="add-circle-outline"
                  size={27}
                  color={colors.saffronDeep}
                />
              </Pressable>
            </View>
          ),
        })}
      >
        {(props) => (
          <ChatRoute
            {...props}
            chat={chat}
            openSettings={() =>
              navigation.navigate("SettingsTab", { screen: "Settings" })
            }
          />
        )}
      </ChatStack.Screen>
      <ChatStack.Screen
        name="ChatHistory"
        options={{ title: "Chat History", presentation: "formSheet" }}
      >
        {(props) => <ChatHistorySheet {...props} chat={chat} />}
      </ChatStack.Screen>
    </ChatStack.Navigator>
  );
}

type ChatValue = ReturnType<typeof useChat>;
function ChatRoute({
  route,
  chat,
  openSettings,
}: NativeStackScreenProps<ChatStackParamList, "Chat"> & {
  chat: ChatValue;
  openSettings: () => void;
}) {
  const sessionId = route.params?.sessionId;
  useEffect(() => {
    if (sessionId && sessionId !== chat.currentSessionId)
      chat.loadSession(sessionId);
  }, [chat, sessionId]);

  // Handle a recipe URL shared from the iOS share extension. The shareTs
  // value uniquely identifies each share so a re-render or repeated deep link
  // with the same params is not imported twice.
  const sharedUrl = route.params?.sharedUrl;
  const shareTs = route.params?.shareTs;
  const handledShareTs = useRef<string | null>(null);
  useEffect(() => {
    if (!sharedUrl || !shareTs || handledShareTs.current === shareTs) return;
    handledShareTs.current = shareTs;
    const url = decodeSharedUrl(sharedUrl);
    if (!url) return;
    // Start a fresh conversation for the import; the existing chat
    // URL-import flow extracts and saves the recipe.
    void chat.importSharedUrl(url);
  }, [chat, sharedUrl, shareTs]);
  return <ChatScreen chat={chat} openSettings={openSettings} />;
}

function ChatHistorySheet({
  navigation,
  chat,
}: NativeStackScreenProps<ChatStackParamList, "ChatHistory"> & {
  chat: ChatValue;
}) {
  const { sessions, deleteSession, deleteAllSessions } = useChatSessions();
  const openSession = (sessionId: string) => {
    chat.loadSession(sessionId);
    navigation.goBack();
  };
  const confirmDelete = (sessionId: string, title: string) =>
    Alert.alert("Delete conversation?", title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteSession(sessionId),
      },
    ]);
  const confirmDeleteAll = useCallback(
    () =>
      Alert.alert("Delete all conversations?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: () => void deleteAllSessions().then(chat.clearChat),
        },
      ]),
    [chat.clearChat, deleteAllSessions],
  );
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: sessions.length
        ? () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete all chats"
              hitSlop={8}
              onPress={confirmDeleteAll}
            >
              <Ionicons
                accessible={false}
                name="trash-outline"
                size={23}
                color={colors.danger}
              />
            </Pressable>
          )
        : undefined,
    });
  }, [confirmDeleteAll, navigation, sessions.length]);
  return (
    <View style={nativeStyles.screen}>
      <FlatList
        data={sessions}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        keyExtractor={(session) => session.id}
        contentContainerStyle={nativeStyles.scroll}
        ListEmptyComponent={
          <Text style={nativeStyles.muted}>No saved conversations yet.</Text>
        }
        renderItem={({ item: session }) => (
          <ListInteractionRow
            menuActions={[
              {
                id: "open",
                title: "Open Conversation",
                image: "bubble.left.and.bubble.right",
              },
              {
                id: "delete",
                title: "Delete",
                image: "trash",
                attributes: { destructive: true },
              },
            ]}
            onDelete={() => confirmDelete(session.id, session.title)}
            onPress={() => openSession(session.id)}
            onMenuAction={(id) => {
              if (id === "open") openSession(session.id);
              if (id === "delete") confirmDelete(session.id, session.title);
            }}
          >
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${session.title}. Updated ${new Date(session.updatedAt).toLocaleDateString()}. ${session.messages.length} messages`}
              accessibilityHint="Opens conversation; long press for more actions"
              style={{
                padding: 15,
                paddingBottom: 48,
                backgroundColor: colors.white,
                borderRadius: 14,
              }}
            >
              <Text style={nativeStyles.label}>{session.title}</Text>
              <Text style={nativeStyles.muted}>
                {new Date(session.updatedAt).toLocaleDateString()} ·{" "}
                {session.messages.length} messages
              </Text>
            </View>
          </ListInteractionRow>
        )}
      />
    </View>
  );
}

function RecipesNavigator() {
  return (
    <RecipesStack.Navigator screenOptions={stackScreenOptions}>
      <RecipesStack.Screen
        name="RecipeList"
        component={RecipeListScreen}
        options={{ title: "Recipes" }}
      />
      <RecipesStack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{ title: "Recipe" }}
      />
      <RecipesStack.Screen
        name="RecipeEdit"
        component={RecipeEditScreen}
        options={{ title: "Edit Recipe" }}
      />
    </RecipesStack.Navigator>
  );
}

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={stackScreenOptions}>
      <SettingsStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <SettingsStack.Screen
        name="ModelSelection"
        component={ModelSelectionScreen}
        options={{ title: "Choose Model", presentation: "formSheet" }}
      />
    </SettingsStack.Navigator>
  );
}

const tabIcons: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> =
  {
    ChatTab: "chatbubble-outline",
    RecipesTab: "book-outline",
    HistoryTab: "time-outline",
    SettingsTab: "settings-outline",
  };
export function NativeNavigation() {
  const { reduceTransparency } = useAccessibilityPreferences();
  const settings = useSettings();
  if (settings.isLoading) return <Loading />;
  if (!settings.settings.hasCompletedOnboarding)
    return <OnboardingScreen settings={settings} />;

  return (
    <NavigationContainer linking={linking}>
      <Tabs.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.saffronDeep as string,
          tabBarInactiveTintColor: colors.stone500 as string,
          tabBarAllowFontScaling: true,
          tabBarLabelStyle: { fontFamily: nativeFonts.sansSemiBold },
          tabBarStyle: {
            backgroundColor: reduceTransparency
              ? colors.white
              : colors.glassStrong,
            borderTopColor: colors.stone300,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              accessible={false}
              name={tabIcons[route.name]}
              color={color}
              size={size}
            />
          ),
        })}
      >
        <Tabs.Screen
          name="ChatTab"
          component={ChatNavigator}
          options={{ title: "Chat" }}
        />
        <Tabs.Screen
          name="RecipesTab"
          component={RecipesNavigator}
          options={{ title: "Recipes" }}
        />
        <Tabs.Screen
          name="HistoryTab"
          component={HistoryScreen}
          options={{
            title: "History",
            headerShown: true,
            headerStyle: { backgroundColor: colors.cream },
            headerTitleStyle: { fontFamily: nativeFonts.serifBold },
            headerTintColor: colors.espresso as string,
          }}
        />
        <Tabs.Screen
          name="SettingsTab"
          component={SettingsNavigator}
          options={{ title: "Settings" }}
        />
      </Tabs.Navigator>
    </NavigationContainer>
  );
}

const styles = {
  headerButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
} as const;
