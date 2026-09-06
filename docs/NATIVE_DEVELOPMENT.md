# Native iOS Development

Chefness uses Expo/React Native on iOS while retaining its Vite web app.

## First-time setup

Requirements: Bun, Xcode, an Apple development identity, and an unlocked/trusted iPhone with Developer Mode enabled.

```bash
bun install
bunx expo prebuild --platform ios
```

`ios/` is generated and ignored. Make durable native configuration changes in `app.json` or `plugins/`.

## Daily development

```bash
# Terminal 1: Metro
bun run start

# Terminal 2: choose the connected device, build, and install
bun run ios:device
```

Use the normal Metro-backed debug build for development and verification. Do
not add `--configuration Release --no-bundler` to the routine workflow; it is
slow and bypasses the normal development setup.

Keep the phone unlocked during installation and first launch.

## Test in-app purchases without real money

Chefness includes `storekit/Chefness.storekit` with the iCloud Sync test
product (product ID `com.maxpaulus.chefness.unlimited_recipes`, kept from the
original "Unlimited Recipes" unlock). After a clean prebuild:

1. Open `ios/Chefness.xcworkspace` in Xcode.
2. Drag `storekit/Chefness.storekit` into the Chefness project navigator; do not
   copy it or add it to an app target.
3. Open **Product → Scheme → Edit Scheme → Run → Options** and select
   `Chefness.storekit` under **StoreKit Configuration**.
4. Run Chefness from Xcode on the simulator or connected iPhone.

Purchases in this Xcode StoreKit environment are simulated and do not charge a
payment method. Use **Debug → StoreKit → Manage Transactions** to delete the
purchase and test the free state or purchase restoration again. A normal CLI
build uses App Store Connect instead; the unlock button stays disabled until the
matching product exists and is available there.

## iCloud Sync (CloudKit) setup

Sync uses the CloudKit private database in container
`iCloud.com.maxpaulus.chefness`, configured through the `expo-cloudkit` plugin
in `app.json`. Prebuild writes the iCloud entitlements; nothing in `ios/` is
edited by hand.

One-time Apple setup (developer.apple.com → Certificates, Identifiers &
Profiles):

1. Create the iCloud container `iCloud.com.maxpaulus.chefness`.
2. On the `com.maxpaulus.chefness` App ID, enable **iCloud** with **CloudKit**
   and assign the container. Regenerate/refresh provisioning profiles (Xcode
   automatic signing does this on the next build).

Schema: in the **Development** environment CloudKit creates record types on
first save, so a debug build populates the schema by itself. Before shipping,
open the CloudKit Console and **Deploy Schema Changes to Production**. Record
types are `Recipe`, `Settings`, `CookingLogEntry`, `AiPreference`,
`ChatSession` (fields `payload` String, `updatedAt` Date/Time, `deletedAt`
Date/Time) and `ChatImage` (`name` String, `file` Asset), all in the custom zone
`ChefnessData`. Production schema is additive-only; the engine keeps entity data
inside the `payload` string so Zod schema changes never need a CloudKit
deployment.

Environments: `app.json` sets `iCloudContainerEnvironment` to `Development` so
debug builds use the development container. Xcode switches the entitlement to
`Production` when exporting for App Store Connect/TestFlight. TestFlight and
App Store builds therefore need the production schema deployed first.

Testing on device:

- Sign the iPhone into iCloud. Buy (or restore) the StoreKit test product,
  then turn on **Settings → iCloud Sync**.
- Install on a second device (or reinstall) with the same Apple ID, enable
  sync, and confirm recipes, chats with photos, history, memory, and settings
  converge. Edit the same recipe on both devices to see the newest change win.
- The CloudKit Console (Data → Private Database → `ChefnessData`) shows the
  raw records while signed in with the same Apple ID.
- Sync only runs while the app is in the foreground; use "Sync Now" in
  Settings to force a cycle.

## Required checks

```bash
bun run lint
bun run typecheck:native
bunx expo-doctor
bunx expo export --platform ios --output-dir /tmp/chefness-expo
bun run build  # retained web target
```

## Useful device commands

```bash
xcrun devicectl list devices
xcrun devicectl device process launch --device "Your iPhone" \
  --terminate-existing com.maxpaulus.chefness
xcrun devicectl device capture screenshot --device "Your iPhone" \
  --destination /tmp/chefness.png
```

## Common issues

- **Device locked:** unlock it and rerun the install/launch command.
- **Signing failure:** open Xcode and confirm the Apple Development team/certificate.
- **Native dependency or `app.json` changed:** run `bunx expo prebuild --platform ios --clean`.
- **Immediate iOS 27 launch crash:** do not remove `plugins/with-ios-scene-lifecycle.cjs` from `app.json`.
- **Pod deployment target below 15.0:** keep `plugins/with-ios-pods-deployment-target.cjs` enabled and rerun `bunx expo prebuild --platform ios`.
- **OpenRouter on iOS:** authorization returns through `https://chefness.org/openrouter/callback/` to `chefness://openrouter`; deploy `website/` before testing callback changes.
