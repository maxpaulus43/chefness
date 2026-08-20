import { Pressable, StyleSheet, Text, View } from "react-native";
import { close, openHostApp, type InitialProps } from "expo-share-extension";
import { encodeSharedUrl } from "@/lib/share-url-encoding";
import { colors, radii } from "@/theme";

// Root component of the iOS share extension (registered in index.share.js).
// It runs in a separate extension process with its own sandbox, so it cannot
// write to the app's AsyncStorage. Instead it hands the shared URL to the main
// app via a deep link, where the existing chat URL-import flow saves the
// recipe. Custom fonts are runtime-loaded in the main app and unavailable
// here, so this screen uses system fonts.
export default function ShareExtensionScreen({ url }: InitialProps) {
  const importRecipe = () => {
    if (!url) return;
    openHostApp(
      `chats?sharedUrl=${encodeSharedUrl(url)}&shareTs=${Date.now()}`,
    );
  };

  return (
    <View style={styles.root}>
      <Text allowFontScaling={false} style={styles.title}>
        Save recipe to Chefness
      </Text>
      {url ? (
        <Text allowFontScaling={false} style={styles.url} numberOfLines={2}>
          {url}
        </Text>
      ) : (
        <Text allowFontScaling={false} style={styles.url}>
          No link was shared.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Import recipe"
        disabled={!url}
        style={[styles.button, !url && styles.buttonDisabled]}
        onPress={importRecipe}
      >
        <Text allowFontScaling={false} style={styles.buttonText}>
          Import Recipe
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        style={styles.cancelButton}
        onPress={close}
      >
        <Text allowFontScaling={false} style={styles.cancelText}>
          Cancel
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    gap: 14,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.espresso,
    textAlign: "center",
  },
  url: {
    fontSize: 14,
    color: colors.stone500,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.saffron,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "600" },
  cancelButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelText: { color: colors.stone500, fontSize: 15 },
});
