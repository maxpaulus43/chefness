import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "@/hooks/useSettings";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { buildAuthUrl, exchangeCodeForKey } from "@/lib/openrouter-oauth";
import { colors } from "@/theme";
import { Button, Card, Chip, Field, Loading, ScreenHeader, nativeStyles } from "@/native/ui";

const restrictions = ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "halal", "kosher", "pescatarian", "low-carb", "keto"];
const callbackUrl = "chefness://oauth";

export function SettingsScreen() {
  const settings = useSettings();
  const catalog = useOpenRouterModels(settings.isOpenRouterConnected, settings.effectiveModel);
  const { preferences, createPreference, deletePreference } = useAiPreferences();
  const [localRestrictions, setLocalRestrictions] = useState(settings.dietaryRestrictions);
  const [notes, setNotes] = useState(settings.otherDietaryNotes); const [newPreference, setNewPreference] = useState("");
  const [connecting, setConnecting] = useState(false); const [pickerOpen, setPickerOpen] = useState(false); const [query, setQuery] = useState("");
  useEffect(() => setLocalRestrictions(settings.dietaryRestrictions), [settings.dietaryRestrictions]);
  useEffect(() => setNotes(settings.otherDietaryNotes), [settings.otherDietaryNotes]);

  const connect = async () => {
    setConnecting(true);
    try {
      const bytes = await Crypto.getRandomBytesAsync(48);
      const verifier = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const authUrl = buildAuthUrl(callbackUrl, verifier, "plain");
      const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl, { preferEphemeralSession: true });
      if (result.type !== "success") return;
      const code = new URL(result.url).searchParams.get("code");
      if (!code) throw new Error("OpenRouter did not return an authorization code.");
      const key = await exchangeCodeForKey(code, verifier, "plain");
      settings.updateSettings({ openRouterOAuthKey: key });
      Alert.alert("Connected", "Your OpenRouter account is ready.");
    } catch (error) { Alert.alert("Couldn’t connect OpenRouter", error instanceof Error ? error.message : "Try again."); }
    finally { setConnecting(false); }
  };

  const toggleRestriction = (item: string) => {
    const next = localRestrictions.includes(item) ? localRestrictions.filter((value) => value !== item) : [...localRestrictions, item];
    setLocalRestrictions(next); settings.updateSettings({ dietaryRestrictions: next });
  };
  const filtered = useMemo(() => catalog.models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(query.toLowerCase())).slice(0, 150), [catalog.models, query]);
  const addPreference = () => { const text = newPreference.trim(); if (!text) return; createPreference({ text }); setNewPreference(""); };

  return <View style={nativeStyles.screen}><ScreenHeader title="Settings" /><ScrollView contentContainerStyle={nativeStyles.scroll} keyboardShouldPersistTaps="handled">
    <Text style={nativeStyles.sectionTitle}>OpenRouter</Text><Card>{settings.isOpenRouterConnected ? <><View style={styles.connected}><Ionicons name="checkmark-circle" size={22} color={colors.success} /><Text style={styles.connectedText}>Connected</Text></View><Text style={nativeStyles.muted}>Your key is securely stored only on this device.</Text><Button label="Disconnect" variant="danger" onPress={() => Alert.alert("Disconnect OpenRouter?", "AI features will stop until you reconnect.", [{ text: "Cancel", style: "cancel" }, { text: "Disconnect", style: "destructive", onPress: () => settings.updateSettings({ openRouterOAuthKey: "" }) }])} /></> : <><Text style={nativeStyles.muted}>Connect your account to chat and use AI recipe tools. Chefness never displays or logs your key.</Text><Button disabled={connecting} label={connecting ? "Connecting…" : "Connect OpenRouter"} onPress={() => void connect()} /></>}</Card>
    <Card><Text style={nativeStyles.label}>Model</Text><Pressable disabled={!settings.isOpenRouterConnected} onPress={() => setPickerOpen(true)} style={styles.selector}><Text numberOfLines={2} style={styles.selectorText}>{catalog.selectedModel?.name ?? settings.effectiveModel}</Text><Ionicons name="chevron-down" size={20} color={colors.stone600} /></Pressable><View style={nativeStyles.row}><Chip label="Free" selected={catalog.freeOnly} onPress={catalog.toggleFreeOnly} /><Chip label="Vision" selected={catalog.visionOnly} onPress={catalog.toggleVisionOnly} /><Chip label="Tools" selected={catalog.toolsOnly} onPress={catalog.toggleToolsOnly} /></View>{catalog.error && <Text style={nativeStyles.error}>{catalog.error}</Text>}</Card>
    <Text style={nativeStyles.sectionTitle}>Dietary Restrictions</Text><Card><View style={nativeStyles.row}>{restrictions.map((item) => <Chip key={item} label={item} selected={localRestrictions.includes(item)} onPress={() => toggleRestriction(item)} />)}</View><Text style={nativeStyles.label}>Other dietary notes</Text><Field multiline value={notes} onChangeText={setNotes} onBlur={() => settings.updateSettings({ otherDietaryNotes: notes.trim() })} placeholder="Low sodium, allergies, or anything else…" /></Card>
    <Text style={nativeStyles.sectionTitle}>AI Memory</Text><Card><Text style={nativeStyles.muted}>Permanent preferences are included in future chats and stay on this device.</Text><View style={styles.addRow}><Field value={newPreference} onChangeText={setNewPreference} placeholder="I dislike cilantro…" style={{ flex: 1 }} /><Button label="Add" onPress={addPreference} /></View>{preferences.map((preference) => <View key={preference.id} style={styles.preference}><Text style={styles.preferenceText}>{preference.text}</Text><Pressable accessibilityLabel="Delete preference" onPress={() => deletePreference(preference.id)}><Ionicons name="close-circle" size={23} color={colors.roseText} /></Pressable></View>)}</Card>
  </ScrollView>
  <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}><View style={nativeStyles.screen}><ScreenHeader title="Choose Model" action={<Button label="Done" variant="secondary" onPress={() => setPickerOpen(false)} />} /><View style={{ padding: 14 }}><Field value={query} onChangeText={setQuery} placeholder="Search models…" /></View>{catalog.isLoading ? <Loading /> : <ScrollView contentContainerStyle={nativeStyles.scroll}>{filtered.map((model) => <Pressable key={model.id} style={[styles.model, model.id === settings.effectiveModel && styles.selectedModel]} onPress={() => { settings.updateSettings({ llmModel: model.id }); setPickerOpen(false); }}><Text style={styles.modelName}>{model.name}</Text><Text style={styles.modelId}>{model.id}</Text></Pressable>)}</ScrollView>}</View></Modal>
  </View>;
}
const styles = StyleSheet.create({ connected: { flexDirection: "row", alignItems: "center", gap: 7 }, connectedText: { color: colors.success, fontWeight: "700", fontSize: 16 }, selector: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.stone300, borderRadius: 12, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, selectorText: { flex: 1, color: colors.espresso, fontSize: 15 }, addRow: { flexDirection: "row", alignItems: "center", gap: 8 }, preference: { flexDirection: "row", gap: 10, alignItems: "center", padding: 11, borderRadius: 10, backgroundColor: colors.creamDeep }, preferenceText: { flex: 1, color: colors.espresso, lineHeight: 20 }, model: { padding: 13, borderRadius: 12, backgroundColor: colors.white }, selectedModel: { borderWidth: 2, borderColor: colors.saffron }, modelName: { color: colors.espresso, fontWeight: "700" }, modelId: { color: colors.stone500, fontSize: 12, marginTop: 3 } });
