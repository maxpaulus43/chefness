import { useEffect, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "@/hooks/useSettings";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import {
  buildHeadlessAuthUrl,
  exchangeCodeForKey,
} from "@/lib/openrouter-oauth";
import type { SettingsStackParamList } from "@/native/navigation-routes";
import { DictationField } from "@/native/DictationField";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import {
  Button,
  Card,
  Chip,
  Field,
  Loading,
  ScreenHeader,
  nativeStyles,
} from "@/native/ui";

const restrictions = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "halal",
  "kosher",
  "pescatarian",
  "low-carb",
  "keto",
];
export function SettingsScreen({
  navigation,
}: NativeStackScreenProps<SettingsStackParamList, "Settings">) {
  const settings = useSettings();
  const catalog = useOpenRouterModels(
    settings.isOpenRouterConnected,
    settings.effectiveModel,
  );
  const { preferences, createPreference, deletePreference } =
    useAiPreferences();
  const [localRestrictions, setLocalRestrictions] = useState(
    settings.dietaryRestrictions,
  );
  const [notes, setNotes] = useState(settings.otherDietaryNotes);
  const [newPreference, setNewPreference] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [codePromptOpen, setCodePromptOpen] = useState(false);
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [pendingVerifier, setPendingVerifier] = useState("");
  useEffect(
    () => setLocalRestrictions(settings.dietaryRestrictions),
    [settings.dietaryRestrictions],
  );
  useEffect(
    () => setNotes(settings.otherDietaryNotes),
    [settings.otherDietaryNotes],
  );
  useEffect(() => {
    if (codePromptOpen)
      AccessibilityInfo.announceForAccessibility("Finish Connecting sheet");
  }, [codePromptOpen]);

  const connect = async () => {
    setConnecting(true);
    try {
      const bytes = await Crypto.getRandomBytesAsync(48);
      const verifier = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const base64Challenge = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 },
      );
      const challenge = base64Challenge
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      setPendingVerifier(verifier);
      const authUrl = buildHeadlessAuthUrl(challenge, "S256", "Chefness iOS");
      await WebBrowser.openBrowserAsync(authUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
      setCodePromptOpen(true);
    } catch (error) {
      setPendingVerifier("");
      Alert.alert(
        "Couldn’t connect OpenRouter",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setConnecting(false);
    }
  };

  const finishConnection = async () => {
    const code = authorizationCode.trim();
    if (!code || !pendingVerifier) return;
    setConnecting(true);
    try {
      const key = await exchangeCodeForKey(code, pendingVerifier, "S256");
      await settings.updateSettingsAsync({ openRouterOAuthKey: key });
      setCodePromptOpen(false);
      setAuthorizationCode("");
      setPendingVerifier("");
      Alert.alert("Connected", "Your OpenRouter account is ready.");
    } catch (error) {
      Alert.alert(
        "Couldn’t connect OpenRouter",
        error instanceof Error
          ? error.message
          : "Check the code and try again.",
      );
    } finally {
      setConnecting(false);
    }
  };

  const pasteAuthorizationCode = async () => {
    setAuthorizationCode((await Clipboard.getStringAsync()).trim());
  };

  const toggleRestriction = (item: string) => {
    const next = localRestrictions.includes(item)
      ? localRestrictions.filter((value) => value !== item)
      : [...localRestrictions, item];
    setLocalRestrictions(next);
    settings.updateSettings({ dietaryRestrictions: next });
  };
  const addPreference = () => {
    const text = newPreference.trim();
    if (!text) return;
    createPreference({ text });
    setNewPreference("");
  };

  return (
    <View style={nativeStyles.screen}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={nativeStyles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
          OpenRouter
        </Text>
        <Card>
          {settings.isOpenRouterConnected ? (
            <>
              <View
                accessibilityLabel="OpenRouter status: Connected"
                style={styles.connected}
              >
                <Ionicons
                  accessible={false}
                  name="checkmark-circle"
                  size={22}
                  color={colors.success}
                />
                <Text style={styles.connectedText}>Connected ✓</Text>
              </View>
              <Text style={nativeStyles.muted}>
                Your key is stored in the iOS Keychain and stays on this device.
              </Text>
              <Button
                label="Disconnect"
                variant="danger"
                onPress={() =>
                  Alert.alert(
                    "Disconnect OpenRouter?",
                    "AI features will stop until you reconnect.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Disconnect",
                        style: "destructive",
                        onPress: () =>
                          settings.updateSettings({ openRouterOAuthKey: "" }),
                      },
                    ],
                  )
                }
              />
            </>
          ) : (
            <>
              <Text style={nativeStyles.muted}>
                Connect your account to chat and use AI recipe tools. OpenRouter
                will show a one-time code after you create the key; copy it,
                close the browser, then paste it into Chefness. Chefness stores
                your API key in the iOS Keychain and never displays or logs it.
              </Text>
              <Button
                disabled={connecting}
                label={connecting ? "Connecting…" : "Connect OpenRouter"}
                onPress={() => void connect()}
              />
            </>
          )}
        </Card>
        <Card>
          <Text style={nativeStyles.label}>Model</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Selected model: ${catalog.selectedModel?.name ?? settings.effectiveModel}`}
            accessibilityHint="Opens model selection"
            accessibilityState={{ disabled: !settings.isOpenRouterConnected }}
            disabled={!settings.isOpenRouterConnected}
            onPress={() => navigation.navigate("ModelSelection")}
            style={styles.selector}
          >
            <Text style={styles.selectorText}>
              {catalog.selectedModel?.name ?? settings.effectiveModel}
            </Text>
            <Ionicons
              accessible={false}
              name="chevron-down"
              size={20}
              color={colors.stone600}
            />
          </Pressable>
          {catalog.error && (
            <Text
              accessibilityLiveRegion="assertive"
              style={nativeStyles.error}
            >
              {catalog.error}
            </Text>
          )}
        </Card>
        <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
          Dietary Restrictions
        </Text>
        <Card>
          <View style={nativeStyles.row}>
            {restrictions.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={localRestrictions.includes(item)}
                onPress={() => toggleRestriction(item)}
              />
            ))}
          </View>
          <Text style={nativeStyles.label}>Other dietary notes</Text>
          <Field
            accessibilityLabel="Other dietary notes"
            multiline
            value={notes}
            onChangeText={setNotes}
            onBlur={() =>
              settings.updateSettings({ otherDietaryNotes: notes.trim() })
            }
            placeholder="Low sodium, allergies, or anything else…"
          />
        </Card>
        <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
          AI Memory
        </Text>
        <Card>
          <Text style={nativeStyles.muted}>
            Permanent preferences are included in future chats and stay on this
            device.
          </Text>
          <View style={styles.addRow}>
            <DictationField
              accessibilityLabel="New preference"
              value={newPreference}
              onChangeText={setNewPreference}
              multiline
              placeholder="I dislike cilantro…"
            />
            <Button label="Add" onPress={addPreference} />
          </View>
          {preferences.map((preference) => (
            <View key={preference.id} style={styles.preference}>
              <Text style={styles.preferenceText}>{preference.text}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete preference: ${preference.text}`}
                accessibilityHint="Removes this preference from AI memory"
                style={styles.iconButton}
                onPress={() => deletePreference(preference.id)}
              >
                <Ionicons
                  accessible={false}
                  name="close-circle"
                  size={23}
                  color={colors.roseText}
                />
              </Pressable>
            </View>
          ))}
        </Card>
      </ScrollView>
      <Modal
        visible={codePromptOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCodePromptOpen(false)}
      >
        <View accessibilityViewIsModal style={nativeStyles.screen}>
          <ScreenHeader title="Finish Connecting" />
          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={nativeStyles.scroll}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            <Text style={nativeStyles.muted}>
              Paste the one-time authorization code OpenRouter displayed after
              you created the API key. The code expires after 10 minutes.
            </Text>
            <Field
              accessibilityLabel="Authorization code"
              autoCapitalize="none"
              autoCorrect={false}
              value={authorizationCode}
              onChangeText={setAuthorizationCode}
              placeholder="Authorization code"
            />
            <Button
              label="Paste Code"
              variant="secondary"
              onPress={() => void pasteAuthorizationCode()}
            />
            <Button
              disabled={connecting || !authorizationCode.trim()}
              label={connecting ? "Connecting…" : "Connect"}
              onPress={() => void finishConnection()}
            />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => {
                setCodePromptOpen(false);
                setAuthorizationCode("");
                setPendingVerifier("");
              }}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export function ModelSelectionScreen({
  navigation,
}: NativeStackScreenProps<SettingsStackParamList, "ModelSelection">) {
  const settings = useSettings();
  const catalog = useOpenRouterModels(
    settings.isOpenRouterConnected,
    settings.effectiveModel,
    {
      freeOnly: settings.settings.modelFilterFreeOnly,
      visionOnly: settings.settings.modelFilterVisionOnly,
      toolsOnly: settings.settings.modelFilterToolsOnly,
    },
    (filters) =>
      settings.updateSettings({
        modelFilterFreeOnly: filters.freeOnly,
        modelFilterVisionOnly: filters.visionOnly,
        modelFilterToolsOnly: filters.toolsOnly,
      }),
  );
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      catalog.models.filter((model) =>
        `${model.name} ${model.id}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [catalog.models, query],
  );
  return (
    <View style={nativeStyles.screen}>
      <View style={{ padding: 14, gap: 10 }}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search models…"
        />
        <View style={nativeStyles.row}>
          <Chip
            label="Free"
            selected={catalog.freeOnly}
            onPress={catalog.toggleFreeOnly}
          />
          <Chip
            label="Vision"
            selected={catalog.visionOnly}
            onPress={catalog.toggleVisionOnly}
          />
          <Chip
            label="Tools"
            selected={catalog.toolsOnly}
            onPress={catalog.toggleToolsOnly}
          />
        </View>
      </View>
      {catalog.isLoading && catalog.totalModelCount === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          keyExtractor={(model) => model.id}
          contentContainerStyle={nativeStyles.scroll}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={catalog.isLoading}
              onRefresh={catalog.retry}
              tintColor={colors.saffronDeep}
            />
          }
          renderItem={({ item: model }) => {
            const selected = model.id === settings.effectiveModel;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${model.name}, ${model.id}${selected ? ", selected" : ""}`}
                accessibilityHint="Selects this model and closes the sheet"
                accessibilityState={{ selected }}
                style={[styles.model, selected && styles.selectedModel]}
                onPress={() => {
                  settings.updateSettings({ llmModel: model.id });
                  navigation.goBack();
                }}
              >
                <View accessible={false} style={styles.modelText}>
                  <Text style={styles.modelName}>{model.name}</Text>
                  <Text style={styles.modelId}>{model.id}</Text>
                </View>
                {selected && (
                  <Ionicons
                    accessible={false}
                    name="checkmark"
                    size={24}
                    color={colors.saffronDeep}
                  />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  connected: { flexDirection: "row", alignItems: "center", gap: 7 },
  connectedText: {
    color: colors.success,
    fontFamily: nativeFonts.sansBold,
    fontSize: 16,
  },
  selector: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.stone300,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorText: {
    flex: 1,
    color: colors.espresso,
    fontSize: 15,
    fontFamily: nativeFonts.sans,
  },
  addRow: { gap: 8, alignItems: "stretch" },
  preference: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 11,
    borderRadius: 10,
    backgroundColor: colors.creamDeep,
  },
  preferenceText: {
    flex: 1,
    color: colors.espresso,
    lineHeight: 20,
    fontFamily: nativeFonts.sans,
  },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  model: {
    minHeight: 44,
    padding: 13,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modelText: { flex: 1 },
  selectedModel: { borderWidth: 2, borderColor: colors.saffron },
  modelName: { color: colors.espresso, fontFamily: nativeFonts.sansBold },
  modelId: {
    color: colors.stone500,
    fontSize: 12,
    marginTop: 3,
    fontFamily: nativeFonts.sans,
  },
});
