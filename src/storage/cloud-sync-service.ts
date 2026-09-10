import { LibraryStore } from "@/storage/library-store";
import { canonical, parseSnapshot, type Snapshot } from "@/storage/sync-merge";
import type { CloudSyncStatus } from "@/types/cloud-sync";

export interface CloudTransport {
  account(): Promise<string>;
  fetch(account: string): Promise<{ payload: string; token: string }>;
  save(account: string, payload: string, token: string): Promise<boolean>;
}

export class CloudSyncService {
  private entitled = false;
  private generation = 0;
  private pendingAccount: string | null = null;
  private available = false;
  private error: string | null = null;
  private revision = 0;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private library: LibraryStore,
    private cloud: CloudTransport,
  ) {
    library.onChange = () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.run(), 1500);
    };
  }

  accountChanged(): void {
    this.generation++;
    this.available = false;
    this.error = "Your iCloud account changed. Review iCloud Sync in Settings.";
    void this.run();
  }

  async status(): Promise<CloudSyncStatus> {
    const doc = await this.library.read();
    return {
      entitled: this.entitled,
      enabled: doc.enabled ?? this.entitled,
      busy: Boolean(this.running),
      dirty: doc.dirty,
      available: this.available,
      needsAccountConfirmation: Boolean(this.pendingAccount),
      lastSyncedAt: doc.lastSyncedAt,
      error: this.error,
      revision: this.revision,
    };
  }

  async probe(): Promise<boolean> {
    try {
      await this.cloud.account();
      this.available = true;
      this.error = null;
      return true;
    } catch (error) {
      this.available = false;
      this.setError(error);
      return false;
    }
  }

  async setEntitled(value: boolean): Promise<void> {
    if (this.entitled !== value) this.generation++;
    this.entitled = value;
    if (value) {
      await this.library.transaction((doc) => {
        doc.enabled ??= true;
      });
      void this.run();
    }
  }

  async setEnabled(value: boolean): Promise<void> {
    if (value && !this.entitled)
      throw new Error("Purchase iCloud Sync to enable syncing.");
    this.generation++;
    await this.library.transaction((doc) => {
      doc.enabled = value;
    });
    if (value) void this.run();
  }

  async confirmAccount(): Promise<void> {
    const account = await this.cloud.account();
    if (!this.pendingAccount || account !== this.pendingAccount)
      throw new Error(
        "The iCloud account changed again. Try syncing again before confirming.",
      );
    this.generation++;
    await this.library.transaction((doc) => {
      doc.account = account;
      doc.lastSyncedAt = null;
      doc.dirty = true;
    });
    this.pendingAccount = null;
    void this.run();
  }

  run(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.sync()
      .catch((error: unknown) => this.setError(error))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  private setError(error: unknown): void {
    this.error =
      error instanceof Error
        ? error.message
        : "iCloud sync failed. Your local changes are safe. Try again.";
  }

  private async sync(): Promise<void> {
    const generation = this.generation;
    const initial = await this.library.read();
    if (!this.entitled || !initial.enabled) return;
    const valid = () => generation === this.generation && this.entitled;
    this.available = false;
    const account = await this.cloud.account();
    if (!valid()) return;
    this.available = true;
    if (initial.account && initial.account !== account) {
      this.pendingAccount = account;
      this.error =
        "A different iCloud account is signed in. Confirm before merging this device’s library into it.";
      return;
    }
    this.pendingAccount = null;
    await this.library.transaction((doc) => {
      if (valid()) doc.account = account;
    });

    // Retry compare-and-save conflicts, always refetching the asset (not CKError's asset-less record).
    for (let attempt = 0; attempt < 3; attempt++) {
      const fetched = await this.cloud.fetch(account);
      if (!valid()) return;
      let remote: Snapshot;
      try {
        remote = fetched.payload
          ? parseSnapshot(JSON.parse(fetched.payload))
          : { version: 1, entries: [] };
      } catch {
        throw new Error(
          "The iCloud library uses an unsupported or invalid format. Update Chefness or contact support. Local data is safe.",
        );
      }
      const before = await this.library.read();
      const merged = await this.library.transaction((doc) =>
        valid() ? this.library.merge(doc, remote) : null,
      );
      if (!merged || !valid()) return;
      if (canonical(before.entries) !== canonical(merged.entries))
        this.revision++;
      const payload = canonical(merged);
      const differs = payload !== canonical(remote);
      if (differs) {
        if (!valid()) return;
        const saved = await this.cloud.save(account, payload, fetched.token);
        if (!valid()) return;
        if (!saved) continue;
      }
      // A failed/late upload must never acknowledge newer local edits.
      const done = await this.library.transaction((doc) => {
        if (!valid()) return true;
        doc.dirty =
          canonical({
            version: 1,
            entries: [...doc.entries].sort((a, b) =>
              `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`),
            ),
          }) !== payload;
        if (!doc.dirty) doc.lastSyncedAt = new Date().toISOString();
        return !doc.dirty;
      });
      this.error = null;
      if (done) return;
    }
    this.error =
      "Changes are still pending. Chefness will retry shortly, or tap Sync Now.";
  }
}
