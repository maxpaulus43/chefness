# Chefness iOS Native Roadmap

> A working checklist for making Chefness feel purpose-built for iOS.
>
> Complete these items one at a time. Update an item's status and notes when its implementation lands. Significant product or architectural changes must also be reflected in `PRD.md` and `ARCHITECTURE.md`.

## Status key

- [ ] Not started
- [~] In progress
- [x] Complete

## Recommended order

### Phase 1 — Native foundation

#### 1. Secure OpenRouter credentials

**Goal:** Store the OpenRouter OAuth key in iOS Keychain instead of AsyncStorage.

- [x] Add secure credential storage using `expo-secure-store`.
- [x] Keep non-secret settings in the existing settings repository.
- [x] Migrate an existing AsyncStorage OAuth key into Keychain once.
- [x] Remove the migrated plaintext key from AsyncStorage.
- [x] Ensure connect, disconnect, chat, and AI recipe tools continue to work.
- [x] Ensure credentials are never logged or included in errors.
- [x] Update the settings copy to accurately describe storage.

**Done when:** New and existing users can connect normally, and the OAuth key exists only in secure storage.

**Manual verification checklist:**

- Fresh install: connect OpenRouter, relaunch, send a chat message, save a recipe,
  run an AI recipe edit, and disconnect successfully.
- Upgrade: seed `openRouterOAuthKey` in the AsyncStorage settings record, launch,
  verify the account remains connected, and verify the key moved to Keychain and
  no longer appears in AsyncStorage.
- Failure paths: force OAuth and OpenRouter request failures and verify visible
  errors and device logs contain neither the key nor provider response bodies.

#### 2. Correct bottom safe-area handling

**Goal:** Keep the tab bar and controls clear of the Home indicator on every supported iPhone.

- [ ] Include the bottom safe-area inset in the tab bar.
- [ ] Verify content does not hide behind the tab bar.
- [ ] Test a Home-indicator device and an older non-Home-indicator device.
- [ ] Test with the keyboard open and closed.

**Done when:** Navigation and composer controls remain fully visible and comfortable to tap on supported iPhones.

#### 3. Adopt native navigation

**Goal:** Replace hand-built screen swapping with standard iOS tabs, stacks, and sheets.

- [ ] Replace the custom absolute-positioned tab implementation.
- [ ] Add native bottom tabs for Chat, Recipes, History, and Settings.
- [ ] Add stack navigation for recipe list, detail, and edit screens.
- [ ] Preserve standard swipe-back behavior.
- [ ] Present chat history, message editing, and model selection as appropriate native sheets.
- [ ] Preserve tab and navigation state where expected.
- [ ] Add deep-link-ready destinations for recipes, chats, and settings.

**Done when:** Navigation has standard iOS transitions, back gestures, safe-area behavior, and accessibility semantics.

#### 4. Use native sharing

**Goal:** Let users share recipes through the iOS share sheet.

- [ ] Replace the combined “Copy / Share” behavior with a system share action.
- [ ] Keep “Copy Markdown” as a separate action if useful.
- [ ] Share readable recipe text with the title and recipe contents.
- [ ] Handle cancellation and failures without false success messages.

**Done when:** A recipe can be sent to Messages, Mail, Notes, AirDrop, and other installed share targets.

#### 5. Add intentional haptic feedback

**Goal:** Reinforce important actions without making the app noisy.

- [ ] Add light feedback for selected high-value interactions.
- [ ] Add success feedback when saving a recipe, logging a meal, or connecting OpenRouter.
- [ ] Add warning feedback before or after destructive actions where appropriate.
- [ ] Avoid haptics for routine scrolling and typing.
- [ ] Respect system accessibility and haptic settings.

**Done when:** Important actions feel responsive while ordinary use remains calm.

### Phase 2 — iOS interaction quality

#### 6. Adopt standard iOS list interactions

**Goal:** Make common actions discoverable and familiar.

