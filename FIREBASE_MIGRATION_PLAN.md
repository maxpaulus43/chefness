# Chefness Firebase Auth & Firestore Migration Plan

> **Status:** Planning complete — implementation not started
>
> **Created:** 2026-07-09
>
> This is the implementation and progress-tracking document for adding Firebase
> Authentication and replacing signed-in persistence with Cloud Firestore.
> Update checkboxes, the progress log, and the decision log as work proceeds.

---

## 1. Goal

Add optional Chefness accounts so users can sync and back up their data across
multiple devices without giving up guest use or offline-first behavior.

- Signed-out guests continue using IndexedDB.
- Signed-in users use Cloud Firestore with persistent offline caching.
- Google and email/password authentication are supported.
- Existing guest data can be imported once into a signed-in account.
- LLM API keys and OpenRouter OAuth keys never leave the local device.
- Existing in-browser tRPC and UI/hook boundaries remain in place.

The initial motivation is cross-device sync and backup/restore. Future social
features are a design consideration, but no social or sharing schema is part of
this project.

---

## 2. Current-state corrections

The code is ahead of parts of `ARCHITECTURE.md`, `PRD.md`, and `README.md`.
Before implementation, treat the code as authoritative:

- Structured data is currently stored in IndexedDB, not localStorage.
- A one-time localStorage-to-IndexedDB migration already exists.
- Chat-session persistence and session management are already implemented.
- Five persisted entities exist:
  - recipes
  - cooking log entries
  - AI preferences
  - chat sessions
  - settings
- The PWA and `/api/extract-recipe-url` endpoint are currently deployed through
  Cloudflare.

Documentation reconciliation is included in this plan.

---

## 3. Agreed scope

### 3.1 Core scope

- Firebase development and production projects.
- Blaze billing plan with budget alerts.
- Regional Firestore and Functions in `us-west2`.
- Firebase Authentication:
  - Google sign-in
  - email/password registration and sign-in
  - email verification message, without blocking sync
  - password reset
  - sign-out
  - account deletion
- Optional guest mode backed by IndexedDB.
- Firestore-backed signed-in persistence for:
  - recipes
  - cooking history
  - AI preferences
  - chat sessions
  - dietary restrictions and notes
  - LLM provider and model selection
- Device-local, UID-scoped persistence for:
  - LLM API keys
  - OpenRouter OAuth keys
- Full signed-in offline reads and writes using Firestore persistent cache.
- No real-time listeners. Data refreshes at startup/sign-in, on focus, on
  reconnection, and after mutations.
- One-time, confirmed guest-data import with a read-only local recovery
  snapshot.
- Tested Firestore security rules.
- Callable Firebase Function for complete account deletion.
- Firebase Emulator Suite support.

### 3.2 Optional gated scope

After the core migration is stable:

- Move static PWA hosting from Cloudflare to Firebase Hosting.
- Move `/api/extract-recipe-url` from the Cloudflare Worker to a Firebase HTTP
  Function.
- Preserve the existing same-origin `/api/extract-recipe-url` client contract
  through a Firebase Hosting rewrite.
- Add App Check, distributed rate limiting, TTL cleanup, and billing controls
  for the public guest-compatible endpoint.

This optional phase requires an explicit go/no-go decision. It is not a core
release blocker.

### 3.3 Non-goals

- Firebase Storage/blob storage.
- Live cross-device updates or Firestore snapshot listeners.
- Merge-conflict UI or field-level conflict resolution.
- Social profiles, followers, public recipes, or sharing permissions.
- Syncing LLM API keys or OAuth keys.
- Migrating the LLM calls through a server.
- A general application API server.
- Chat-message subcollections in this migration.
- Data export UI.
- Apple, magic-link, phone, or anonymous Firebase authentication.

---

## 4. Product and behavior decisions

### 4.1 Entry and account UX

- On first launch, offer **Sign in** and **Continue as guest**.
- Remember a guest choice and do not repeatedly prompt.
- Add an Account section in Settings for sign-in, account status, sign-out,
  password reset, credential privacy messaging, and account deletion.
- Google sign-in should use a redirect flow for reliable mobile/PWA behavior.
- Email verification is sent but does not block cloud sync.
- A new device may restore provider/model and dietary settings, but chat remains
  unconfigured until the user enters a device-local API or OAuth key.
