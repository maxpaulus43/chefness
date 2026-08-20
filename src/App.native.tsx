import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TRPCProvider } from "@/trpc/provider";
import { NativeNavigation } from "@/native/navigation";
import { colors } from "@/theme";

export default function NativeApp() {
  return <GestureHandlerRootView style={styles.root}><SafeAreaProvider><StatusBar style="dark" /><View style={styles.root}><TRPCProvider><NativeNavigation /></TRPCProvider></View></SafeAreaProvider></GestureHandlerRootView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.cream } });