- [ ] Add swipe actions to recipes, cooking history, and chat sessions where appropriate.
- [ ] Add context menus for secondary actions.
- [ ] Use native action sheets for choices such as Camera or Photo Library.
- [ ] Use checkmarks for single-selection lists such as model selection.
- [ ] Add pull to refresh only where remote data can actually change.
- [ ] Keep destructive actions clearly labeled and confirmed when necessary.

**Done when:** Lists and choices behave like standard iOS interfaces without hiding essential actions.

#### 7. Improve typography and accessibility

**Goal:** Make Chefness readable at arm's length and usable with iOS accessibility features.

- [ ] Load and use the intended native Fraunces and Inter fonts.
- [ ] Support Dynamic Type without clipped or overlapping content.
- [ ] Test the largest accessibility text sizes.
- [ ] Give icon-only controls complete VoiceOver labels and hints.
- [ ] Maintain at least 44×44-point interactive targets.
- [ ] Ensure selection and status are not communicated by color alone.
- [ ] Support Increased Contrast and Reduce Transparency where applicable.
- [ ] Review focus order and screen announcements.
- [ ] Move crowded message actions into a scalable menu if needed.

**Done when:** Core flows work with VoiceOver and large text and remain readable from a kitchen counter.

#### 8. Virtualize long collections

**Goal:** Keep performance smooth as user data grows.

- [ ] Replace message history `ScrollView` rendering with `FlatList` or another suitable virtualized list.
- [ ] Virtualize recipes, cooking history, chat sessions, and the model catalog.
- [ ] Preserve empty, loading, and error states.
- [ ] Preserve reliable chat auto-scroll during streaming.
- [ ] Verify keyboard and accessibility behavior.

**Done when:** Long collections scroll smoothly without rendering every item at once.

#### 9. Decide and implement the iPad experience

**Goal:** Either provide an adaptive iPad interface or limit support until one is ready.

- [ ] Decide whether the next release officially supports iPad.
- [ ] If supported, add adaptive list/detail layouts for Recipes and Chat History.
- [ ] Support Split View and common multitasking sizes.
- [ ] Avoid stretched phone layouts on large screens.
- [ ] If deferred, update app configuration and release expectations accordingly.

**Done when:** The declared device support matches the experience actually delivered.

#### 10. Support system appearance

**Goal:** Respect iOS appearance and accessibility preferences while preserving Chefness's warm identity.

- [ ] Add semantic light and dark color tokens.
- [ ] Follow the system appearance by default.
- [ ] Update status bar, sheets, inputs, cards, and navigation chrome.
- [ ] Verify contrast in both appearances.
- [ ] Verify images and translucent surfaces remain legible.

**Done when:** Every core screen works in light and dark appearance with appropriate contrast.

### Phase 3 — Cooking-first experience

#### 11. Build Cook Mode

**Goal:** Create an at-a-glance, hands-friendly way to follow a recipe while cooking.

- [ ] Add a “Start Cooking” action to recipe details.
- [ ] Display one step at a time in large text.
- [ ] Provide large Previous and Next controls.
- [ ] Keep the screen awake while Cook Mode is active.
- [ ] Make ingredients easy to reference without losing the current step.
- [ ] Allow ingredients or preparation tasks to be checked off.
- [ ] Support landscape use for a phone propped on a counter.
- [ ] Restore the current step after an interruption.
- [ ] Provide an obvious way to exit Cook Mode.

**Done when:** A user can complete a recipe with minimal touching and without repeatedly unlocking the phone.

#### 12. Add native cooking timers

**Goal:** Start and manage timers directly from recipe instructions.

- [ ] Detect time durations in recipe steps.
- [ ] Offer a timer action beside detected durations.
- [ ] Support multiple named timers.
- [ ] Deliver local notifications when timers finish in the background.
- [ ] Associate each timer with its recipe and step.
- [ ] Provide pause, cancel, and “add time” actions.
- [ ] Explore a Live Activity and Dynamic Island presentation after the basic timer flow is stable.

**Done when:** Timers remain reliable while Chefness is foregrounded, backgrounded, or the phone is locked.