- Display: **“AI credentials are stored only on this device.”**

### 4.2 Storage selection

| Session state | Domain records | Non-secret settings | LLM/OAuth credentials |
| --- | --- | --- | --- |
| Guest | IndexedDB | IndexedDB | Guest-scoped IndexedDB |
| Signed in | Firestore | Firestore | UID-scoped IndexedDB |

Firestore's persistent cache—not the legacy IndexedDB repository—is the active
offline store for signed-in users.

### 4.3 Sign-out behavior

- Sign-out returns to an empty guest workspace.
- Cancel in-flight queries and mutations, clear React Query/tRPC caches, stop
  cloud access, clear Firestore disk persistence, and switch storage scope.
- Preserve the UID-scoped local LLM credential by default so signing back in on
  the same device does not require re-entry.
- Provide a separate **Remove account data from this device** action if needed.
- Account deletion always removes the UID-scoped credential.
- Sign-out requires connectivity. Before signing out, wait for pending Firestore
  writes so clearing persistence cannot discard offline changes. If offline,
  explain that the user must reconnect before signing out.

### 4.4 Sync semantics

- Firestore's commit behavior provides last-write-wins semantics.
- No merge-conflict detection or resolution is added.
- Whole documents are updated for current entities.
- Client-generated ISO `createdAt` and `updatedAt` fields remain for domain/UI
  compatibility. They are informational; Firestore commit order determines the
  winning write.
- Cross-device changes become visible on app startup, sign-in, focus, or
  reconnection—not instantly while both devices remain open.
- Chat messages remain an array on the chat-session document. Add a conservative
  serialized-size guard before Firestore's 1 MiB document limit and show a clear
  user error. Splitting messages into a subcollection is deferred.

---

## 5. Target architecture

### 5.1 Layering

Preserve the existing flow:

```text
Components -> Hooks -> in-browser tRPC -> StorageRepository
                                           |-> IndexedDB (guest)
                                           |-> Firestore (signed in)
```

Authentication is exposed through a dedicated React provider/hook. Components
must not call Firebase persistence APIs directly. Existing domain hooks continue
to call tRPC.

### 5.2 Proposed modules

Exact names may change during implementation, but responsibilities should stay
separate.

```text
src/
  auth/
    auth-context.ts
    AuthProvider.tsx
    useAuth.ts
  components/
    AuthChoiceView.tsx
    AccountSettings.tsx
  lib/
    firebase.ts                 Firebase app/auth/firestore lifecycle
  storage/
    firestore.ts                Generic Firestore StorageRepository
    scoped-repository.ts        Chooses guest or signed-in repository
    local-credentials.ts        UID/guest-scoped secrets only
    settings-repository.ts      Partitions and composes cloud/local settings
    guest-import.ts             Snapshot/import/verification workflow
    indexed-db.ts               Existing guest backend; schema version update
  types/
    auth.ts                     Zod-first app auth/migration state where needed
functions/
  src/
    index.ts
    delete-account.ts
```

### 5.3 Repository strategy

- Keep `StorageRepository<TEntity, TCreate, TUpdate>` as the domain boundary.
- Add a generic Firestore implementation using the existing entity builders and
  update functions.
- Add an auth-aware scoped repository that selects IndexedDB or Firestore for
  each call based on the settled auth state.
- Do not let a query run until Firebase Auth has restored its persisted session.
- Clear query caches whenever storage scope changes so guest and signed-in data
  cannot bleed into each other.
- Preserve stable UUID document IDs across import and sync.

### 5.4 Settings partition

The current `Settings` entity mixes synced preferences and secrets. The app may
continue exposing a composed `Settings` domain value, but persistence must split
it strictly:

**Firestore settings fields**

- `llmProvider`
- `llmModel`
- `dietaryRestrictions`
- `otherDietaryNotes`
- `createdAt`
- `updatedAt`

**Local-only settings fields**

- `llmApiKey`
- `openRouterOAuthKey`

Local credential records are keyed by Firebase UID, with a separate guest scope.
Firestore rules must whitelist settings fields and explicitly make it impossible
to write either secret field accidentally.

---

## 6. Firestore data model

```text
users/{uid}
  settings/app
  recipes/{recipeId}
  cookingLog/{entryId}
  aiPreferences/{preferenceId}
  chatSessions/{sessionId}
```

