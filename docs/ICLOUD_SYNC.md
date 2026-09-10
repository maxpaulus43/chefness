# iCloud Sync

## Agreed product contract

- Unlimited local recipes are free. The existing $9.99 non-consumable product ID
  unlocks personal iCloud sync; enable purchase Family Sharing in App Store Connect.
  Sharing the purchase does not share libraries between Apple Accounts.
- Sync recipes, cooking history/ratings, AI memory, dietary restrictions, model
  selection/filter settings, and chat text. No web sync or Chefness account.
- Photos stay on their original device; other devices show a placeholder and tell
  the AI that the photo is unavailable. Never upload file paths, image bytes,
  OpenRouter credentials, onboarding completion, or the device's sync toggle.
- Purchase/restoration enables sync unless explicitly disabled on this device.
- First sync merges by ID, not title. Recipes/history/memories use whole-record
  last-edit-wins; settings use per-field last-edit-wins. Device time determines
  latest, with deterministic ties. Concurrent chat branches remain separate chats.
- Deletion wins over offline edits. Tombstones are retained. No Recently Deleted.
- Turning sync off pauses it, keeps local/cloud data, and queues offline edits and
  deletions for re-enabling. Changing iCloud accounts requires explicit consent
  before uploading the existing local library into the new account.
- Local use never waits for the network. Failures keep queued changes and show an
  actionable status. Sync on resume, after local changes, and periodically while
  active; iOS suspension means delivery while closed is not guaranteed.

## Implementation plan

1. Add atomic native persistence with durable sync metadata; migrate existing
   AsyncStorage arrays without deleting the originals. Test merges, tombstones,
   offline edits, field-level settings, chat forks, and photo/credential exclusion.
2. Add a local Swift Expo module for private CloudKit account checks and optimistic
   compare-and-save. Keep all application merge logic in testable TypeScript.
3. Reuse StoreKit for the iCloud entitlement, remove every recipe-limit gate, and
   add Settings controls/status plus missing-photo presentation and model context.
4. Verify tests, lint, type checks, web build, iOS export and native compilation.
   Verify real cross-device behavior on the user's iPhone/iPad before release.

## Deliberate v1 ceiling

Use one versioned JSON CKAsset snapshot with compare-and-save, not an overwriteable
JSON file in iCloud Drive. Merge individual records inside the snapshot. This keeps
native code small and makes failed uploads/crashes retryable without a backend.
Each changed upload transfers the text library; tombstones and metadata grow with
usage. The implementation caps cloud snapshots at 20 MB (local saves still work).
Move to per-record CloudKit change tracking if text libraries or traffic outgrow
this ceiling. Photos are excluded. No closed-app background-delivery promise.

## Apple-side release setup

- Register `iCloud.com.maxpaulus.chefness`; assign it to the main app's App ID.
- Enable iCloud / CloudKit and regenerate signing profiles. The share extension
  does not need access to CloudKit.
- In CloudKit Console, create/deploy the `ChefnessLibrary` record type with its
  `snapshot` Asset field from Development to Production. Do not put user content
  in a public database. TestFlight uses Production; debug builds use Development.
- Rename the existing `com.maxpaulus.chefness.unlimited_recipes` product to
  **iCloud Sync**, retaining its non-consumable type and $9.99 price. Update
  descriptions and review screenshots to disclose automatic enablement and that
  photos do not sync.
- Enable Family Sharing on the product (irreversible) and test restoration and
  entitlement revocation with sandbox accounts. Never auto-purchase for testing.

## Two-device release checklist

Use two physical devices with the same iCloud account and the same CloudKit
Development/Production environment. Connect OpenRouter separately on each.

- Free: save/import more than five recipes; chat, edit, delete, share still work.
- Purchase on A: sync starts automatically. Restore on B: both libraries merge.
- Create/edit recipes, log/rate meals, change different settings, add AI memories:
  verify the other device updates on resume and while open; restart both devices.
- Attach a photo on A: B shows a placeholder, can continue the conversation, and
  does not attempt to load a file URI. A retains its photo after round-trip sync.
- Offline edits to the same recipe: later device timestamp wins. Different
  settings fields survive. Concurrent chat continuations become separate chats.
- Delete on A while B is offline and editing: delete survives B reconnecting.
- Toggle off: no cloud transfer; edits/deletions merge after re-enabling. Relaunch
  and Restore Purchases must not override the explicit off preference.
- Sign out of iCloud: local data remains usable, sync pauses. Switch accounts:
  no existing library uploads until explicit merge confirmation.
- Simulate network failure, quota exhaustion, simultaneous uploads and app
  termination: local writes survive; retry converges; no false Synced status.
- Refund/revoke purchase or Family Sharing access: syncing stops, local content
  remains available. Family member's unlock must not reveal purchaser's data.
- Verify production schema with a TestFlight build before public release.
