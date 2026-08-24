---
name: chefness-app-store-release
description: Packages, archives, validates, exports, and uploads the Chefness Expo iOS app to App Store Connect. Use when releasing a new Chefness version or build, uploading a Chefness build, preparing an App Store/TestFlight binary, or diagnosing Chefness App Store upload failures.
compatibility: macOS with Bun, Expo dependencies, Xcode, an Apple Developer account configured in Xcode, and access to the Chefness repository.
---

# Chefness App Store Release

Release Chefness through its generated native iOS workspace without making durable edits under `ios/`.

## Safety rules

- Work only in the Chefness repository. Confirm `app.json` contains bundle ID `com.maxpaulus.chefness` before proceeding.
- Read `AGENTS.md`, `ARCHITECTURE.md`, `PRD.md`, `docs/XCODE_RELEASE_RUNBOOK.md`, and, when device testing is needed, `docs/AGENT_NATIVE_RUNBOOK.md` and `docs/NATIVE_DEVELOPMENT.md`.
- Treat `app.json` as the source of truth:
  - `expo.version` is the public marketing version.
  - `expo.ios.buildNumber` is the App Store build number.
- Never patch generated files under `ios/` to fix release configuration. Edit `app.json` or a config plugin, then clean-prebuild.
- Never overwrite or delete unrelated working-tree changes.
- Never upload until the user explicitly confirms the exact version and build number to upload.
- Archive/export/validation may proceed before upload confirmation.
- Never use a beta Xcode for an App Store upload when a stable compatible Xcode is available.
- Do not install multi-gigabyte Xcode components or delete simulator runtimes, Xcode installations, or device-support caches without explicit user approval.
- Build numbers cannot be reused. If Apple reports one was previously uploaded, stop, explain it, increment `expo.ios.buildNumber`, clean-prebuild, and obtain confirmation for the new exact version/build before uploading.
- Keep `manageAppVersionAndBuildNumber` set to `false`; Xcode must not silently change Chefness versions.

## 1. Establish the release

1. Confirm the repository root and bundle ID:

   ```bash
   git rev-parse --show-toplevel
   bun -e 'const c=await Bun.file("app.json").json(); console.log(c.expo.ios.bundleIdentifier)'
   ```

2. Read the current version and build:

   ```bash
   bun -e 'const c=await Bun.file("app.json").json(); console.log(`${c.expo.version} (${c.expo.ios.buildNumber})`)'
   ```

3. Ask the user for the intended public version if it was not provided.
4. Show `git status --short`. Do not proceed with unexplained tracked changes. Unrelated untracked files may remain if they cannot affect the build; mention them and leave them untouched.
5. For a new public release, update `expo.version` and reset or choose an integer build number appropriate for that version. For another upload of the same public version, increment only `expo.ios.buildNumber`.
6. State the exact candidate, for example: `Chefness 1.1.0 (build 3)`.

Do not guess whether a build number is unused. Apple is authoritative; a build can count as used even if it never appeared as selectable in App Store Connect.

## 2. Run preflight

Run from the repository root:

```bash
bun install
bun run lint
bun run typecheck:native
bun run test
bunx expo-doctor
rm -rf /tmp/chefness-expo-release
bunx expo export --platform ios --output-dir /tmp/chefness-expo-release
bun run build
```

Interpretation:

- All commands must pass before release.
- The known React Native Directory warning that `expo-share-extension` is untested on the New Architecture may be reported, but do not hide it. Any other Expo Doctor failure is a blocker.
- Existing Vite chunk-size warnings are non-blocking unless they are new or accompanied by a build failure.

## 3. Verify the toolchain and capacity

Run:

```bash
xcode-select -p
xcodebuild -version
xcodebuild -showsdks | grep -A3 -B2 -i iphone
df -h /tmp
security find-identity -v -p codesigning
```

Requirements:

- Use stable Xcode 26 or newer, subject to Apple’s current upload requirements.
- An Apple Distribution identity for team `WNCJFCHP22` must exist.
- Prefer at least 20 GB free before downloading a runtime or starting a clean archive. Stop and ask before large cleanup.
- If generic iOS is unavailable, diagnose with:

  ```bash
  xcodebuild -workspace ios/Chefness.xcworkspace -scheme Chefness -showdestinations
  xcrun simctl list runtimes
  ```

- If the matching iOS runtime/platform is missing, request approval before:

  ```bash
  xcodebuild -downloadPlatform iOS
  ```

Safe cleanup without additional approval is limited to release artifacts created during the current run under `/tmp` and Chefness-specific DerivedData. Explain any broader cleanup and obtain approval first.

## 4. Regenerate native files

After version/build changes and immediately before archiving:

```bash
bunx expo prebuild --platform ios --clean
```

Verify the generated workspace and both targets:

```bash
xcodebuild -list -workspace ios/Chefness.xcworkspace
xcodebuild -workspace ios/Chefness.xcworkspace \
  -scheme Chefness -configuration Release -showBuildSettings \
  | grep -E 'PRODUCT_BUNDLE_IDENTIFIER|CURRENT_PROJECT_VERSION|MARKETING_VERSION|IPHONEOS_DEPLOYMENT_TARGET|DEVELOPMENT_TEAM|TARGETED_DEVICE_FAMILY'
```