Notes:

- All current user data is private.
- Security rules allow access only when `request.auth.uid == uid`.
- No `ownerId` field is required inside every private document because ownership
  is encoded in the path.
- Future social features should introduce separate public/shared collections
  rather than weakening these private paths.
- No compound indexes are expected initially. Commit generated index
  configuration if emulator or production queries require it.

---

## 7. Guest import and recovery design

### 7.1 Trigger

After a user signs in, if active guest data exists and no import decision has
been recorded for that UID, ask once whether to import this device's Chefness
data.

- Accept: begin import while online.
- Decline: record the decision and do not prompt again automatically.
- No per-record collision handling is required. IDs are UUIDs and the initial
  legacy account is expected to be empty.

### 7.2 Import sequence

1. Require connectivity and a settled authenticated user.
2. Read all active guest stores.
3. Create a versioned, read-only IndexedDB recovery snapshot.
4. Partition settings:
   - upload non-secret settings to Firestore
   - copy credentials into the signed-in UID's local credential record
5. Upload records in bounded batches while preserving IDs and timestamps.
6. Wait for pending Firestore writes to be acknowledged by the server.
7. Read back IDs/counts for each collection and verify the expected import.
8. Mark the import complete for that UID.
9. Clear the active guest domain records.
10. Invalidate all domain queries and load the signed-in cloud workspace.

### 7.3 Failure and retry

- Never clear active guest data before server acknowledgement and verification.
- Keep the recovery snapshot on every failure.
- Make upload writes idempotent so an interrupted import can be retried.
- Record phase/status metadata, but do not mark complete until verification.
- Provide an actionable error and retry action.

### 7.4 Recovery snapshot lifecycle

- The snapshot is not queried during normal guest or signed-in operation.
- Retain it through at least one stabilization release.
- Add a later, explicit cleanup task after production verification.
- Document a developer-assisted restore procedure before deleting snapshots.

---

## 8. Security and privacy requirements

### 8.1 Firestore rules

Rules and emulator tests must prove:

- unauthenticated reads and writes are denied
- users can access only their own path
- cross-user reads, creates, updates, and deletes are denied
- settings permit only the approved synced fields
- `llmApiKey` and `openRouterOAuthKey` are rejected at any settings path
- basic field types and reasonable document-size constraints are enforced where
  practical
- unknown private collections are denied by default

### 8.2 Client safety

- Never log API keys, OAuth keys, Firebase ID tokens, password values, or full
  auth error objects that may contain credentials.
- Firebase web configuration is public configuration and belongs in Vite env
  variables; service-account credentials never enter the client bundle.
- Commit `.env.example`, Firebase rules, indexes, and emulator configuration.
- Keep actual `.env*`, service-account files, and local emulator data ignored.
- Clear domain caches on every auth transition.

### 8.3 Account deletion

Account deletion is online-only and destructive:

1. Ask for explicit confirmation.
2. Require recent reauthentication.
3. Call an authenticated callable Function.
4. Validate a recent `auth_time` in the Function.
5. Recursively delete `users/{uid}` and all known/future subcollections.
6. Delete the Firebase Auth user with Admin SDK.
7. Clear UID-scoped local credentials.
8. Clear Firestore persistence and React Query/tRPC caches.
9. Return to an empty guest workspace.

The Function must act only on the authenticated caller's UID.

---

## 9. Firebase environment setup

### 9.1 User-owned console/billing actions

- [ ] Create development Firebase project.
- [ ] Create production Firebase project.
- [ ] Upgrade both to Blaze as required.
- [ ] Add budget alerts before deploying Functions.
- [ ] Create regional Firestore databases in `us-west2`.
- [ ] Enable Google authentication.
- [ ] Enable email/password authentication.
- [ ] Configure support email and authorized domains.
- [ ] Register separate web apps/configurations for development and production.
- [ ] Review password policy and email templates.

### 9.2 Agent/repository actions

- [ ] Install Firebase client SDK and Firebase tooling/test dependencies.
- [ ] Initialize Firebase configuration without replacing unrelated app files.
- [ ] Configure project aliases for development and production.
- [ ] Configure Auth, Firestore, and Functions emulators.
- [ ] Add `.env.example` with all required `VITE_FIREBASE_*` names.
- [ ] Confirm production config is injected at build time and contains no
      privileged secrets.
