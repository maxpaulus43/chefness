# Native iOS Runbook for Agents

Use this minimum loop for meaningful Expo/React Native work.

## 1. Orient

- Read `ARCHITECTURE.md` and `PRD.md`.
- Native UI: `src/native/`; entry: `src/App.native.tsx`.
- Shared hooks/router/types stay in `src/`.
- Browser-only boundaries use `.native.ts` implementations.
- `ios/` is generated and ignored. Change `app.json` or config plugins, not generated files.

## 2. Verify before device work

```bash
bun install
bun run lint
bun run typecheck:native
bunx expo-doctor
bunx expo export --platform ios --output-dir /tmp/chefness-expo
```

Also run `bun run build` when shared code could affect the retained web app.

## 3. Find and prepare the phone

The iPhone must be unlocked, trusted, in Developer Mode, and connected.

```bash
xcrun devicectl list devices
xcrun devicectl device info lockState --device "<device name or UDID>"
```

Regenerate native files only after config/plugin/native dependency changes:

```bash
bunx expo prebuild --platform ios --clean
```

The scene-lifecycle plugin in `plugins/with-ios-scene-lifecycle.cjs` is required for current iOS/Xcode SDKs.

## 4. Build and install

Use the normal debug loop. Keep Metro running in one terminal, then build and
install from another:

```bash
bun run start
bun run ios:device
```

Do not use `--configuration Release --no-bundler` for routine agent
verification; it is slow and bypasses the normal development workflow.

Do not claim device success from compilation alone. Confirm install and launch (`com.maxpaulus.chefness`):

```bash
xcrun devicectl device info apps --device "<device>" \
  --bundle-id com.maxpaulus.chefness
xcrun devicectl device process launch --device "<device>" \
  --terminate-existing com.maxpaulus.chefness
sleep 5
xcrun devicectl device info processes --device "<device>" | grep Chefness
xcrun devicectl device capture screenshot --device "<device>" \
  --destination /tmp/chefness.png
```

Inspect `/tmp/chefness.png`. Exercise the changed flow on the phone when credentials or permissions are involved.

## 5. Diagnose launch failures

```bash
xcrun devicectl device process launch --device "<device>" \
  --terminate-existing --console com.maxpaulus.chefness
```

For fuller device logs, install `libimobiledevice` and capture around launch:

```bash
brew install libimobiledevice
idevicesyslog -u "<UDID>" > /tmp/iphone.log &
# launch the app, then stop idevicesyslog
grep -Ei 'Chefness|RCTFatal|SIGTRAP|exception' /tmp/iphone.log
```

If logs say `UIScene life cycle is required`, verify the scene plugin remains in `app.json`, then rerun clean prebuild.

## Completion gate

Before reporting done: lint, native typecheck, Expo Doctor, iOS export, debug install, successful launch, live process, screenshot, and targeted flow verification must all pass.
