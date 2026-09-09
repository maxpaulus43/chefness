import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Haptics are fire-and-forget. They must never block or fail an interaction,
// so every call is wrapped and errors (e.g. simulator, unsupported device) are
// swallowed.
function fire(run: () => Promise<void>) {
  if (Platform.OS !== "ios") return;
  run().catch(() => {});
}

export const haptics = {
  /** Discrete selection change: chips, toggles, tab switches. */
  select: () => fire(() => Haptics.selectionAsync()),
  /** Light tap for ordinary buttons and taps on cards. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Soft, cushioned tap for gentle confirmations (e.g. checking an item). */
  soft: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  /** Firmer tap for committing something (send, apply, log). */
  medium: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Something was saved, connected, or completed. */
  success: () =>
    fire(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  /** A destructive or blocked action. */
  warning: () =>
    fire(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),
  /** A request failed. */
  error: () =>
    fire(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),
} as const;

export type HapticName = keyof typeof haptics;
