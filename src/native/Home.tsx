import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatScreen } from "@/native/ChatScreen";
import { RecipesScreen } from "@/native/RecipesScreen";
import { HistoryScreen } from "@/native/HistoryScreen";
import { SettingsScreen } from "@/native/SettingsScreen";
import { getTabBarMetrics } from "@/native/layout";
import { colors } from "@/theme";

type Tab = "chat" | "recipes" | "history" | "settings";
const tabs: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [{ id: "chat", label: "Chat", icon: "chatbubble-outline" }, { id: "recipes", label: "Recipes", icon: "book-outline" }, { id: "history", label: "History", icon: "time-outline" }, { id: "settings", label: "Settings", icon: "settings-outline" }];
export function Home() {
  const [tab, setTab] = useState<Tab>("chat");
  const { bottom } = useSafeAreaInsets();
  return <View style={styles.root}><View style={styles.content}>
    <View style={[styles.panel, tab !== "chat" && styles.hidden]}><ChatScreen openSettings={() => setTab("settings")} /></View>
    <View style={[styles.panel, tab !== "recipes" && styles.hidden]}><RecipesScreen /></View>
    <View style={[styles.panel, tab !== "history" && styles.hidden]}><HistoryScreen /></View>
    <View style={[styles.panel, tab !== "settings" && styles.hidden]}><SettingsScreen /></View>
  </View><View style={[styles.nav, getTabBarMetrics(bottom)]}>{tabs.map((item) => { const active = tab === item.id; return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={item.id} onPress={() => { Keyboard.dismiss(); setTab(item.id); }} style={styles.tab}><Ionicons name={item.icon} size={23} color={active ? colors.saffronDeep : colors.stone500} /><Text style={[styles.label, active && styles.active]}>{item.label}</Text></Pressable>; })}</View></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.cream }, content: { flex: 1 }, panel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, hidden: { display: "none" }, nav: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.stone300, backgroundColor: colors.glassStrong }, tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }, label: { color: colors.stone500, fontSize: 11, fontWeight: "600" }, active: { color: colors.saffronDeep } });
