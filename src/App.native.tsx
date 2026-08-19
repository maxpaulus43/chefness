import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { TRPCProvider } from "@/trpc/provider";
import { Home } from "@/native/Home";
import { colors } from "@/theme";

export default function NativeApp() {
  return <SafeAreaProvider><StatusBar style="dark" /><SafeAreaView edges={["top", "left", "right"]} style={styles.safe}><TRPCProvider><Home /></TRPCProvider></SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.cream } });
