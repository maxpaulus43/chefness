import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { useSettings } from "@/hooks/useSettings";
import { DIETARY_RESTRICTIONS } from "@/lib/dietary-restrictions";
import { OpenRouterConnection } from "@/native/OpenRouterConnection";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import { Button, Card, Chip, Field, nativeStyles } from "@/native/ui";

export function OnboardingScreen({
  settings,
}: {
  settings: ReturnType<typeof useSettings>;
}) {
  const [step, setStep] = useState(0);
  const [restrictions, setRestrictions] = useState<string[]>(
    settings.dietaryRestrictions,
  );
  const [notes, setNotes] = useState(settings.otherDietaryNotes);
  const [finishing, setFinishing] = useState(false);

  const savePersonalization = async () => {
    try {
      await settings.updateSettingsAsync({
        dietaryRestrictions: restrictions,
        otherDietaryNotes: notes.trim(),
      });
      setStep(2);
    } catch {
      Alert.alert("Couldn’t save preferences", "Please try again.");
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await settings.updateSettingsAsync({ hasCompletedOnboarding: true });
    } catch {
      Alert.alert("Couldn’t finish setup", "Please try again.");
    } finally {
      setFinishing(false);
    }
  };

  const toggleRestriction = (item: string) =>
    setRestrictions((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item],
    );

  return (
    <SafeAreaView style={nativeStyles.screen}>
      <View
        accessibilityLabel={`Step ${step + 1} of 3`}
        style={styles.progress}
      >
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[styles.progressDot, index <= step && styles.progressActive]}
          />
        ))}
      </View>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 ? (
          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <Ionicons
                accessible={false}
                name="restaurant-outline"
                size={45}
                color={colors.saffronDeep}
              />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              Your personal cooking guru
            </Text>
            <Text style={styles.body}>
              Get practical meal ideas, save recipes, and remember what works
              for you.
            </Text>
            <Card style={styles.privacyCard}>
              <Ionicons
                accessible={false}
                name="lock-closed-outline"
                size={24}
                color={colors.success}
              />
              <Text style={styles.privacyText}>
                Your recipes, history, and preferences stay on this device.
              </Text>
            </Card>
            <Button label="Get Started" onPress={() => setStep(1)} />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.title}>
              Make it yours
            </Text>
            <Text style={styles.body}>
              Choose any dietary needs. You can change these later in Settings.
            </Text>
            <View style={nativeStyles.row}>
              {DIETARY_RESTRICTIONS.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  selected={restrictions.includes(item)}
                  onPress={() => toggleRestriction(item)}
                />
              ))}
            </View>
            <Text style={nativeStyles.label}>Anything else?</Text>
            <Field
              accessibilityLabel="Other dietary notes"
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Low sodium, allergies, or anything else…"
            />
            <Button
              label="Continue"
              disabled={settings.isUpdating}
              onPress={() => void savePersonalization()}
            />
            <Button
              label="Skip"
              variant="secondary"
              onPress={() => setStep(2)}
            />
            <Button
              label="Back"
              variant="secondary"
              onPress={() => setStep(0)}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.title}>
              Connect your cooking guru
            </Text>
            <Text style={styles.body}>
              Chefness uses OpenRouter for AI chat. Connecting is optional;
              saved recipes and history work without it.
            </Text>
            <OpenRouterConnection settings={settings} allowDisconnect={false} />
            <Button
              label={
                finishing
                  ? "Starting…"
                  : settings.isOpenRouterConnected
                    ? "Start Cooking"
                    : "Continue Without AI"
              }
              disabled={finishing}
              onPress={() => void finish()}
            />
            <Button
              label="Back"
              variant="secondary"
              onPress={() => setStep(1)}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  progress: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  progressDot: {
    width: 28,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.stone300,
  },
  progressActive: { backgroundColor: colors.saffron },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 40,
  },
  hero: { gap: 18, alignItems: "stretch" },
  section: { gap: 16 },
  iconCircle: {
    width: 88,
    height: 88,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
    backgroundColor: colors.saffronTint,
  },
  title: {
    color: colors.espresso,
    fontSize: 34,
    lineHeight: 40,
    textAlign: "center",
    fontFamily: nativeFonts.serifBold,
  },
  body: {
    color: colors.stone600,
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    fontFamily: nativeFonts.sans,
  },
  privacyCard: { flexDirection: "row", alignItems: "center" },
  privacyText: {
    flex: 1,
    color: colors.stone700,
    lineHeight: 21,
    fontFamily: nativeFonts.sansSemiBold,
  },
});
