import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TRPCProvider } from "@/trpc/provider";
import { NativeNavigation } from "@/native/navigation";
import { colors } from "@/theme";

export default function NativeApp() {
  return <SafeAreaProvider><StatusBar style="dark" /><View style={styles.root}><TRPCProvider><NativeNavigation /></TRPCProvider></View></SafeAreaProvider>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.cream } });
