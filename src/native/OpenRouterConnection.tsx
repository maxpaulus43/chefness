import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Modal,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import type { useSettings } from "@/hooks/useSettings";
import {
  buildHeadlessAuthUrl,
  exchangeCodeForKey,
} from "@/lib/openrouter-oauth";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import { Button, Card, Field, ScreenHeader, nativeStyles } from "@/native/ui";

export function OpenRouterConnection({
  settings,
  allowDisconnect = true,
}: {
  settings: ReturnType<typeof useSettings>;
  allowDisconnect?: boolean;
}) {
  const [connecting, setConnecting] = useState(false);
  const [codePromptOpen, setCodePromptOpen] = useState(false);
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [pendingVerifier, setPendingVerifier] = useState("");

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

  const closeCodePrompt = () => {
    setCodePromptOpen(false);
    setAuthorizationCode("");
    setPendingVerifier("");
  };

  return (
    <>
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
              Connect your account to chat and use AI recipe tools. OpenRouter
              will show a one-time code after you create the key; copy it, close
              the browser, then paste it into Chefness. Chefness stores your API
              key in the iOS Keychain and never displays or logs it.
            </Text>
            <Button
              disabled={connecting}
              label={connecting ? "Connecting…" : "Connect OpenRouter"}
              onPress={() => void connect()}
            />
          </>
        )}
      </Card>
      <Modal
        visible={codePromptOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCodePrompt}
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
              onPress={() =>
                void Clipboard.getStringAsync().then((value) =>
                  setAuthorizationCode(value.trim()),
                )
              }
            />
            <Button
              disabled={connecting || !authorizationCode.trim()}
              label={connecting ? "Connecting…" : "Connect"}
              onPress={() => void finishConnection()}
            />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={closeCodePrompt}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
