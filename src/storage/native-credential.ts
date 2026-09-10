import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const SECURE_STORE_KEY = "chefness.openrouter-oauth-key";
export const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
let migrationPromise: Promise<void> | undefined;

/** Must finish before native library migration can copy the old settings array. */
async function migrateLegacyCredential(): Promise<void> {
  const marker = "chefness:openrouter-keychain-migrated";
  if (await AsyncStorage.getItem(marker)) return;
  const serialized = await AsyncStorage.getItem("chefness:settings");
  if (serialized) {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) throw new Error("Invalid saved settings");
    let legacyKey = "";
    const scrubbed = parsed.map((value: unknown) => {
      if (typeof value !== "object" || value === null) return value;
      const record = value as Record<string, unknown>;
      if (!legacyKey && typeof record.openRouterOAuthKey === "string")
        legacyKey = record.openRouterOAuthKey;
      const { openRouterOAuthKey: _, ...nonSecretSettings } = record;
      return nonSecretSettings;
    });
    if (legacyKey && !(await SecureStore.getItemAsync(SECURE_STORE_KEY)))
      await SecureStore.setItemAsync(
        SECURE_STORE_KEY,
        legacyKey,
        SECURE_STORE_OPTIONS,
      );
    await AsyncStorage.setItem("chefness:settings", JSON.stringify(scrubbed));
  }
  await AsyncStorage.setItem(marker, "1");
}

export function ensureMigrated(): Promise<void> {
  migrationPromise ??= migrateLegacyCredential().catch((error: unknown) => {
    migrationPromise = undefined;
    throw error;
  });
  return migrationPromise;
}
