/**
 * iCloud Sync state and actions for the UI, plus the app-level bridge that
 * keeps the sync engine informed of the purchase entitlement and refreshes
 * query caches when records arrive from another device.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  getCloudSyncSnapshot,
  setCloudSyncEnabled,
  setCloudSyncEntitled,
  subscribeCloudSync,
  subscribeCloudSyncChanges,
  syncNow,
} from "@/lib/cloud-sync/engine";
import { trpc } from "@/trpc/client";

export function useCloudSync() {
  const snapshot = useSyncExternalStore(
    subscribeCloudSync,
    getCloudSyncSnapshot,
    getCloudSyncSnapshot,
  );

  const setEnabled = useCallback(
    (enabled: boolean) => setCloudSyncEnabled(enabled),
    [],
  );

  return {
    /** `false` on web and in builds without the CloudKit module. */
    isAvailable: snapshot.isAvailable,
    /** Whether the iCloud Sync purchase is owned. */
    isEntitled: snapshot.isEntitled,
    /** The user's on-device toggle. */
    isEnabled: snapshot.isEnabled,
    accountStatus: snapshot.accountStatus,
    isSyncing: snapshot.isSyncing,
    lastSyncedAt: snapshot.lastSyncedAt,
    error: snapshot.error,
    /** Turn sync on or off. Enabling merges local data with iCloud. */
    setEnabled,
    /** Run a fetch + push cycle immediately. */
    syncNow,
  } as const;
}

/** Mount once near the app root (see `src/App.native.tsx`). */
export function useCloudSyncBridge() {
  const { hasCloudSync } = useEntitlements();
  const utils = trpc.useUtils();

  useEffect(() => {
    setCloudSyncEntitled(hasCloudSync);
  }, [hasCloudSync]);

  useEffect(
    () =>
      subscribeCloudSyncChanges((storeNames) => {
        for (const storeName of storeNames) {
          switch (storeName) {
            case "recipes":
              void utils.recipe.invalidate();
              break;
            case "settings":
              void utils.settings.invalidate();
              break;
            case "cooking-log":
              void utils.cookingLog.invalidate();
              break;
            case "ai-preferences":
              void utils.aiPreference.invalidate();
              break;
            case "chat-sessions":
              void utils.chatSession.invalidate();
              break;
            default:
              void utils.invalidate();
          }
        }
      }),
    [utils],
  );
}
