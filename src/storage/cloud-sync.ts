import type { CloudSyncStatus } from "@/types/cloud-sync";

const unavailable = (): Promise<void> =>
  Promise.reject(new Error("iCloud Sync is available only in the iOS app."));
export const cloudSync = {
  status(): Promise<CloudSyncStatus> {
    return Promise.resolve({
      entitled: false,
      enabled: false,
      busy: false,
      dirty: false,
      available: false,
      needsAccountConfirmation: false,
      lastSyncedAt: null,
      error: null,
      revision: 0,
    });
  },
  probe() {
    return Promise.resolve(false);
  },
  setEntitled(_value: boolean) {
    return Promise.resolve();
  },
  setEnabled: (_value: boolean) => unavailable(),
  confirmAccount: unavailable,
  run: () => Promise.resolve(),
};
