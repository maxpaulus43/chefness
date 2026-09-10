import { useEffect, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "@/hooks/useSettings";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { useCloudSync } from "@/hooks/useCloudSync.native";
import { DIETARY_RESTRICTIONS } from "@/lib/dietary-restrictions";
import type { SettingsStackParamList } from "@/native/navigation-routes";
import { DictationField } from "@/native/DictationField";
import { OpenRouterConnection } from "@/native/OpenRouterConnection";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import { Button, Card, Chip, Field, Loading, nativeStyles } from "@/native/ui";

const supportEmail = "support@chefness.org";
const supportUrl = "https://chefness.org/support";
const privacyUrl = "https://chefness.org/privacy";
const appVersion = Constants.expoConfig?.version ?? "Unknown";
const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? "Unknown";

export function SettingsScreen({
  navigation,
}: NativeStackScreenProps<SettingsStackParamList, "Settings">) {
  const settings = useSettings();
  const sync = useCloudSync();
  const catalog = useOpenRouterModels(
    settings.isOpenRouterConnected,
    settings.effectiveModel,
  );
  const { preferences, createPreference, deletePreference } =
    useAiPreferences();
  const [localRestrictions, setLocalRestrictions] = useState(
    settings.dietaryRestrictions,
  );
  const [notes, setNotes] = useState(settings.otherDietaryNotes);
  const [newPreference, setNewPreference] = useState("");
  useEffect(
    () => setLocalRestrictions(settings.dietaryRestrictions),
    [settings.dietaryRestrictions],
  );
  useEffect(
    () => setNotes(settings.otherDietaryNotes),
    [settings.otherDietaryNotes],
  );
  const toggleRestriction = (item: string) => {
    const next = localRestrictions.includes(item)
      ? localRestrictions.filter((value) => value !== item)
      : [...localRestrictions, item];
    setLocalRestrictions(next);
    settings.updateSettings({ dietaryRestrictions: next });
  };
  const addPreference = () => {
    const text = newPreference.trim();
    if (!text) return;
    createPreference({ text });
    setNewPreference("");
  };
  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Couldn’t open link", url);
    }
  };
  const sendEmail = async (subject: string, prompt: string) => {
    const body = `${prompt}\n\n\n\n---\nChefness ${appVersion} (${buildNumber})\niOS ${Platform.Version}`;
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      if (!(await Linking.canOpenURL(`mailto:${supportEmail}`)))
        throw new Error();
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Email isn’t available",
        `Email us at ${supportEmail}, or use the support website.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Support Website",
            onPress: () => void openLink(supportUrl),
          },
        ],
      );
    }
  };

  const syncSection = (
    <>
      <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
        iCloud Sync
      </Text>
      <Card>
        <Text style={nativeStyles.muted}>
          Unlimited recipes are free on this device. Sync recipes, chat text,
          history, and preferences across your Apple devices with one purchase.
          Photos and OpenRouter connections stay on each device.
        </Text>
        {sync.status?.entitled ? (
          <>
            <View style={styles.selector}>
              <Text style={nativeStyles.label}>iCloud Sync</Text>
              <Switch
                accessibilityLabel="iCloud Sync"
                value={sync.status.enabled}
                onValueChange={(enabled) => {
                  if (enabled) {
                    void sync.setEnabled(true);
                    return;
                  }
                  Alert.alert(
                    "Pause iCloud Sync?",
                    "Your local and iCloud data will stay. Edits and deletions made while paused will sync when you turn it back on.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Pause Sync",
                        onPress: () => void sync.setEnabled(false),
                      },
                    ],
                  );
                }}
              />
            </View>
            <Text accessibilityLiveRegion="polite" style={nativeStyles.muted}>
              {!sync.status.enabled
                ? "Sync paused"
                : sync.status.busy
                  ? "Syncing…"
                  : sync.status.error
                    ? "Sync needs attention"
                    : sync.status.dirty
                      ? "Changes waiting to sync"
                      : sync.status.lastSyncedAt
                        ? "Synced"
                        : "Waiting for first sync"}
            </Text>
            {sync.status.lastSyncedAt && (
              <Text style={nativeStyles.muted}>
                Last synced:{" "}
                {new Date(sync.status.lastSyncedAt).toLocaleString()}
              </Text>
            )}
            <Button
              label="Sync Now"
              variant="secondary"
              disabled={!sync.status.enabled || sync.status.busy}
              onPress={() => void sync.syncNow()}
            />
            {sync.status.needsAccountConfirmation && (
              <Button
                label="Review Changed iCloud Account"
                variant="secondary"
                onPress={() =>
                  Alert.alert(
                    "Merge into this iCloud account?",
                    "This device contains data from another iCloud account. Continuing uploads this entire local library, including chats and dietary information, into the currently signed-in account. Its existing library will be merged, not replaced.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Merge Library",
                        onPress: () => void sync.confirmAccount(),
                      },
                    ],
                  )
                }
              />
            )}
          </>
        ) : (
          <>
            <Text style={nativeStyles.muted}>
              Purchasing turns sync on automatically using your iCloud account.
              You can turn it off afterward. Requires iCloud sign-in. Photos do
              not sync.
            </Text>
            <Button
              disabled={
                sync.isLoading || sync.isPurchasing || !sync.canPurchase
              }
              label={
                sync.isPurchasing
                  ? "Purchasing…"
                  : `Enable iCloud Sync — ${sync.price} once`
              }
              onPress={() => void sync.purchase()}
            />
          </>
        )}
        <Button
          disabled={sync.isLoading || sync.isPurchasing}
          label={sync.isLoading ? "Checking Purchases…" : "Restore Purchases"}
          variant="secondary"
          onPress={() => void sync.restore()}
        />
        {(sync.error ?? sync.status?.error) && (
          <Text accessibilityLiveRegion="assertive" style={nativeStyles.error}>
            {sync.error ?? sync.status?.error}
          </Text>
        )}
      </Card>
    </>
  );

  return (
    <View style={nativeStyles.screen}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={nativeStyles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
          OpenRouter
        </Text>
        <OpenRouterConnection settings={settings} />
        <Card>
          <Text style={nativeStyles.label}>Model</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Selected model: ${catalog.selectedModel?.name ?? settings.effectiveModel}`}
            accessibilityHint="Opens model selection"
            accessibilityState={{ disabled: !settings.isOpenRouterConnected }}
            disabled={!settings.isOpenRouterConnected}
            onPress={() => navigation.navigate("ModelSelection")}
            style={styles.selector}
          >
            <Text style={styles.selectorText}>
              {catalog.selectedModel?.name ?? settings.effectiveModel}
            </Text>
            <Ionicons
              accessible={false}
              name="chevron-down"
              size={20}
              color={colors.stone600}
            />
          </Pressable>
          {catalog.error && (
            <Text
              accessibilityLiveRegion="assertive"
              style={nativeStyles.error}
            >
              {catalog.error}
            </Text>
          )}
        </Card>
        {syncSection}
        <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
          Dietary Restrictions
        </Text>
        <Card>
          <View style={nativeStyles.row}>
            {DIETARY_RESTRICTIONS.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={localRestrictions.includes(item)}
                onPress={() => toggleRestriction(item)}
              />
            ))}
          </View>
          <Text style={nativeStyles.label}>Other dietary notes</Text>
          <Field
            accessibilityLabel="Other dietary notes"
            multiline
            value={notes}
            onChangeText={setNotes}
            onBlur={() =>
              settings.updateSettings({ otherDietaryNotes: notes.trim() })
            }
            placeholder="Low sodium, allergies, or anything else…"
          />
        </Card>
        <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
          AI Memory
        </Text>
        <Card>
          <Text style={nativeStyles.muted}>
            Permanent preferences are included in future chats and sync across
            your devices when iCloud Sync is enabled.
          </Text>
          <View style={styles.addRow}>
            <DictationField
              accessibilityLabel="New preference"
              value={newPreference}
              onChangeText={setNewPreference}
              multiline
              placeholder="I dislike cilantro…"
            />
            <Button label="Add" onPress={addPreference} />
          </View>
          {preferences.map((preference) => (
            <View key={preference.id} style={styles.preference}>
              <Text style={styles.preferenceText}>{preference.text}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete preference: ${preference.text}`}
                accessibilityHint="Removes this preference from AI memory"
                style={styles.iconButton}
                onPress={() => deletePreference(preference.id)}
              >
                <Ionicons
                  accessible={false}
                  name="close-circle"
                  size={23}
                  color={colors.roseText}
                />
              </Pressable>
            </View>
          ))}
        </Card>
        {__DEV__ ? (
          <>
            <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
              Developer
            </Text>
            <Card>
              <Text style={nativeStyles.muted}>
                Reset first-run setup without deleting recipes or other data.
              </Text>
              <Button
                label="Show Onboarding Again"
                variant="secondary"
                onPress={() =>
                  settings.updateSettings({ hasCompletedOnboarding: false })
                }
              />
            </Card>
          </>
        ) : null}
        <Text accessibilityRole="header" style={nativeStyles.sectionTitle}>
          Help & Feedback
        </Text>
        <Card>
          <Button
            label="Send Feedback"
            variant="secondary"
            onPress={() =>
              void sendEmail("Chefness feedback", "Share your feedback:")
            }
          />
          <Button
            label="Report a Problem"
            variant="secondary"
            onPress={() =>
              void sendEmail(
                "Chefness problem report",
                "Please describe what happened:",
              )
            }
          />
          <Button
            label="Email Support"
            variant="secondary"
            onPress={() =>
              void sendEmail("Chefness support", "How can we help?")
            }
          />
          <Button
            label="Support Website"
            variant="secondary"
            onPress={() => void openLink(supportUrl)}
          />
          <Button
            label="Privacy Policy"
            variant="secondary"
            onPress={() => void openLink(privacyUrl)}
          />
          <Text style={styles.version}>
            Version {appVersion} ({buildNumber})
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

export function ModelSelectionScreen({
  navigation,
}: NativeStackScreenProps<SettingsStackParamList, "ModelSelection">) {
  const settings = useSettings();
  const catalog = useOpenRouterModels(
    settings.isOpenRouterConnected,
    settings.effectiveModel,
    {
      freeOnly: settings.settings.modelFilterFreeOnly,
      visionOnly: settings.settings.modelFilterVisionOnly,
      toolsOnly: settings.settings.modelFilterToolsOnly,
    },
    (filters) =>
      settings.updateSettings({
        modelFilterFreeOnly: filters.freeOnly,
        modelFilterVisionOnly: filters.visionOnly,
        modelFilterToolsOnly: filters.toolsOnly,
      }),
  );
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      catalog.models.filter((model) =>
        `${model.name} ${model.id}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [catalog.models, query],
  );
  return (
    <View style={nativeStyles.screen}>
      <View style={{ padding: 14, gap: 10 }}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search models…"
        />
        <View style={nativeStyles.row}>
          <Chip
            label="Free"
            selected={catalog.freeOnly}
            onPress={catalog.toggleFreeOnly}
          />
          <Chip
            label="Vision"
            selected={catalog.visionOnly}
            onPress={catalog.toggleVisionOnly}
          />
          <Chip
            label="Tools"
            selected={catalog.toolsOnly}
            onPress={catalog.toggleToolsOnly}
          />
        </View>
      </View>
      {catalog.isLoading && catalog.totalModelCount === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          keyExtractor={(model) => model.id}
          contentContainerStyle={nativeStyles.scroll}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={catalog.isLoading}
              onRefresh={catalog.retry}
              tintColor={colors.saffronDeep}
            />
          }
          renderItem={({ item: model }) => {
            const selected = model.id === settings.effectiveModel;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${model.name}, ${model.id}${selected ? ", selected" : ""}`}
                accessibilityHint="Selects this model and closes the sheet"
                accessibilityState={{ selected }}
                style={[styles.model, selected && styles.selectedModel]}
                onPress={() => {
                  settings.updateSettings({ llmModel: model.id });
                  navigation.goBack();
                }}
              >
                <View accessible={false} style={styles.modelText}>
                  <Text style={styles.modelName}>{model.name}</Text>
                  <Text style={styles.modelId}>{model.id}</Text>
                </View>
                {selected && (
                  <Ionicons
                    accessible={false}
                    name="checkmark"
                    size={24}
                    color={colors.saffronDeep}
                  />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  selector: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.stone300,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorText: {
    flex: 1,
    color: colors.espresso,
    fontSize: 15,
    fontFamily: nativeFonts.sans,
  },
  addRow: { gap: 8, alignItems: "stretch" },
  preference: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 11,
    borderRadius: 10,
    backgroundColor: colors.creamDeep,
  },
  preferenceText: {
    flex: 1,
    color: colors.espresso,
    lineHeight: 20,
    fontFamily: nativeFonts.sans,
  },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  model: {
    minHeight: 44,
    padding: 13,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modelText: { flex: 1 },
  selectedModel: { borderWidth: 2, borderColor: colors.saffron },
  modelName: { color: colors.espresso, fontFamily: nativeFonts.sansBold },
  modelId: {
    color: colors.stone500,
    fontSize: 12,
    marginTop: 3,
    fontFamily: nativeFonts.sans,
  },
  version: {
    color: colors.stone500,
    fontSize: 13,
    textAlign: "center",
    fontFamily: nativeFonts.sans,
  },
});
