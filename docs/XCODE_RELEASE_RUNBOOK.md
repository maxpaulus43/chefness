# Xcode App Store Release Runbook

Chefness 1.0 is built and submitted with Xcode. The generated `ios/` directory
is ignored; release configuration belongs in `app.json` and Expo config plugins.

## 1. Prepare the release

1. Start from the intended release commit with no unexplained local changes.
2. Set the public version in `app.json` at `expo.version`.
3. Increment `expo.ios.buildNumber` before **every** App Store Connect upload.
   Build numbers are integers (`1`, `2`, `3`, …) and cannot be reused for the
   same App Store version.
4. Run the project checks:

   ```bash
   bun install
   bun run lint
   bun run typecheck:native
   bun run test
   bunx expo-doctor
   bunx expo export --platform ios --output-dir /tmp/chefness-expo
   bun run build
   ```

5. Regenerate native files from committed configuration:

   ```bash
   bunx expo prebuild --platform ios --clean
   ```

## 2. Check generated configuration

Open the workspace, not the project file:

```bash
open ios/Chefness.xcworkspace
```

In Xcode, select the **Chefness** project and verify both targets under
**Signing & Capabilities**:

| Target | Bundle ID | Team | Required capability |
| --- | --- | --- | --- |
| Chefness | `com.maxpaulus.chefness` | `WNCJFCHP22` | App Group, Keychain entitlement |
| ChefnessShareExtension | `com.maxpaulus.chefness.ShareExtension` | `WNCJFCHP22` | App Group |

Both targets must use App Group `group.com.maxpaulus.chefness` and show no red
signing errors. The app must embed `ChefnessShareExtension.appex`.

Confirm the generated values:

- Main app and extension marketing version match `expo.version`.
- Main app and extension build number match `expo.ios.buildNumber`.
- Deployment target is iOS 16.4.
- The app is iPhone-only and portrait-only.

## 3. Archive

1. Set the active scheme to **Chefness**.
2. Select **Any iOS Device (arm64)** as the run destination.
3. Choose **Product → Archive**.
4. Wait for Organizer to open and select the new archive.

Do not archive a Debug configuration and do not depend on Metro. The Release
archive must contain its JavaScript bundle.

## 4. Inspect and validate

In Organizer:

1. Confirm version and build number.
2. Use **Show in Finder**, then **Show Package Contents** if inspection is
   needed. The archive must contain:

   ```text
   Products/Applications/Chefness.app
   Products/Applications/Chefness.app/PlugIns/ChefnessShareExtension.appex
   ```

3. Confirm both bundles use the expected identifiers, versions, and build
   numbers.
4. Confirm the archive uses Apple Distribution signing and App Store
   provisioning for both bundles.
5. Click **Distribute App → App Store Connect → Upload**.
6. Keep automatic signing selected unless resolving a specific signing problem.
7. Click **Validate App** when offered, resolve every error, then upload.

## 5. After upload

1. Wait for processing in
   [App Store Connect](https://appstoreconnect.apple.com/apps).
2. Confirm the build appears under the correct Chefness! app/version.
3. Review all processing or validation warnings.
4. Complete export-compliance information when prompted.
5. Add the build to TestFlight and run the release smoke-test checklist.

If a fix is needed, increment `expo.ios.buildNumber`, clean-prebuild, archive,
validate, and upload again. Never reuse an uploaded build number.
