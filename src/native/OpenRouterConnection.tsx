import { useState } from "react";
import { Alert, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import type { useSettings } from "@/hooks/useSettings";
import { buildAuthUrl, exchangeCodeForKey } from "@/lib/openrouter-oauth";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import { Button, Card, nativeStyles } from "@/native/ui";

const OPENROUTER_CALLBACK_URL = "https://chefness.org/openrouter/callback/";
const OPENROUTER_APP_REDIRECT_URL = "chefness://openrouter";

export function OpenRouterConnection({
  settings,
  allowDisconnect = true,
}: {
  settings: ReturnType<typeof useSettings>;
  allowDisconnect?: boolean;
}) {
  const [connecting, setConnecting] = useState(false);

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
      const authUrl = buildAuthUrl(OPENROUTER_CALLBACK_URL, challenge, "S256");
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        OPENROUTER_APP_REDIRECT_URL,
        {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        },
      );
      if (result.type !== "success") return;

      const code = new URL(result.url).searchParams.get("code");
      if (!code)
        throw new Error("OpenRouter did not return an authorization code.");

      const key = await exchangeCodeForKey(code, verifier, "S256");
      await settings.updateSettingsAsync({ openRouterOAuthKey: key });
      Alert.alert("Connected", "Your OpenRouter account is ready.");
    } catch (error) {
      Alert.alert(
        "Couldn’t connect OpenRouter",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card>
      {settings.isOpenRouterConnected ? (
        <>
          <View
            accessibilityLabel="OpenRouter status: Connected"
            style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
          >
            <Ionicons
              accessible={false}
              name="checkmark-circle"
              size={22}
              color={colors.success}
            />
            <Text
              style={{
                color: colors.success,
                fontFamily: nativeFonts.sansBold,
              }}
            >
              Connected ✓
            </Text>
          </View>
          <Text style={nativeStyles.muted}>
            Your key is stored in the iOS Keychain and stays on this device.
          </Text>
          {allowDisconnect ? (
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
          ) : null}
        </>
      ) : (
        <>
          <Text style={nativeStyles.muted}>
            Sign in with OpenRouter, then Chefness will return and connect
            automatically. Your API key is stored in the iOS Keychain and never
            displayed or logged.
          </Text>
          <Button
            disabled={connecting}
            label={connecting ? "Connecting…" : "Connect AI"}
            onPress={() => void connect()}
          />
        </>
      )}
    </Card>
  );
}
