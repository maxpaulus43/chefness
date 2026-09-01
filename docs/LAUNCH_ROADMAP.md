# Chefness App Store Launch Roadmap

> **Goal:** Publish Chefness 1.0 on the Apple App Store as a **$0.99 paid app**.
>
> **Domain:** [chefness.org](https://chefness.org) (registered; DNS managed with Cloudflare)
>
> This checklist is ordered roughly by dependency. Items under **Launch blockers** must be complete before App Review submission.

## Progress legend

- [ ] Not started
- [x] Complete

---

## 0. Launch decisions

- [x] Decide whether version 1 supports iPhone only or both iPhone and iPad.
  - **Decision:** Chefness 1.0 is iPhone-only. iPad support may be added in a later release.
  - Configuration has `ios.supportsTablet: false`.
- [x] Decide whether anonymous product analytics will ship in 1.0.
  - **Decision:** Chefness 1.0 will use Sentry crash/error reporting only. Product analytics such as PostHog are deferred.
- [x] Decide whether users can opt out of nonessential analytics in Settings.
  - **Decision:** Not applicable to 1.0 because no nonessential product analytics will ship. Revisit the opt-out requirement before adding product analytics.
- [x] Decide whether releases will be built and submitted with Xcode or EAS Build.
  - **Decision:** Use Xcode for the initial 1.0 release. Reconsider EAS Build when repeatable cloud builds or CI become valuable.
- [x] Decide whether the App Store seller name should be a personal legal name or company name before enrolling/configuring the Apple Developer account.
  - **Decision:** Use the existing Individual Apple Developer account (Team ID `WNCJFCHP22`). The public seller name will be the legal personal name associated with that membership.

---

# Launch blockers

## 1. Domain, website, and support email

- [x] Register `chefness.org`.
- [x] Add `chefness.org` to Cloudflare DNS and confirm the zone is active.
  - Verified authoritative nameservers: `nash.ns.cloudflare.com` and `jillian.ns.cloudflare.com`.
- [x] Publish a basic landing page at `https://chefness.org`.
  - **Decision:** Use a dedicated static marketing site at the root domain; do not expose the retained PWA as the 1.0 marketing site.
  - Source lives in `website/` and deploys as the separate Cloudflare Pages project `chefness-site`.
  - Verified public Cloudflare DNS, HTTPS certificate, HTTP 200 response, and expected production content.
- [x] Publish a support page at `https://chefness.org/support`.
  - Includes OpenRouter connection instructions, connectivity/import troubleshooting, local-functionality recovery guidance, data-loss warning before reinstalling, and email actions for `support@chefness.org`.
  - Verified HTTPS, HTTP 200 response, expected production content, and landing-page links.
- [x] Publish a privacy policy at `https://chefness.org/privacy`.
  - Published for the current pre-Sentry app behavior. Re-review and update before enabling Sentry or any other telemetry.
- [x] Configure `support@chefness.org` to forward to the owner's email.
  - Cloudflare Email Routing is enabled and ready. The verified `support@chefness.org` rule forwards to the owner's dedicated Gmail alias; catch-all routing is disabled.
- [x] Verify that a message sent to `support@chefness.org` reaches the destination inbox.
  - Verified with a message from an unrelated account; it reached the destination inbox and did not land in spam.
- [ ] Configure a provider that can send replies **from** `support@chefness.org`.
  - **Selected provider:** Google Workspace. Keep Cloudflare Email Routing active until the Workspace account is verified and ready for the MX cutover.
- [ ] Configure and verify email DNS records.
  - [ ] MX
  - [ ] SPF
  - [ ] DKIM, if supported by the outbound mail provider
  - [ ] DMARC
- [ ] Test sending and receiving from an unrelated email account and confirm messages do not land in spam.

## 2. Apple Developer and App Store Connect

- [x] Confirm active Apple Developer Program membership.
  - Existing paid Individual membership is active for Team ID `WNCJFCHP22`.
- [x] Confirm the correct legal entity and seller name.
  - Confirmed the Individual membership's displayed legal name is the intended public seller name.
- [x] Accept the latest Apple Developer agreements.
  - Confirmed no pending general developer agreement.
- [x] Accept the Paid Apps Agreement in App Store Connect.
  - Confirmed active in App Store Connect.
- [x] Complete tax forms in App Store Connect.
  - Confirmed complete and active.
- [x] Complete banking information in App Store Connect.
  - Confirmed complete and active.
- [x] Confirm or register the main App ID for `com.maxpaulus.chefness`.
  - Confirmed registered under Team ID `WNCJFCHP22`.
- [x] Confirm or register the share-extension App ID for `com.maxpaulus.chefness.ShareExtension`.
  - Confirmed registered under Team ID `WNCJFCHP22`.
- [x] Confirm required capabilities and entitlements for both identifiers.
  - [x] Main app Keychain access group
  - [x] App Group `group.com.maxpaulus.chefness` registered and assigned to both App IDs
  - [x] Share extension target is associated with and embedded in the main app
  - [x] URL scheme/deep links used by the extension
- [x] Create the Chefness app record in App Store Connect.
  - [x] Platform: iOS
  - [x] Bundle ID: `com.maxpaulus.chefness`
  - [x] SKU configured
  - [x] Primary language configured
  - App Store Connect name: **Chefness!** (`Chefness` was unavailable).
- [x] Create or verify an Apple Distribution certificate.
  - Valid `Apple Distribution: Max Paulus (WNCJFCHP22)` identity is installed in the login Keychain.
- [x] Create or verify App Store distribution provisioning profiles for the main app and share extension, or configure automatic signing to manage them.
  - Automatic signing is configured for Team `WNCJFCHP22`; Xcode has generated/downloaded provisioning profiles for both exact App IDs.
- [ ] Verify Release signing for both the main app and share extension in Xcode.
  - Target team, bundle IDs, and entitlements resolve correctly. Final Apple Distribution signing will be verified from an Archive.

## 3. App identity and release configuration

- [x] Confirm the final public App Store name is **Chefness!**.
  - `Chefness` was unavailable in App Store Connect. The installed app display name remains **Chefness**.
- [x] Confirm bundle identifier `com.maxpaulus.chefness` is final.
- [x] Confirm marketing version `1.0.0`.
- [x] Establish an incrementing iOS build-number process; every uploaded build must use a new number.
  - `expo.ios.buildNumber` in `app.json` is the source of truth. Increment its integer value before every App Store Connect upload, then run a clean iOS prebuild before archiving.
- [x] Ensure the main app and share extension use compatible version and build numbers.
  - Expo/share-extension prebuild resolves both bundles to marketing version `1.0.0` and build `1`; future uploads follow the shared `app.json` version/build values.
- [x] Make the iPad support decision from section 0 and update `app.json` accordingly.
- [x] Confirm the minimum iOS version is intentional (`16.4`).
  - iOS 16.4 is the intentional minimum for Chefness 1.0 and matches Expo 57's supported minimum.
- [x] Confirm orientation support is intentional (`portrait`).
  - Chefness 1.0 supports portrait orientations only; landscape is intentionally excluded.
- [ ] If using EAS Build:
  - [ ] Create an Expo project and record its project ID.
  - [ ] Add `eas.json` with development, preview/TestFlight, and production profiles.
  - [ ] Add an App Store submit profile.
  - [ ] Configure credentials and build-number management.
- [x] If using Xcode:
  - [x] Document the Archive → Validate → Distribute workflow for maintainers.
    - See `docs/XCODE_RELEASE_RUNBOOK.md`.

## 4. App icon, screenshots, and listing assets

- [x] Create a production-quality **1024×1024 opaque PNG** App Store icon.
  - Source: `public/pwa-1024x1024.png`; verified 1024×1024 RGB PNG with no alpha and no baked-in rounded outer corners.
- [x] Update `app.json` to use the production icon.
- [x] Regenerate the native project and verify all generated icon sizes.
  - Expo generated the modern universal iOS `AppIcon` entry as an identical opaque 1024×1024 RGB PNG.
- [x] Verify the icon on light and dark Home Screen backgrounds.
  - Confirmed recognizable, unclipped, and visually acceptable on both backgrounds.
- [ ] Create App Store screenshots for every supported device class.
  - Draft captures are in `~/Desktop/chefness-screenshots`. Audit: all are 1206×2622 (6.3-inch) RGBA PNGs, so they are not yet a valid primary App Store Connect set. Recapture/export as a 6.9-inch or 6.5-inch set and remove the alpha channel.
  - [ ] AI cooking chat
  - [ ] Recipe import/share extension
  - [ ] Saved recipe collection and recipe detail
  - [ ] Cooking history
  - [ ] Dietary restrictions and AI memory
- [x] If iPad support remains enabled, create required iPad screenshots and test layouts at relevant multitasking sizes.
  - Not applicable to the iPhone-only 1.0 release.
- [ ] Prepare optional promotional artwork if desired.
  - Deferred; not required for 1.0.

## 5. Sentry crash reporting

- [ ] Create a Sentry organization/project for Chefness iOS.
- [ ] Install and configure the official Sentry React Native/Expo SDK.
- [ ] Keep the Sentry DSN and upload credentials out of source control.
  - A DSN is designed to be present in the client, but should still be environment-configured.
  - The Sentry auth token used for source-map uploads must remain secret.
- [ ] Initialize Sentry before the app UI mounts.
- [ ] Tag events with:
  - [ ] App semantic version
  - [ ] Build number
  - [ ] Environment (`development`, `testflight`, `production`)
- [ ] Configure JavaScript source-map uploads for Release builds.
- [ ] Configure native debug-symbol/dSYM uploads for Release builds.
- [ ] Add conservative performance tracing only if it provides immediate value.
- [ ] Disable Sentry Session Replay and screenshots for 1.0 unless a separate privacy review approves them.
- [ ] Add `beforeSend` scrubbing and tests to ensure Sentry never receives:
  - [ ] OpenRouter OAuth keys or authorization codes
  - [ ] Chat prompts or assistant responses
  - [ ] Attached photos or local photo URIs
  - [ ] Saved recipe contents
  - [ ] Dietary restrictions
  - [ ] AI memories/preferences
  - [ ] Imported recipe URLs
  - [ ] Support email addresses or feedback text, unless explicitly submitted for that purpose
- [ ] Ensure network request headers such as `Authorization` are not captured.
- [ ] Add a safe internal test action or controlled test build that throws a test error.
- [ ] Verify a TestFlight/Release crash arrives in Sentry with readable symbols and source maps.
- [ ] Document Sentry retention and deletion settings in the privacy policy.

## 6. Privacy-conscious product telemetry — deferred from 1.0

Chefness 1.0 does not include product analytics. The unchecked tasks below are retained for reconsideration in a later release; they are not launch blockers for 1.0.

- [ ] Select an analytics provider (recommended candidate: PostHog).
- [ ] Create separate development and production projects/environments.
- [ ] Use a random installation ID; do not use IDFA or another advertising identifier.
- [ ] Do not add App Tracking Transparency unless the implementation actually tracks users across companies' apps or websites.
- [ ] Define a small, reviewed event schema. Candidate events:
  - [ ] `app_opened`
  - [ ] `openrouter_connected`
  - [ ] `openrouter_connection_failed`
  - [ ] `chat_started`
  - [ ] `chat_response_completed`
  - [ ] `chat_response_failed`
  - [ ] `recipe_saved`
  - [ ] `recipe_imported`
  - [ ] `meal_logged`
  - [ ] `feedback_opened`
- [ ] Limit event properties to non-sensitive operational data, such as:
  - [ ] App version/build
  - [ ] iOS version
  - [ ] Broad device class
  - [ ] Operation duration
  - [ ] Error category, not raw error text when it may contain content
  - [ ] Whether the selected model supports vision/tools
  - [ ] Recipe import source (`share_extension` or `pasted_url`)
- [ ] Prohibit all user-generated content from analytics properties.
- [ ] Prohibit model prompts, responses, recipe text, dietary data, preferences, photos, URLs, credentials, and email addresses.
- [ ] Add a Settings toggle if analytics opt-out is part of the launch decision.
- [ ] Ensure analytics honors the toggle before the first nonessential event is sent.
- [ ] Verify events in a Release/TestFlight build.
- [ ] Verify sensitive values are absent from analytics payloads using a network inspection or provider event debugger.
- [ ] Document provider, purpose, retention, and opt-out behavior in the privacy policy.

## 7. In-app Help & Feedback

- [x] Add a **Help & Feedback** section to native Settings.
- [x] Add **Send Feedback**.
  - Open a mail composer or `mailto:support@chefness.org`.
  - Prefill a useful subject.
  - Include app version, build number, iOS version, and device model only when appropriate.
  - Keep the user's feedback text editable.
- [x] Add **Report a Problem**.
  - Do not automatically attach logs, chats, photos, recipes, preferences, URLs, or credentials.
  - If diagnostics are ever attached, show exactly what will be sent and require confirmation.
- [x] Add **Email Support** using `support@chefness.org`.
- [x] Add an external **Support Website** link to `https://chefness.org/support` as a fallback when Mail is not configured.
- [x] Add a **Privacy Policy** link to `https://chefness.org/privacy`.
- [x] Display app version and build number in Settings.
- [x] Handle devices without a configured email account gracefully.
- [x] Add equivalent support/privacy links to the retained web app if it remains publicly available.
- [ ] Test all support links on a physical iPhone.

## 8. Privacy policy, disclosures, and legal review

- [x] Write and publish the Chefness privacy policy.
- [x] Explain that recipes, chat sessions, cooking history, preferences, settings, and credentials are stored on-device.
- [x] Explain what is sent to OpenRouter when users invoke AI features, including prompts, relevant context, and user-selected images.
- [x] Explain OpenRouter's role as an independent third-party service and link to its privacy terms.
- [ ] Explain what Sentry collects and why.
  - Deferred until Sentry is implemented; the current published policy intentionally contains no Sentry language.
- [ ] Explain what the analytics provider collects and why, if enabled.
- [ ] State retention periods or link to provider retention terms.
- [x] Explain how users can remove local Chefness data.
- [x] Provide `support@chefness.org` for privacy requests.
- [x] Add an AI/food-safety disclaimer.
  - [x] AI output can be incorrect.
  - [x] Users must independently verify allergens, food safety, internal temperatures, and dietary suitability.
- [ ] Review third-party SDK privacy manifests and required-reason API declarations.
- [ ] Regenerate iOS native files after dependency/config changes and inspect the merged `PrivacyInfo.xcprivacy`.
- [ ] Ensure the privacy manifest and App Store privacy answers match actual runtime behavior after Sentry/analytics integration.
- [ ] Complete App Store Connect **App Privacy** answers accurately.
  - Review likely categories including diagnostics, product interaction, identifiers, and user content.
  - Do not claim “Data Not Collected” after adding telemetry without verifying Apple's definitions and provider behavior.
- [ ] Complete export-compliance questions for the app's use of standard encryption/HTTPS.
- [ ] Complete content-rights questions.
- [ ] Complete age-rating questionnaire.
- [ ] Complete EU Digital Services Act trader-status requirements if distributing in the EU.
  - Status: In Review in App Store Connect.
- [ ] Confirm all third-party licenses and terms permit commercial App Store distribution.

## 9. App Store pricing and availability

- [x] In App Store Connect, set the United States storefront price point to **$0.99 USD**.
- [x] Review Apple's automatically generated prices for other storefronts.
- [x] Select countries and regions where Chefness will be available.
- [ ] Consider enrollment in the App Store Small Business Program if eligible.
- [x] Confirm the app description clearly explains that AI features require an OpenRouter account.
- [x] Clearly disclose that OpenRouter usage charges may apply depending on the selected model and that free models may be available.
- [ ] Confirm no StoreKit implementation is needed; Chefness is an upfront paid download, not an in-app purchase.

## 10. App Store listing metadata

- [x] Finalize app name.
  - App Store listing: **Chefness!**; installed app display name: **Chefness**.
- [x] Write a subtitle (candidate: **Your personal AI cooking companion**).
- [x] Write promotional text.
- [x] Write the full App Store description.
- [x] Select keywords.
- [x] Select primary category (recommended: **Food & Drink**).
- [x] Select a secondary category if useful.
- [x] Add support URL: `https://chefness.org/support`.
- [x] Add privacy policy URL: `https://chefness.org/privacy`.
- [x] Add marketing URL: `https://chefness.org`.
- [x] Add copyright text.
- [x] Upload screenshots in the correct order and sizes.
- [x] Review every claim in the listing against the shipping build.
- [x] Proofread metadata on both desktop and mobile App Store previews.

## 11. Share extension release hardening

- [x] Regenerate iOS native files from committed Expo configuration.
- [x] Build the main app and share extension in Release configuration.
- [x] Verify Chefness appears in Safari's share sheet for a single web URL.
- [ ] Verify the extension opens the host app and imports the shared recipe URL.
- [ ] Verify repeated deep links do not import the same share twice.
- [ ] Verify Cancel exits without modifying user data.
- [ ] Test extension behavior when Chefness has never been launched.
- [ ] Test extension behavior when Chefness is already running.
- [ ] Test extension behavior while offline.
- [ ] Test an unsupported recipe site and confirm a clear error.
- [ ] Investigate Expo Doctor's warning that `expo-share-extension` is untested on React Native's New Architecture.
- [ ] Decide whether the beta dependency is acceptable for 1.0 based on physical-device Release testing.
- [ ] If it is not reliable, remove the share extension from 1.0 rather than delaying or destabilizing the core app.

## 12. Functional and release testing

### Automated/project checks

- [x] `bun install`
- [x] `bun run lint`
- [x] `bun run typecheck:native`
- [x] `bun run test`
- [ ] `bunx expo-doctor`
  - Current known warning: `expo-share-extension` is reported as untested with the New Architecture.
- [ ] `bunx expo export --platform ios --output-dir /tmp/chefness-expo`
- [ ] `bun run build` for the retained web target.

### Release-build checks

- [x] Produce an archived Release build without Metro.
- [x] Validate the archive in Xcode/App Store Connect.
- [x] Confirm app version and build number.
- [x] Confirm Release signing for both targets.
- [ ] Confirm the production icon has no alpha and renders correctly.
- [ ] Confirm Sentry source maps and symbols are uploaded.
- [ ] Confirm production environment variables contain no development credentials or endpoints.
- [ ] Confirm no secret upload tokens are embedded in the app bundle.

### Device matrix

- [x] Test on the smallest supported iPhone layout.
- [x] Test on a modern notched/Dynamic Island iPhone.
- [ ] Test on at least one physical device running the oldest supported iOS version, if available.
- [ ] If tablet support remains enabled, test representative iPads and Split View sizes.
- [ ] Verify Dynamic Type at larger accessibility sizes.
- [ ] Verify VoiceOver labels and navigation for launch-critical flows.
- [ ] Verify increased contrast and reduced transparency behavior.

### Core user journeys

- [ ] Fresh install with no saved data.
- [ ] Upgrade from an earlier development/TestFlight build with existing local data.
- [ ] OpenRouter connect and disconnect.
- [ ] Invalid, expired, or rejected OpenRouter authorization.
- [ ] Select both free and paid OpenRouter models.
- [ ] Start, persist, reopen, edit, and delete chat sessions.
- [ ] Stream an AI response and interrupt/retry an error.
- [ ] Attach a camera photo.
- [ ] Attach a photo-library image.
- [ ] Deny camera permission and recover gracefully.
- [ ] Deny photo-library permission and recover gracefully.
- [ ] Import a recipe by pasted URL.
- [ ] Import a recipe through the share extension.
- [ ] Save, edit, share, search, and delete a recipe.
- [ ] Log, edit, rate, and delete a cooked meal.
- [ ] Add and remove dietary restrictions and AI memories.
- [ ] Verify all non-AI local features remain usable offline.
- [ ] Verify AI and remote import failures are clear while offline.
- [ ] Verify local data deletion behavior.
- [ ] Verify support email and website links.
- [ ] Verify telemetry opt-out behavior, if present.
- [ ] Verify a controlled Sentry error arrives symbolicated.

## 13. TestFlight

- [x] Upload the first candidate build to App Store Connect.
- [x] Wait for build processing and resolve any validation warnings.
- [x] Complete TestFlight export-compliance information.
- [x] Add internal testers.
- [x] Run the complete smoke-test checklist on the TestFlight build.
- [x] Add a small external beta group if useful.
- [x] Provide beta testing notes and a reliable OpenRouter test path.
- [x] Collect and triage feedback.
- [ ] Fix all release-blocking crashes, data-loss bugs, broken onboarding, signing issues, and share-extension failures.
- [ ] Upload a new build with an incremented build number after every fix.
- [ ] Select the final stable build for App Review.

## 14. App Review submission

- [x] Complete all required App Store Connect metadata and compliance sections.
- [x] Attach the final TestFlight/App Store build to version 1.0.
- [x] Prepare App Review notes explaining:
  - [x] How to connect OpenRouter
  - [x] How to select a free model
  - [x] How to start a chat
  - [x] How to import a recipe
  - [x] How to test the Safari share extension
  - [x] Where Chefness stores local data
  - [x] How to disconnect OpenRouter
- [ ] Provide a reliable review test account or test path where OpenRouter permits it.
  - Reviewers should not need to create or fund a personal account to evaluate the core functionality of a paid app.
- [ ] Confirm review notes explain any feature that is unavailable without internet access.
- [ ] Choose manual, automatic, or phased release behavior.
- [ ] Submit version 1.0 for App Review.
- [ ] Monitor App Store Connect and respond promptly to reviewer questions.
- [ ] If rejected, record the guideline, remediation, and response in this document or a linked issue.

---

# Post-approval and launch

## 15. Release day

- [x] Confirm `chefness.org`, `/support`, and `/privacy` are live over HTTPS.
- [x] Confirm `support@chefness.org` is monitored.
- [ ] Confirm Sentry production alerts are enabled and routed appropriately.
- [ ] Confirm analytics dashboards are receiving only approved events, if enabled.
- [ ] Release the app according to the selected release mode.
- [ ] Verify the public App Store page, screenshots, price, and links.
- [ ] Purchase/download the public app from a normal customer account if practical and run a smoke test.
- [ ] Publish a launch announcement.

## 16. First-week monitoring

- [ ] Review crashes daily.
- [ ] Review support messages daily.
- [ ] Review App Store reviews and ratings.
- [ ] Watch onboarding and OpenRouter connection failure rates, if analytics is enabled.
- [ ] Watch recipe import and share-extension failure rates.
- [ ] Prioritize hotfixes for crashes, data loss, credential leakage, broken purchases/downloads, or unusable onboarding.
- [ ] Increment the build number and repeat Release/TestFlight checks for any hotfix.

## 17. After launch

- [ ] Add an in-app **What's New** or release-notes workflow if releases become frequent.
- [ ] Add data export/import if customer demand supports it.
- [ ] Consider a user-visible **Delete All Local Data** action if one is not included in 1.0.
- [ ] Review privacy policy and App Store privacy answers whenever telemetry, SDKs, or data flows change.
- [ ] Review Sentry and analytics retention quarterly.
- [ ] Renew `chefness.org` automatically and verify registrar contact/payment details.
- [ ] Maintain a tested release runbook for future App Store versions.

---

## Definition of launch-ready

Chefness is ready to submit only when:

- [x] The paid-app agreements, tax, banking, signing, and App Store record are complete.
- [x] The support site, privacy policy, and support email work publicly.
- [x] The 1024×1024 opaque icon and all required screenshots are ready.
- [ ] Sentry is privacy-scrubbed and verified in a Release/TestFlight build.
- [ ] Any product analytics is minimal, disclosed, and verified not to contain user content.
- [ ] In-app feedback and support links work on a physical iPhone.
- [ ] App privacy disclosures match the actual app and third-party SDK behavior.
- [ ] The final Release build passes automated checks and the device smoke-test matrix.
- [ ] The share extension is proven reliable in Release builds or intentionally removed from 1.0.
- [ ] A stable TestFlight build has completed beta testing.
- [ ] App Store pricing is set to the US $0.99 price point.
- [ ] App Review has a reliable, documented way to exercise the core AI experience.