- [ ] Add checked-in Firestore rules and indexes.
- [ ] Add Functions source/build/deploy configuration.

### 9.3 Environment policy

- Local development defaults to Firebase emulators when an explicit Vite env
  flag is enabled.
- Production builds must fail clearly if required Firebase client configuration
  is missing.
- Development and production data must never share a Firebase project.

---

## 10. Implementation phases and progress

### Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete and verified
- `[-]` Deferred or intentionally skipped

### Phase 0 — Baseline and documentation audit

**Goal:** Establish a trustworthy baseline before changing persistence.

- [x] Run and record current build and lint results (2026-07-09: both pass;
      existing Vite bundle-size warning remains).
- [ ] Manually inventory all current IndexedDB stores and settings fields.
- [ ] Confirm current guest CRUD and offline behavior.
- [ ] Reconcile stale current-state statements in `ARCHITECTURE.md`, `PRD.md`,
      and `README.md` without claiming Firebase is implemented yet.
- [ ] Record baseline test data for import verification.

**Verify:** Existing application builds, lint status is known, and current data
can be read before migration work begins.

### Phase 1 — Firebase projects, SDK bootstrap, and emulators

**Goal:** Connect the app safely to isolated Firebase environments.

- [ ] Complete Firebase Console setup in Section 9.
- [x] Add modular Firebase app/Auth initialization (Firestore initialization is
      deferred to Phase 3).
- [x] Initialize Firestore with persistent local cache and multi-tab support.
- [ ] Handle persistence initialization failure with an explicit fallback and
      warning; test Safari/private-mode behavior where practical.
- [x] Connect Auth and Firestore to emulators when enabled by environment.
- [ ] Scaffold Functions and callable emulator.
- [x] Add Firebase client environment validation and `.env.example`.
- [x] Add emulator configuration and passing Firestore rules smoke tests.

**Verify:** Development uses only emulator data; production build configuration
contains no Admin credentials; app bootstrap succeeds online and offline after a
prior successful load.

### Phase 2 — Authentication and account UI

**Goal:** Add optional accounts without disrupting guest use.

- [x] Define a provider-neutral auth context/hook with a browser-verified
      session-restoration loading state.
- [x] Replace the mock with Firebase Auth restoration and local persistence.
- [x] Gate the rendered application/domain queries until Auth restoration
      finishes.
- [x] Add first-launch Sign in / Continue as guest choice.
- [x] Persist the guest choice locally to avoid repeated prompts.
- [x] Wire Google control to Firebase redirect sign-in (manual provider/OAuth
      verification remains).
- [x] Wire email registration and sign-in to Firebase Auth.
- [x] Send real email verification without blocking access and provide status
      refresh UI.
- [x] Send real password-reset email with enumeration-safe success UI.
- [x] Add Account settings section and signed-in/guest identity displays.
- [x] Add accessible loading, success, and sanitized Firebase error states.
- [x] Add real Firebase Auth sign-out with confirmation and offline feedback.
- [ ] Add pending-write, Firestore-persistence, and query-cache orchestration to
      sign-out when cloud storage is connected.
- [ ] Clear query caches on real auth scope transitions.

**Verify:** Google and email/password flows work against emulators and configured
development Auth; guest mode remains fully usable; no user's cached domain data
appears in another scope.

### Phase 3 — Firestore repositories and settings partition

**Goal:** Route signed-in persistence to Firestore while retaining guest
IndexedDB behavior.

- [x] Implement generic Firestore `StorageRepository` CRUD.
- [x] Implement auth-aware guest/cloud repository selection.
- [x] Wire recipes to scoped persistence.
- [x] Wire cooking history to scoped persistence.
- [x] Wire AI preferences to scoped persistence.
- [x] Wire chat sessions to scoped persistence.
- [x] Add a 900 KB chat-session serialized-size guard below Firestore's 1 MiB limit.
- [x] Upgrade IndexedDB schema for UID-scoped local credentials.
- [x] Implement composed settings repository with strict cloud/local partition.
- [x] Preserve existing tRPC procedures and hook interfaces.
- [x] Enable refetch on focus and reconnect without snapshot listeners.
- [x] Keep mutation-driven cache invalidation.
- [x] Add sanitized, user-visible sync/storage errors.

