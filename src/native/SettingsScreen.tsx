import { useEffect, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "@/hooks/useSettings";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { buildHeadlessAuthUrl, exchangeCodeForKey } from "@/lib/openrouter-oauth";
import type { SettingsStackParamList } from "@/native/navigation-routes";
import { colors } from "@/theme";
import { Button, Card, Chip, Field, Loading, ScreenHeader, nativeStyles } from "@/native/ui";

const restrictions = ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "halal", "kosher", "pescatarian", "low-carb", "keto"];
export function SettingsScreen({ navigation }: NativeStackScreenProps<SettingsStackParamList, "Settings">) {
  const settings = useSettings();
  const catalog = useOpenRouterModels(settings.isOpenRouterConnected, settings.effectiveModel);
  const { preferences, createPreference, deletePreference } = useAiPreferences();
  const [localRestrictions, setLocalRestrictions] = useState(settings.dietaryRestrictions);
  const [notes, setNotes] = useState(settings.otherDietaryNotes); const [newPreference, setNewPreference] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [codePromptOpen, setCodePromptOpen] = useState(false); const [authorizationCode, setAuthorizationCode] = useState("");
  const [pendingVerifier, setPendingVerifier] = useState("");
  useEffect(() => setLocalRestrictions(settings.dietaryRestrictions), [settings.dietaryRestrictions]);
  useEffect(() => setNotes(settings.otherDietaryNotes), [settings.otherDietaryNotes]);

  const connect = async () => {
    setConnecting(true);
    try {
      const bytes = await Crypto.getRandomBytesAsync(48);
      const verifier = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const base64Challenge = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 },
      );
      const challenge = base64Challenge.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      setPendingVerifier(verifier);
      const authUrl = buildHeadlessAuthUrl(challenge, "S256", "Chefness iOS");
      await WebBrowser.openBrowserAsync(authUrl, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      setCodePromptOpen(true);
    } catch (error) {
      setPendingVerifier("");
      Alert.alert("Couldn’t connect OpenRouter", error instanceof Error ? error.message : "Try again.");
    } finally { setConnecting(false); }
  };

  const finishConnection = async () => {
    const code = authorizationCode.trim();
    if (!code || !pendingVerifier) return;
    setConnecting(true);
    try {
      const key = await exchangeCodeForKey(code, pendingVerifier, "S256");
      await settings.updateSettingsAsync({ openRouterOAuthKey: key });
      setCodePromptOpen(false); setAuthorizationCode(""); setPendingVerifier("");
      Alert.alert("Connected", "Your OpenRouter account is ready.");
    } catch (error) {
      Alert.alert("Couldn’t connect OpenRouter", error instanceof Error ? error.message : "Check the code and try again.");
    } finally { setConnecting(false); }
  };

  const pasteAuthorizationCode = async () => {
    setAuthorizationCode((await Clipboard.getStringAsync()).trim());
  };

  const toggleRestriction = (item: string) => {
    const next = localRestrictions.includes(item) ? localRestrictions.filter((value) => value !== item) : [...localRestrictions, item];
    setLocalRestrictions(next); settings.updateSettings({ dietaryRestrictions: next });
  };
  const addPreference = () => { const text = newPreference.trim(); if (!text) return; createPreference({ text }); setNewPreference(""); };

  return <View style={nativeStyles.screen}><ScrollView contentContainerStyle={nativeStyles.scroll} keyboardShouldPersistTaps="handled">
    <Text style={nativeStyles.sectionTitle}>OpenRouter</Text><Card>{settings.isOpenRouterConnected ? <><View style={styles.connected}><Ionicons name="checkmark-circle" size={22} color={colors.success} /><Text style={styles.connectedText}>Connected</Text></View><Text style={nativeStyles.muted}>Your key is stored in the iOS Keychain and stays on this device.</Text><Button label="Disconnect" variant="danger" onPress={() => Alert.alert("Disconnect OpenRouter?", "AI features will stop until you reconnect.", [{ text: "Cancel", style: "cancel" }, { text: "Disconnect", style: "destructive", onPress: () => settings.updateSettings({ openRouterOAuthKey: "" }) }])} /></> : <><Text style={nativeStyles.muted}>Connect your account to chat and use AI recipe tools. OpenRouter will show a one-time code after you create the key; copy it, close the browser, then paste it into Chefness. Chefness stores your API key in the iOS Keychain and never displays or logs it.</Text><Button disabled={connecting} label={connecting ? "Connecting…" : "Connect OpenRouter"} onPress={() => void connect()} /></>}</Card>
    <Card><Text style={nativeStyles.label}>Model</Text><Pressable disabled={!settings.isOpenRouterConnected} onPress={() => navigation.navigate("ModelSelection")} style={styles.selector}><Text numberOfLines={2} style={styles.selectorText}>{catalog.selectedModel?.name ?? settings.effectiveModel}</Text><Ionicons name="chevron-down" size={20} color={colors.stone600} /></Pressable>{catalog.error && <Text style={nativeStyles.error}>{catalog.error}</Text>}</Card>
    <Text style={nativeStyles.sectionTitle}>Dietary Restrictions</Text><Card><View style={nativeStyles.row}>{restrictions.map((item) => <Chip key={item} label={item} selected={localRestrictions.includes(item)} onPress={() => toggleRestriction(item)} />)}</View><Text style={nativeStyles.label}>Other dietary notes</Text><Field multiline value={notes} onChangeText={setNotes} onBlur={() => settings.updateSettings({ otherDietaryNotes: notes.trim() })} placeholder="Low sodium, allergies, or anything else…" /></Card>
    <Text style={nativeStyles.sectionTitle}>AI Memory</Text><Card><Text style={nativeStyles.muted}>Permanent preferences are included in future chats and stay on this device.</Text><View style={styles.addRow}><Field value={newPreference} onChangeText={setNewPreference} placeholder="I dislike cilantro…" style={{ flex: 1 }} /><Button label="Add" onPress={addPreference} /></View>{preferences.map((preference) => <View key={preference.id} style={styles.preference}><Text style={styles.preferenceText}>{preference.text}</Text><Pressable accessibilityLabel="Delete preference" onPress={() => deletePreference(preference.id)}><Ionicons name="close-circle" size={23} color={colors.roseText} /></Pressable></View>)}</Card>
  </ScrollView>
  <Modal visible={codePromptOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCodePromptOpen(false)}><View style={nativeStyles.screen}><ScreenHeader title="Finish Connecting" /><View style={nativeStyles.scroll}><Text style={nativeStyles.muted}>Paste the one-time authorization code OpenRouter displayed after you created the API key. The code expires after 10 minutes.</Text><Field autoCapitalize="none" autoCorrect={false} value={authorizationCode} onChangeText={setAuthorizationCode} placeholder="Authorization code" /><Button label="Paste Code" variant="secondary" onPress={() => void pasteAuthorizationCode()} /><Button disabled={connecting || !authorizationCode.trim()} label={connecting ? "Connecting…" : "Connect"} onPress={() => void finishConnection()} /><Button label="Cancel" variant="secondary" onPress={() => { setCodePromptOpen(false); setAuthorizationCode(""); setPendingVerifier(""); }} /></View></View></Modal>
  </View>;
}

