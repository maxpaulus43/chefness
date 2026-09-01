import { expect, test } from "bun:test";
import {
  createSettingsInput,
  settingsSchema,
  updateSettingsInput,
} from "../src/types/settings";

const legacySettings = {
  id: "user-settings",
  openRouterOAuthKey: "",
  dietaryRestrictions: [],
  otherDietaryNotes: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("onboarding runs for new installs without interrupting existing users", () => {
  expect(createSettingsInput.parse({}).hasCompletedOnboarding).toBe(false);
  expect(settingsSchema.parse(legacySettings).hasCompletedOnboarding).toBe(
    true,
  );
  expect(
    updateSettingsInput.parse({
      id: "user-settings",
      hasCompletedOnboarding: true,
    }).hasCompletedOnboarding,
  ).toBe(true);
});