**Verify:** Two browser profiles signed into the same account observe changes
after focus/reconnect; two different users cannot see each other's cached or
remote data; credentials remain local.

### Phase 4 — Guest import and recovery snapshot

**Goal:** Safely move current guest data into the first signed-in account.

- [x] Add migration metadata and versioned recovery-snapshot storage.
- [x] Detect production guest-import eligibility once per Firebase UID.
- [x] Add browser-verified one-time import confirmation, progress, success, and
      decline UI states.
- [x] Implement settings partition during import.
- [x] Upload all selected entities with stable IDs/timestamps in bounded batches.
- [x] Wait for server acknowledgement.
- [x] Verify imported IDs and counts from the server.
- [x] Clear active guest records only after verification.
- [x] Persist declined/completed decisions per Firebase UID.
- [x] Keep writes retry-safe and reuse one recovery snapshot across retries.
- [ ] Document and test a developer-assisted restore from the read-only snapshot.

**Verify:** Successful import is complete and idempotent; simulated upload
failure leaves guest data intact; sign-out after import opens an empty guest
workspace; signed-in offline access comes from Firestore cache.

### Phase 5 — Rules, account deletion, and security tests

**Goal:** Enforce isolation independently of client correctness.

- [x] Write deny-by-default Firestore rules.
- [x] Add ownership rules for all user paths.
- [x] Whitelist cloud settings fields and reject secret fields.
- [x] Add Firebase Rules Unit Testing setup.
- [x] Test unauthenticated denial.
- [x] Test cross-user denial for every operation.
- [x] Test same-user allowed operations.
- [x] Test secret-field rejection.
- [x] Deploy compiled rules and indexes to `chefness-dev`.
- [x] Live-smoke own CRUD plus cross-user and secret-field denial with a
      disposable account, then verify cleanup.
- [ ] Implement callable recursive account-deletion Function.
- [ ] Enforce authenticated caller and recent auth time.
- [x] Implement reauthentication and typed destructive confirmation UI using
      Firebase Auth credentials/providers.
- [-] Temporary client-only Auth deletion was disabled when Firestore was wired.
- [ ] Connect the callable recursive deletion Function before enabling the
      account-deletion control.
- [ ] Clear Auth, local credentials, Firestore persistence, and query caches
      after deletion.

**Verify:** Emulator tests prove isolation; account deletion leaves no Auth user,
Firestore documents, UID credentials, or user-visible cached cloud data.

### Phase 6 — Offline, cross-device, and regression hardening

**Goal:** Prove the agreed behavior under realistic failure modes.

- [ ] Unit-test settings partitioning.
- [ ] Unit-test storage-scope selection.
- [ ] Unit-test migration state transitions and retry behavior.
- [ ] Add Firestore emulator repository integration tests.
- [ ] Test create/update/delete while offline and sync after reconnect.
- [ ] Test app restart while offline after prior signed-in use.
- [ ] Test last-write-wins behavior from two browser profiles.
- [x] Verify imported Firestore data and device-local credential isolation across
      two signed-in emulator browser profiles.
- [ ] Test auth redirect behavior in browser and installed PWA.
- [ ] Test sign-out blocking/feedback while offline.
- [ ] Test unavailable/denied/quota error messaging.
- [ ] Run full existing feature regression: chat, imports, recipes, history,
      preferences, settings, and sessions.
- [ ] Run lint and production build.

**Verify:** Every core completion criterion in Section 12 passes.

### Phase 7 — Core release and documentation

**Goal:** Deploy the core migration without changing hosting platforms.

- [ ] Deploy production Firestore rules and indexes.
- [ ] Deploy account-deletion Function.
- [ ] Configure production authorized domains for the existing deployment.
- [ ] Perform production smoke tests with a test account.
- [ ] Import the existing legacy user's data and verify counts/content.
- [ ] Update `ARCHITECTURE.md` for hybrid IndexedDB/Firestore persistence.
- [ ] Update `PRD.md` for accounts, sync, backup, offline semantics, and status.
- [ ] Update `README.md` setup, architecture, privacy, and deployment sections.
- [ ] Record rollback steps and stabilization observations.
- [ ] Retain recovery snapshots through the stabilization period.

**Verify:** Core migration runs in production on existing Cloudflare hosting and
all release blockers pass.

