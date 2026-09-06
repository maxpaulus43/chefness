import type { Settings } from "@/types/settings";
import type { SyncedEntity } from "@/lib/cloud-sync/types";

export function isTombstone(entity: SyncedEntity): boolean {
  return Boolean(entity.deletedAt);
}

export function isLive(entity: SyncedEntity): boolean {
  return !entity.deletedAt;
}

/**
 * Last-write-wins on the device-side `updatedAt` timestamp.
 *
 * Tombstones carry `updatedAt === deletedAt`, so a deletion competes with
 * edits on equal terms. Ties keep the local copy so nothing is rewritten.
 * Timestamps are ISO-8601 strings, which compare correctly lexically.
 */
export function pickLatest<T extends SyncedEntity>(local: T, remote: T): T {
  return remote.updatedAt > local.updatedAt ? remote : local;
}

/**
 * Settings records that have never been customized (the defaults created on
 * first launch). A freshly installed device must not overwrite real settings
 * from another device just because its default record is newer.
 */
export function isPristineSettings(settings: Settings): boolean {
  return (
    settings.llmModel === "" &&
    settings.dietaryRestrictions.length === 0 &&
    settings.otherDietaryNotes === "" &&
    !settings.modelFilterFreeOnly &&
    !settings.modelFilterVisionOnly &&
    !settings.modelFilterToolsOnly
  );
}

/**
 * Settings merge: last-write-wins with two exceptions.
 *
 * - A pristine local record always defers to the remote one.
 * - Onboarding completion is sticky: once finished on any device it stays
 *   finished everywhere, so a second device never re-shows the intro.
 *
 * Credentials never sync, so the local secret fields are always preserved.
 */
export function mergeSettings(local: Settings, remote: Settings): Settings {
  const winner =
    isPristineSettings(local) && !isPristineSettings(remote)
      ? remote
      : pickLatest(local, remote);
  const hasCompletedOnboarding =
    local.hasCompletedOnboarding || remote.hasCompletedOnboarding;
  if (
    winner === local &&
    hasCompletedOnboarding === local.hasCompletedOnboarding
  ) {
    return local;
  }
  return {
    ...winner,
    hasCompletedOnboarding,
    openRouterOAuthKey: local.openRouterOAuthKey,
    llmApiKey: local.llmApiKey,
  };
}

/** Strip credentials before a settings record is uploaded. */
export function settingsToPayload(settings: Settings): Settings {
  return { ...settings, openRouterOAuthKey: "", llmApiKey: "" };
}