Also inspect `ios/Chefness.xcodeproj/project.pbxproj` and entitlements as needed. Required state:

| Target | Bundle ID | Team | Version/build |
| --- | --- | --- | --- |
| Chefness | `com.maxpaulus.chefness` | `WNCJFCHP22` | requested candidate |
| ChefnessShareExtension | `com.maxpaulus.chefness.ShareExtension` | `WNCJFCHP22` | same as app |

Both targets must use App Group `group.com.maxpaulus.chefness`; the main app must retain its Keychain entitlement. Deployment target is iOS 16.4, device family is iPhone, and the extension must be embedded.

The main app may have an unused generated `MARKETING_VERSION` build setting shortened to `major.minor` while its literal `Info.plist` contains the full version. Judge the final archived bundle values, not that unused setting alone.

## 5. Archive

Derive paths from the confirmed version/build, then run:

```bash
VERSION='<marketing-version>'
BUILD='<build-number>'
ARCHIVE="/tmp/Chefness-${VERSION}-${BUILD}.xcarchive"
RESULT="/tmp/chefness-${VERSION}-${BUILD}-archive.xcresult"
rm -rf "$ARCHIVE" "$RESULT"

xcodebuild archive \
  -workspace ios/Chefness.xcworkspace \
  -scheme Chefness \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -resultBundlePath "$RESULT" \
  -allowProvisioningUpdates
```

The command must end with `** ARCHIVE SUCCEEDED **`.

Normal React Native/Hermes undeclared-global, run-script dependency, and third-party header warnings are not upload blockers by themselves. Report them concisely; investigate any error or new app-owned compiler warning.

## 6. Inspect the archive

Set:

```bash
APP="$ARCHIVE/Products/Applications/Chefness.app"
EXT="$APP/PlugIns/ChefnessShareExtension.appex"
```

Verify:

```bash
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$EXT/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$EXT/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$EXT/Info.plist"
test -s "$APP/main.jsbundle"
codesign --verify --deep --strict --verbose=2 "$APP"
```

All identifiers and exact version/build values must match, the Release JS bundle must exist, and code-sign verification must pass.

## 7. Export an App Store IPA

Create `/tmp/Chefness-AppStore-ExportOptions.plist` with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>signingStyle</key><string>automatic</string>
  <key>teamID</key><string>WNCJFCHP22</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
```

Export:

```bash
EXPORT="/tmp/Chefness-${VERSION}-${BUILD}-AppStore"
rm -rf "$EXPORT"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT" \
  -exportOptionsPlist /tmp/Chefness-AppStore-ExportOptions.plist \
  -allowProvisioningUpdates
```

Inspect the IPA by unzipping it to a fresh temporary directory. Verify both products again and confirm both are signed by `Apple Distribution: Max Paulus (WNCJFCHP22)` with Team ID `WNCJFCHP22`. Run deep/strict code-sign verification on the exported app.

## 8. Upload gate

Immediately before upload, summarize:

- Exact version and build.
- Bundle ID and embedded share-extension ID.
- Xcode and iOS SDK versions.
- Preflight, archive, inspection, and export results.
- Any warnings.
- The source diff, especially version/build edits.

Ask: `Upload Chefness <version> (build <build>) to App Store Connect now?`

A prior general request to “help upload” is not enough when the exact candidate changed after an Apple rejection. Require confirmation of the new candidate.

## 9. Upload

After confirmation, create `/tmp/Chefness-AppStore-UploadOptions.plist` using the export plist above but change:

```xml
<key>destination</key><string>upload</string>
```

Then upload the archive through Xcode’s configured account:

```bash
UPLOAD="/tmp/Chefness-${VERSION}-${BUILD}-Upload"
rm -rf "$UPLOAD"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$UPLOAD" \
  -exportOptionsPlist /tmp/Chefness-AppStore-UploadOptions.plist \
  -allowProvisioningUpdates
```

Success requires Xcode to report a completed upload. Preserve the upload output and any delivery ID.

### Upload failures

- **Bundle version already used:** stop. Do not retry. Increment `expo.ios.buildNumber`, clean-prebuild, rebuild everything, and reconfirm the new candidate.
- **Missing third-party framework dSYMs:** report as symbol-upload warnings if the binary upload otherwise succeeds. Do not claim success if Xcode ends with `EXPORT FAILED` for another reason.
- **Authentication/account error:** do not ask for or print the user’s Apple password. Use Xcode’s configured account or recommend an App Store Connect API key/app-specific password stored securely.
- **Capability/provisioning mismatch:** fix the durable Expo config/plugin, clean-prebuild, and rebuild. Never patch the archive or generated project.
- **App record missing:** ask the user to create/confirm the Chefness! record in App Store Connect for `com.maxpaulus.chefness`, then retry the same unused build.

## 10. Report and clean up

After a successful upload:

1. Report that Apple accepted the upload and that processing can take time.
2. Tell the user to select the build in App Store Connect/TestFlight after processing and complete export-compliance prompts.
3. Show the final `git diff` and remind the user to commit the version/build change.
4. Do not delete the final archive/IPA until the user confirms they no longer need them.
5. Never claim the app is released to customers merely because the build uploaded; App Store review/submission is a separate step.