#### 13. Add hands-free cooking controls

**Goal:** Let users operate Cook Mode without touching the screen.

- [ ] Add speech-to-text for chat and cooking questions.
- [ ] Read recipe steps aloud on request.
- [ ] Support commands such as “next step,” “previous step,” “repeat,” and “start timer.”
- [ ] Clearly indicate when the microphone is listening.
- [ ] Handle microphone and speech permissions gracefully.
- [ ] Keep voice controls optional and privacy-conscious.

**Done when:** A user can progress through a recipe and start a timer using only their voice.

### Phase 4 — Capture, planning, and ecosystem

#### 14. Add native recipe capture

**Goal:** Make importing recipes from outside Chefness nearly effortless.

- [ ] Add an iOS Share Extension for recipe URLs shared from Safari and other apps.
- [ ] Reuse the existing URL extraction and recipe storage flow.
- [ ] Import recipe text from the clipboard.
- [ ] Scan cookbook pages with the camera and OCR.
- [ ] Extract recipes from screenshots or photos.
- [ ] Show a structured preview before saving uncertain camera/OCR imports.
- [ ] Report unsupported sites and extraction errors clearly.

**Done when:** Users can save a web, print, screenshot, or photographed recipe without manually retyping it.

#### 15. Build smart shopping lists

**Goal:** Turn selected recipes into a practical grocery workflow.

- [ ] Generate a shopping list from one or more recipes.
- [ ] Combine obvious duplicate ingredients.
- [ ] Group items by grocery aisle or category.
- [ ] Provide large check-off controls.
- [ ] Support manual items and quantity edits.
- [ ] Share a list through the system share sheet.
- [ ] Export or sync items to Apple Reminders.
- [ ] Let users exclude pantry items.

**Done when:** A user can select meals, generate one organized list, and shop from it comfortably.

#### 16. Add meal planning and pantry awareness

**Goal:** Connect planning, shopping, cooking, and history into one loop.

- [ ] Add a lightweight weekly meal planner.
- [ ] Assign saved recipes or AI suggestions to days.
- [ ] Optionally add planned meals to Calendar.
- [ ] Add a simple pantry inventory.
- [ ] Suggest recipes that use available or expiring ingredients.
- [ ] Generate shopping-list items for missing ingredients.
- [ ] Feed relevant plans and pantry context into AI suggestions with user control.

**Done when:** Chefness can suggest a meal based on plans and available ingredients, then generate the missing shopping items.

#### 17. Add deeper iOS integrations

**Goal:** Make Chefness useful beyond its main app screen.

- [ ] Add App Shortcuts/Siri actions for common tasks.
- [ ] Index saved recipes in Spotlight.
- [ ] Add a Home Screen widget for a planned, recent, or favorite recipe.
- [ ] Consider a Lock Screen widget for active cooking.
- [ ] Add Calendar integration for planned meals.
- [ ] Add Reminders integration for shopping lists.
- [ ] Evaluate optional iCloud backup or sync separately from the local-first architecture.

**Done when:** Core Chefness information and actions are available from appropriate iOS system surfaces.

## Product principles for every item

- Optimize for use in a kitchen: large targets, readable text, minimal typing, and messy hands.
- Keep recipes, settings, history, and preferences usable offline.
- Keep AI-dependent behavior clearly separated from offline behavior.
- Preserve local-first privacy and ask before sending new categories of data to an LLM.
- Prefer familiar iOS behavior over custom imitations.
- Keep each implementation small enough to review and verify independently.
- Add tests or a written manual verification checklist for every completed item.

## Work log

Add one entry when an item starts or finishes.

| Date | Item | Status | Notes |
| --- | --- | --- | --- |
| 2026-04-12 | Roadmap created | Complete | Initial prioritized roadmap based on the current native implementation. |
| 2026-08-19 | 1. Secure OpenRouter credentials | Complete | Added Keychain storage, automatic AsyncStorage migration/scrubbing, sanitized request errors, accurate settings copy, and a manual verification checklist. |