### Phase 8 — Optional Firebase Hosting and recipe Function migration

**Gate:** Start only after an explicit go decision following core stabilization.

- [ ] Reassess whether platform consolidation is still valuable.
- [ ] Port recipe extraction to an HTTP Firebase Function without behavior
      changes.
- [ ] Preserve timeout, redirect, content type, response-size, and private-host
      protections.
- [ ] Add App Check for the web client/function where practical.
- [ ] Add Firestore-backed distributed limits:
      - 10 requests/minute per client/IP
      - 100 requests/day per client/IP
- [ ] Hash/minimize rate-limit identifiers and configure TTL cleanup.
- [ ] Ensure rate-limit data is server-only and inaccessible to clients.
- [ ] Configure billing alerts and review expected invocation/Firestore costs.
- [ ] Add emulator and integration tests for extraction and limiting.
- [x] Configure Firebase Hosting static assets, SPA fallback, and no-cache
      service-worker header for temporary previews.
- [ ] Configure `/api/extract-recipe-url` Function rewrite.
- [ ] Remove Cloudflare Vite/Wrangler integration only after Firebase preview
      succeeds.
- [x] Deploy seven-day `temporary` Firebase preview channel.
- [x] Verify preview HTML, JS, CSS, manifest, icons, and service-worker
      registration at 375 px with no page/console errors.
- [ ] Test installed PWA updates and OpenRouter OAuth callbacks.
- [ ] If purchasing `chefness.app`, configure DNS and Firebase Auth authorized
      domains; downtime is acceptable for the initial migration.
- [ ] Cut over hosting.
- [ ] Remove obsolete Cloudflare configuration after rollback window expires.
- [ ] Update architecture, PRD, README, and deployment commands.

**Verify:** Static PWA, OAuth callbacks, offline service worker, and same-origin
recipe extraction all work on Firebase Hosting; Cloudflare is no longer needed.

---

## 11. Manual verification matrix

| Scenario | Expected result | Status |
| --- | --- | --- |
| First launch, choose guest | Empty IndexedDB workspace; no repeat prompt | [ ] |
| Guest offline CRUD | Existing non-AI behavior works | [ ] |
| Google sign-in | Account loads correct cloud workspace | [ ] |
| Email registration/sign-in | Account created; verification sent; sync allowed | [ ] |
| Password reset | Sanitized success state regardless of account enumeration concerns | [ ] |
| Guest import accepted | Snapshot, upload, verification, guest clear | [ ] |
| Guest import interrupted | Guest data retained; retry succeeds | [ ] |
| New device sign-in | Cloud data restored; local API key requested | [ ] |
| Signed-in offline restart | Cached data loads after prior online use | [ ] |
| Signed-in offline mutation | UI updates; write syncs after reconnect | [ ] |
| Second device refresh/focus | Sees committed changes without live listener | [ ] |
| Concurrent edit | Last committed write wins; no conflict UI | [ ] |
| Cross-user access attempt | Denied by Firestore rules | [ ] |
| Secret-field Firestore write | Denied by rules/tests | [ ] |
| Sign out online | Writes flush; cloud cache clears; empty guest opens | [ ] |
| Sign out offline | Blocked with clear reconnect message | [ ] |
| Sign back in on same device | UID-local API key remains available | [ ] |
| Delete account | Auth, Firestore, local credential, and cache removed | [ ] |
| Long chat approaches limit | Save blocked safely with clear message | [ ] |
| Existing recipe URL import | Continues working through current Cloudflare endpoint | [ ] |

---

## 12. Core completion criteria

The core migration is complete only when all are true:

- [ ] Guest mode behaves as it does today.
- [ ] Google and email/password authentication work.
- [ ] Selected non-secret data syncs across two browsers/devices.
- [ ] LLM and OAuth credentials never appear in Firestore or logs.
- [ ] Signed-in reads and writes work offline and sync after reconnection.
- [ ] Confirmed guest import is idempotent and recoverable.
- [ ] Cross-user Firestore access is denied by automated rule tests.
- [ ] Sign-out returns to an empty guest workspace and clears cloud caches.
- [ ] Account deletion removes Auth, Firestore data, local credentials, and
      cache.