export function ModelSelectionScreen({ navigation }: NativeStackScreenProps<SettingsStackParamList, "ModelSelection">) {
  const settings = useSettings();
  const catalog = useOpenRouterModels(settings.isOpenRouterConnected, settings.effectiveModel);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => catalog.models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(query.toLowerCase())).slice(0, 150), [catalog.models, query]);
  return <View style={nativeStyles.screen}><View style={{ padding: 14, gap: 10 }}><Field value={query} onChangeText={setQuery} placeholder="Search models…" /><View style={nativeStyles.row}><Chip label="Free" selected={catalog.freeOnly} onPress={catalog.toggleFreeOnly} /><Chip label="Vision" selected={catalog.visionOnly} onPress={catalog.toggleVisionOnly} /><Chip label="Tools" selected={catalog.toolsOnly} onPress={catalog.toggleToolsOnly} /></View></View>{catalog.isLoading ? <Loading /> : <ScrollView contentContainerStyle={nativeStyles.scroll}>{filtered.map((model) => <Pressable accessibilityRole="button" accessibilityState={{ selected: model.id === settings.effectiveModel }} key={model.id} style={[styles.model, model.id === settings.effectiveModel && styles.selectedModel]} onPress={() => { settings.updateSettings({ llmModel: model.id }); navigation.goBack(); }}><Text style={styles.modelName}>{model.name}</Text><Text style={styles.modelId}>{model.id}</Text></Pressable>)}</ScrollView>}</View>;
}

const styles = StyleSheet.create({ connected: { flexDirection: "row", alignItems: "center", gap: 7 }, connectedText: { color: colors.success, fontWeight: "700", fontSize: 16 }, selector: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.stone300, borderRadius: 12, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, selectorText: { flex: 1, color: colors.espresso, fontSize: 15 }, addRow: { flexDirection: "row", alignItems: "center", gap: 8 }, preference: { flexDirection: "row", gap: 10, alignItems: "center", padding: 11, borderRadius: 10, backgroundColor: colors.creamDeep }, preferenceText: { flex: 1, color: colors.espresso, lineHeight: 20 }, model: { padding: 13, borderRadius: 12, backgroundColor: colors.white }, selectedModel: { borderWidth: 2, borderColor: colors.saffron }, modelName: { color: colors.espresso, fontWeight: "700" }, modelId: { color: colors.stone500, fontSize: 12, marginTop: 3 } });
