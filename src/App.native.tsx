import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces/700Bold";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TRPCProvider } from "@/trpc/provider";
import { NativeNavigation } from "@/native/navigation";
import { AccessibilityPreferencesProvider } from "@/native/accessibility";
import { RecipeAccessProvider } from "@/hooks/useRecipeAccess";
import { nativeColors } from "@/native/theme";

export default function NativeApp() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_700Bold,
  });
  if (!fontsLoaded) return <View style={styles.root} />;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AccessibilityPreferencesProvider>
          <StatusBar style="dark" />
          <View style={styles.root}>
            <TRPCProvider>
              <RecipeAccessProvider>
                <NativeNavigation />
              </RecipeAccessProvider>
            </TRPCProvider>
          </View>
        </AccessibilityPreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: nativeColors.cream },
});