- [ ] Existing app features continue working.
- [ ] Lint, build, unit tests, repository tests, and security-rule tests pass.
- [ ] `ARCHITECTURE.md`, `PRD.md`, and `README.md` describe the shipped behavior.

---

## 13. Rollback strategy

Before core release:

- Keep the existing IndexedDB implementation intact and selectable.
- Keep Cloudflare hosting and extraction unchanged.
- Retain the local guest recovery snapshot.
- Deploy Firestore rules before enabling signed-in cloud CRUD.

If the cloud migration fails during rollout:

1. Disable account/cloud entry points in the client configuration or redeploy
   the prior build.
2. Restore guest IndexedDB mode.
3. Do not delete Firestore data automatically.
4. Restore the guest workspace from the recovery snapshot if active guest data
   was already cleared.
5. Diagnose against the development project/emulators before retrying.

Account deletion is irreversible and is not covered by rollback.

---

## 14. Progress log

Add one entry after each meaningful implementation session.

| Date | Phase | Work completed | Verification | Blockers/next step |
| --- | --- | --- | --- | --- |
| 2026-07-09 | Planning | Scope and architecture decisions agreed; plan created | User decisions captured | Begin Phase 0 after approval |
| 2026-07-09 | UI mock | Added mock-backed onboarding, auth forms, Account settings, import states, verification, sign-out, device cleanup, and deletion UI | Lint/build pass; mobile browser flows and screenshots verified with no page errors | Firebase/Auth/Firestore wiring remains intentionally unstarted |
| 2026-07-09 | Firebase Auth | Replaced mock auth with Firebase SDK; added env validation, persistent restoration, Google redirect, email auth, verification/reset, sign-out, reauthentication, and Auth-user deletion | Lint/build pass; Firebase invalid-credential request and sanitized UI error verified in headed browser | Enable/verify Google provider manually |
| 2026-07-09 | Firestore | Added hybrid repositories, offline cache, secret settings partition, verified guest import/recovery, rules/config, and emulator tests | 6 rules tests pass; imported recipe restored in two browser profiles; API key remained only on originating device; no captured React errors after fix | Deploy rules after CLI authentication |
| 2026-07-09 | Firestore dev deploy | Released tested rules/indexes to `chefness-dev` and ran disposable live smoke test | Own CRUD passed; cross-user and secret-settings writes returned 403; test document and Auth user deleted | Continue offline hardening and trusted account cleanup |
| 2026-07-09 | Temporary Hosting | Added Firebase static Hosting config and deployed seven-day `temporary` preview | Preview assets and service worker returned 200 at 375 px; no page or console errors | Recipe URL endpoint intentionally unavailable; no production cutover |

---

## 15. Decision log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-07-09 | Use Cloud Firestore, not Firebase Storage | Current data is structured CRUD data, not blobs |
| 2026-07-09 | Google and email/password auth | Useful coverage without Apple/magic-link complexity |
| 2026-07-09 | Keep optional IndexedDB guest mode | Preserve low-friction and offline-first use |
| 2026-07-09 | Firestore for signed-in users | Enables backup and cross-device sync |
| 2026-07-09 | Never sync LLM/OAuth credentials | Minimize secret exposure; credentials remain device-local |
| 2026-07-09 | Scope local credentials by UID | Prevent credential leakage on shared devices |
| 2026-07-09 | Preserve full offline behavior | Core Chefness product principle |
| 2026-07-09 | No real-time listeners | Cross-device refresh on focus/reconnect is sufficient |
| 2026-07-09 | Last write wins | Conflict resolution is explicitly out of scope |
| 2026-07-09 | Use user subcollections | Simple private ownership and security rules |
| 2026-07-09 | No social schema yet | Avoid speculative design |
| 2026-07-09 | Keep whole chat session documents | Avoid unrelated chat persistence redesign; guard size |
| 2026-07-09 | Ask once before guest import | User controls migration |
| 2026-07-09 | Retain read-only legacy snapshot temporarily | Supports rollback without creating a second active store |
| 2026-07-09 | Callable Function for account deletion | Reliable privileged recursive cleanup |
| 2026-07-09 | Use separate dev/prod projects and emulators | Prevent accidental production data access |
| 2026-07-09 | Use `us-west2` | Initial users are on the U.S. West Coast |
| 2026-07-09 | Keep Cloudflare migration optional | Prevent deployment work from blocking auth/sync value |
