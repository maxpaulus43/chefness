# Chefness — Product Requirements Document

> **Last updated:** 2026-08-19
>
> This document is the single source of truth for **product requirements**.
> For technical architecture details, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Table of Contents

1. [Overview & Vision](#1-overview--vision)
2. [User Persona](#2-user-persona)
3. [Navigation & Information Architecture](#3-navigation--information-architecture)
4. [Feature Specifications — MVP (v1)](#4-feature-specifications--mvp-v1)
5. [Feature Specifications — Future](#5-feature-specifications--future)
6. [Technical Dependencies](#6-technical-dependencies)
7. [MVP Scope Summary](#7-mvp-scope-summary)
8. [Future Roadmap](#8-future-roadmap)
9. [Implementation Status & Architectural Decisions](#9-implementation-status--architectural-decisions)
10. [Open Questions](#10-open-questions)

---

## 1. Overview & Vision

**Chefness** is a mobile-first, offline-first, iPhone-only Expo/React Native iOS app with
the existing Progressive Web App retained as a web target. The App Store listing
name is **Chefness!** because `Chefness` was unavailable; the installed app display
name and product name remain **Chefness**. The user chats with
an AI "cooking guru" that knows
their dietary restrictions, recent cooking history, and preferences — and helps
them plan meals, discover recipes, and cook step-by-step.

**Think of it as a personal AI sous-chef that lives in your pocket and remembers
what you've cooked.**

### Core Principles

| Principle | What it means |
| --- | --- |
| **Mobile-first** | Designed for phones used in the kitchen — large touch targets, readable at arm's length, minimal typing required. |
| **Offline-first** | All non-AI features work without an internet connection. Recipes, history, settings, and preferences are stored on-device. |
| **AI-powered** | A conversational LLM is the primary interaction model. The AI adapts to the user's context (dietary restrictions, recent meals, preferences). |
| **Single-user** | No accounts, no server. Everything is local to the device. |
| **Privacy-respecting** | Data stays on-device. LLM requests use the user's locally stored OpenRouter OAuth key. Version 1 uses Sentry for privacy-scrubbed crash/error reporting and does not include product analytics. |
| **Warm & inviting visual design** | A "kitchen glassmorphism" aesthetic: a cream gradient background with subtle grain, Fraunces serif headings over Inter body text, a saffron/espresso/rose palette, frosted translucent cards with soft shadows, and consistent inline SVG icons instead of platform-dependent emojis. Tokens are centralized in `src/theme.ts`. |

---

## 2. User Persona

### Alex — The Busy Home Cook

- **Age:** 28–45
- **Tech comfort:** Uses apps daily and is comfortable connecting an OpenRouter
  account when given clear instructions.
- **Cooking skill:** Intermediate — can follow a recipe but wants inspiration
  and guidance for trying new things.
- **Context of use:** Standing in the kitchen, phone propped on the counter,
  hands may be wet or messy. Needs large buttons, minimal typing, and
  voice-friendly text.
- **Pain points:**
  - "What should I cook tonight?" decision fatigue.
  - Forgetting what they cooked recently and ending up in a rut.
  - Recipes that don't account for dietary restrictions.
  - Having to juggle multiple apps (recipe search, meal planning, grocery list).
- **Goals:**
  - Get personalized meal suggestions fast.
  - Have the AI remember their preferences without re-explaining every time.
  - Save recipes they like and build a personal collection.
  - Track what they've cooked so the AI can suggest variety.

---

## 3. Navigation & Information Architecture

### Bottom Navigation Bar (4 tabs)

| Tab | Icon label | Purpose | MVP? |
| --- | --- | --- | --- |
| **Chat** | Chat | AI cooking session — the primary interaction surface | ✅ MVP |
| **Recipes** | Recipes | Saved recipe collection | Future (tab visible but empty state in MVP) |
| **History** | History | Chronological cooking log | Future (tab visible but empty state in MVP) |
| **Settings** | Settings | OpenRouter connection/model, dietary restrictions, preferences | ✅ MVP |

### Tab Behavior

- On iOS, React Navigation provides the standard bottom tab bar and nested
  native stacks. The retained web app continues to swap tab content in-place.
- The Chat tab is the default/home tab when the app launches.
- Each iOS tab preserves its mounted screen and nested navigation state when
  the user switches away and back.
- The iOS system tab bar handles the device bottom safe area and exposes native
  tab accessibility semantics. When the keyboard is open, the chat composer
  moves directly above it.
- Recipes use list → detail → edit stack destinations with standard back
  transitions and swipe-back. Chat history and model selection use native form
  sheets. User chat messages are edited inline in their bubbles before the
  assistant response is regenerated.
- Recipe, cooking-history, and chat-session rows support familiar iOS swipe
  actions and native long-press context menus. A lower-right ellipsis button on
  every row exposes the same menu without requiring a long press. Destructive
  list actions are labeled and confirmed.
- Photo attachment source choices use the iOS action sheet. Model selection
  marks the current choice with a checkmark and allows pull-to-refresh because
  its OpenRouter catalog is remote; device-local lists do not offer refresh.
- The `chefness://` URL scheme has destinations for recipes, chats, history,
  settings, and model selection so navigation is ready for external links.

### Layout Structure

```
┌──────────────────────────────┐
│  Content Area (scrollable)   │
│                              │
│  (Chat / Recipes / History   │
│   / Settings depending on    │
│   active tab)                │
│                              │
├──────────────────────────────┤
│  Bottom Nav Bar (fixed)      │
│  [Chat] [Recipes] [History]  │
│  [Settings]                  │
└──────────────────────────────┘
```

---

## 4. Feature Specifications — MVP (v1)

### 4.1 AI Chat (Cooking Sessions)

#### Description

A chat-style interface where the user converses with an LLM-powered cooking
guru. The AI helps with meal ideas, recipe suggestions, step-by-step cooking
instructions, substitutions, and general cooking questions. There is one active
chat session at a time. The conversation is **not persisted** — it is lost when
the user refreshes or closes the app.

#### User Stories

| ID | Story |
| --- | --- |
| **CH-1** | As a user, I can type a message and receive a streaming AI response in a chat bubble UI. |
| **CH-2** | As a user, I can see the full conversation history for the current session (scrollable). |
| **CH-3** | As a user, I can start a new conversation (clearing the current one) via a "New Chat" button. |
| **CH-4** | As a user, I can set the **meal type** (breakfast, lunch, dinner, snack, dessert) before or during a conversation using a control in the chat view. |
| **CH-5** | As a user, I can set the **meal size** (cooking for 1, 2, 4, 6+) before or during a conversation using a control in the chat view. |
| **CH-6** | As a user, I see a helpful empty state when no conversation is active, with suggested prompts I can tap (e.g., "What should I cook tonight?", "Help me use up leftover chicken"). |
| **CH-7** | As a user with a vision-capable model selected, I can take or attach a photo and send it with my prompt. |

#### Acceptance Criteria

- [ ] Chat messages render in a scrollable list with clear visual distinction
      between user messages and AI responses.
- [ ] AI responses stream token-by-token (not delivered all at once).
- [ ] The meal type and meal size controls are visible before the first message
      of a new chat, then hide once the conversation has started.
- [ ] Changing meal type or meal size does **not** add a visible message to
      the chat. These values are injected into the LLM's system prompt
      behind the scenes.
- [ ] The system prompt includes: the selected meal type, the selected meal
      size, and a base persona prompt establishing the AI as a friendly,
      knowledgeable cooking guru.
- [ ] The input field auto-focuses on the Chat tab (when no conversation
      is active, focus the input; when a conversation exists, show the input
      at the bottom).
- [x] Sending a message dismisses the keyboard and scrolls chat to the bottom.
      Chat continues to auto-scroll as the AI streams while the user is at the
      bottom. Dragging upward pauses autoscroll so older messages remain
      readable during streaming; returning to the bottom resumes autoscroll.
- [x] The image attachment control appears only when the selected OpenRouter
      model supports image input.
- [x] The attachment control opens the device image chooser, allowing users to
      take a new photo or select an existing photo from their library.
- [x] Attached images are resized before being previewed and sent. On iOS,
      compressed images are persisted as managed files while chat records store
      only file URIs; image files are removed with deleted sessions.
- [x] Users can remove a selected image before sending and can send an image
      with or without accompanying text.
- [ ] A "New Chat" button is accessible (e.g., in the chat header) and
      confirms before clearing if a conversation is in progress.
- [x] If OpenRouter is not connected, the chat view shows a clear message
      directing the user to Settings, with a tap-to-navigate action.
- [x] If the OpenRouter request fails (network error, expired connection, model
      unavailable, or rate limit), an inline error message is scrolled into view
      with a "Retry" option that resends the failed message after remediation.
- [ ] The chat UI is usable on a 375px-wide screen (iPhone SE).

#### System Prompt Structure (MVP)

```
You are Chefness, a friendly and knowledgeable AI cooking guru. You help users
plan meals, suggest recipes, provide step-by-step cooking instructions, and
answer cooking-related questions.

{meal_type_context}    ← e.g., "The user is planning dinner."
{meal_size_context}    ← e.g., "The user is cooking for 4 people."

Keep responses concise and practical. Use clear formatting with numbered steps
for recipes. Suggest ingredient substitutions when relevant. Be encouraging and
conversational.
```

### 4.2 OpenRouter Connection & Model Selection

#### Description

The user connects an OpenRouter account through OAuth and selects an OpenRouter
model in Settings. OpenRouter is the sole LLM inference provider. On iOS, the
OAuth key is stored in iOS Keychain; non-secret settings remain in AsyncStorage.

#### User Stories

| ID | Story |
| --- | --- |
| **LLM-1** | As a user, I can connect my OpenRouter account from Settings. |
| **LLM-2** | As a user, I can select a specific OpenRouter model. |
| **LLM-3** | As a user, I can see whether OpenRouter is connected without displaying the full OAuth key. |
| **LLM-4** | As a user, I can disconnect my OpenRouter account. |
| **LLM-5** | As a user, I can test my configuration by sending a quick test message from Settings (optional but nice-to-have for MVP). |

#### Acceptance Criteria

- [x] OpenRouter connection uses OAuth PKCE.
- [x] Model selection is limited to OpenRouter models.
- [x] On iOS, the OAuth key is stored in iOS Keychain through
      `expo-secure-store`; legacy AsyncStorage keys are migrated and scrubbed.
- [x] The OAuth key is **never** logged to the console or included in error
      reports.
- [x] Settings persist across app restarts.
- [x] If OpenRouter is not connected, the Chat tab shows a clear setup prompt
      (see CH acceptance criteria).
- [x] The model picker fetches the live OpenRouter model catalog rather than a
      bundled registry.
- [x] Models can be filtered by free pricing, vision support, and tool support.
      Filter choices persist and are restored when the model picker reopens.
- [ ] Chatting with the LLM requires an internet connection. If offline,
      the chat view shows "You're offline. Chat requires an internet
      connection." The rest of the app works offline.

#### Storage Keys

| Key | Value |
| --- | --- |
| `chefness:settings` | Non-secret settings singleton. On web, it also contains `openRouterOAuthKey`. |
| `chefness.openrouter-oauth-key` | iOS Keychain entry containing the OpenRouter OAuth key. |

Legacy `llmProvider` and `llmApiKey` fields remain parseable for existing
records but are ignored at runtime. Existing iOS `openRouterOAuthKey` values are
migrated from AsyncStorage into Keychain and removed from the settings record.

### 4.3 Settings Page (MVP Scope)

#### Description

The Settings page is the configuration hub. It contains OpenRouter connection
and model selection (see §4.2), dietary restrictions, and AI memory. The former
manual "AI Configuration" provider/API-key section is not shown.

#### User Stories

| ID | Story |
| --- | --- |
| **SET-1** | As a user, I can navigate to the Settings tab and see all configurable options clearly organized. |
| **SET-2** | As a user, I see section headers grouping related settings (e.g., "OpenRouter"). |

#### Acceptance Criteria

- [x] The Settings page has a clear header: "Settings".
- [x] Settings are organized into labeled sections.
- [x] **OpenRouter** section contains OAuth connect/disconnect controls and the
      model selector (see §4.2).
- [x] No manual provider or API-key configuration section is shown.
- [x] Dietary Restrictions and AI Memory sections are shown.
- [x] Settings save immediately on change (no page-level "Save" button needed).
- [x] The page is scrollable if content exceeds the viewport.

### 4.4 Navigation & Layout (MVP Scope)

#### Description

The app uses a fixed bottom navigation bar with four tabs. The Chat tab is the
default. Navigation is in-place tab switching (no routing library in MVP).

#### User Stories

| ID | Story |
| --- | --- |
| **NAV-1** | As a user, I see a bottom navigation bar with 4 labeled tabs: Chat, Recipes, History, Settings. |
| **NAV-2** | As a user, I can tap a tab to switch views. The active tab is visually highlighted. |
| **NAV-3** | As a user, I see the Chat tab selected by default when I open the app. |
| **NAV-4** | As a user, the Recipes and History tabs show a friendly empty state message (e.g., "Coming soon!") in MVP. |

#### Acceptance Criteria

- [ ] Bottom nav bar is fixed to the bottom of the viewport, 56px tall.
- [ ] Tabs: Chat, Recipes, History, Settings — in that order, left to right.
- [ ] Active tab has a distinct visual state (e.g., accent color icon/label).
- [ ] Inactive tabs are visually muted.
- [ ] Content area has bottom padding to avoid overlap with the nav bar.
- [ ] The nav bar is usable on small screens (375px width minimum).
- [ ] Tab labels use the names: "Chat", "Recipes", "History", "Settings".

---

## 5. Feature Specifications — Future

### 5.1 Save Recipes (from Chat)

#### Description

During a chat session, when the AI generates a recipe, a "Save this recipe"
action appears. Tapping it extracts the recipe into a structured card and saves
it via the existing recipe CRUD APIs (tRPC + localStorage). Saved recipes are
viewable in the Recipes tab.

#### User Stories

| ID | Story |
| --- | --- |
| **SR-1** | As a user, when the AI generates a recipe in chat, I see a "Save Recipe" button on that message. |
| **SR-2** | As a user, when I tap "Save Recipe", the recipe is parsed into structured fields (title, description, ingredients, steps) and saved to my recipe collection. |
| **SR-3** | As a user, I see a confirmation toast/message when a recipe is saved. |
| **SR-4** | As a user, I can view all saved recipes in the Recipes tab as a scrollable list of cards. |
| **SR-5** | As a user, I can tap a recipe card to see the full recipe detail view. |
| **SR-6** | As a user, I can delete a saved recipe. |
| **SR-7** | As a user, I can edit a saved recipe (title, ingredients, steps). |
| **SR-8** | As a user, I can describe a change to a saved recipe in natural language, preview the AI-updated recipe, and apply it when it looks right. |

#### Acceptance Criteria

- [x] Recipe detection: User-triggered — every assistant message shows a
      "Save Recipe" button. No auto-detection heuristic needed.
- [x] Recipe parsing: LLM-based extraction via native tool/function calling
      (`callWithTools` in `llm-stream.ts`), not regex. The `save_recipe` tool
      definition forces structured output from the LLM.
- [x] Saving uses the existing `recipe.create` tRPC procedure (via
      `createRecipeAsync` in `useRecipes` for proper error handling).
- [x] The Recipes tab shows a list of saved recipe cards (title + brief
      description).
- [x] Recipe detail view shows all fields in a readable, kitchen-friendly
      layout.
- [x] Edit and delete use the existing `recipe.update` and `recipe.delete`
      tRPC procedures.
- [x] Recipe detail includes an "AI Edit" panel where users can enter a
      natural-language change request, generate a complete updated recipe
      preview, and apply it via `recipe.update`.
- [x] AI recipe edits use LLM tool/function calling to return structured
      recipe fields and preserve unaffected recipe details where possible.
- [x] Empty state in Recipes tab: "No saved recipes yet. Chat with your
      cooking guru and save recipes you like!"

### 5.1.1 Import Recipes from URL

#### Description

Users can paste a public recipe URL into Chat. Chefness detects the URL,
extracts schema.org JSON-LD recipe data through a tiny stateless Cloudflare
Worker endpoint, saves the recipe to the existing recipe collection, and reports
success or a clear extraction error in chat.

#### Acceptance Criteria

- [x] Chat detects a message containing one recipe URL.
- [x] URL-only/import-only messages auto-save the extracted original recipe.
- [x] URL + extra user instructions are treated as conversational recipe
      context, not immediate save requests.
- [x] URL-only/import-only imports require internet connectivity but do not
      require an OpenRouter connection.
- [x] URL + extra user instructions require an OpenRouter connection so the
      assistant can reason over requested edits/recommendations.
- [x] Browser code calls a same-origin `extractRecipeFromUrl(...)` helper rather
      than fetching third-party sites directly.
- [x] A stateless Cloudflare Worker endpoint, `POST /api/extract-recipe-url`,
      fetches the URL server-side and extracts JSON-LD `Recipe` data only.
- [x] If no JSON-LD recipe is found, Chat shows: `Site doesn't support extraction.`
- [x] Successfully extracted URL-only/import-only recipes are saved through
      existing recipe storage.
- [x] Conversational URL recipe context is persisted invisibly with the chat
      session so the existing "Save Current Recipe" flow can save the latest
      edited recipe after follow-up conversation.

### 5.1.2 Import Recipes via iOS Share Sheet

#### Description

iOS users can share a recipe page from Safari (or any app sharing a web URL)
into Chefness. A share extension (built with `expo-share-extension`) shows the
shared link with an “Import Recipe” button; confirming opens the main app via
deep link, where the existing chat URL-import flow extracts and saves the
recipe.

#### Acceptance Criteria

- [ ] Safari's share sheet lists Chefness for web URLs (activation rule:
      `url`, max 1).
- [ ] The extension shows the shared URL with Import Recipe and Cancel actions.
- [ ] Import opens the main app on the Chat tab via
      `chefness://chats?sharedUrl=<base64url>&shareTs=<ms>` and runs the
      existing URL-only auto-save import in a fresh conversation.
- [ ] A repeated deep link with the same `shareTs` is not imported twice.
- [ ] Extraction success/failure is reported by the existing chat import
      messages.

### 5.2 Share Recipes

#### Description

Users can share a saved recipe as readable text. On iOS, Share opens the system
share sheet and is the only export action in recipe details. The retained web app
copies formatted Markdown to the clipboard.

#### User Stories

| ID | Story |
| --- | --- |
| **SH-1** | As an iOS user, I can send a saved recipe to Messages, Mail, Notes, AirDrop, or another installed share target through the system share sheet. |
| **SH-2** | As a web user, I can copy a saved recipe to my clipboard as Markdown and see confirmation only after the copy succeeds. |

#### Acceptance Criteria

- [x] The iOS recipe detail view has a single “Share” export action.
- [x] The shared or copied text includes the title, description, ingredients as
      bullets, and steps as a numbered list.
- [x] iOS Share uses React Native's system `Share` API; clipboard export uses
      `navigator.clipboard.writeText` on web.
- [x] Cancelling the iOS share sheet is silent, and share or clipboard failures
      show an error without a false success message.

### 5.3 Cooking Log & History

#### Description

Users can log that they cooked a meal at the end of a cooking session
conversation. Logged meals appear in the History tab and are used to give the
AI context about recent meals.

#### User Stories

| ID | Story |
| --- | --- |
| **HL-1** | As a user, I see an “I Cooked This” button on a saved recipe’s detail view. |
| **HL-2** | As a user, when I tap “I Cooked This”, the saved recipe is added to my cooking log with today's date. |
| **HL-3** | As a user, I can give the logged meal a thumbs up 👍 or thumbs down 👎 rating. |
| **HL-4** | As a user, I can add an optional freeform comment to the log entry (e.g., "Added extra garlic, was great"). |
| **HL-5** | As a user, I can view my cooking history in the History tab as a chronological list (most recent first). |
| **HL-6** | As a user, the AI references my recent meals in new conversations (e.g., "You made pasta two days ago — how about something different?"). |

#### Acceptance Criteria

- [x] A new `CookingLogEntry` entity is created with fields: `id`, `title`,
      `date` (ISO string), `rating` (`"up"` | `"down"` | `null`),
      `comment` (string, optional), `recipeId` (string, optional — links to
      a saved recipe if one exists), `createdAt`, `updatedAt`.
- [x] The cooking log follows the same storage pattern as recipes:
      Zod schema → storage repository → tRPC router → hook → component.
- [x] localStorage key: `chefness:cooking-log`.
- [x] The History tab shows entries in a flat reverse-chronological list.
- [x] The last 7 days of cooking log entries are automatically injected into
      the AI's system prompt for new chat sessions.
- [x] System prompt injection format uses `Intl.DateTimeFormat` for day names:
      ```
      Recent cooking history (last 7 days):
      - Monday: Chicken stir-fry (👍) "Used extra soy sauce"
      - Saturday: Pasta carbonara (👎) "Too salty"
      ```
- [x] Empty state in History tab: "No cooking history yet. Chat with your
      guru, cook something great, and log it here!"

> **Implementation notes:**
> - “I Cooked This” uses the saved recipe title and links the cooking-log entry
>   to that recipe. No LLM call is required.
> - Rating (👍/👎 toggle) and comments are inline on history cards — no
>   separate detail/edit sub-view.
> - System prompt injection uses `Intl.DateTimeFormat` for human-readable day
>   names (e.g., "Monday").

### 5.4 Dietary Restrictions & Preferences

#### Description

Users set dietary restrictions in Settings. These are automatically included in
every AI session's system prompt. Additionally, the AI can detect and
(with permission) save permanent user preferences.

#### User Stories

| ID | Story |
| --- | --- |
| **DR-1** | As a user, I can set my dietary restrictions in Settings from a predefined list (vegetarian, vegan, gluten-free, dairy-free, nut-free, halal, kosher, etc.) plus a freeform "Other" field. |
| **DR-2** | As a user, my dietary restrictions are automatically included in every AI conversation so I never have to repeat them. |
| **DR-3** | As a user, if the AI detects I said something worth remembering permanently (e.g., "I hate cilantro"), it asks my permission before saving it. |
| **DR-4** | As a user, I can view and manage (edit/delete) my saved AI preferences in Settings. |
| **DR-5** | As a user, my saved preferences are automatically included in future AI sessions. |

#### Acceptance Criteria

- [x] A "Dietary Restrictions" section appears in Settings (below AI
      Configuration).
- [x] Predefined restriction options are displayed as toggleable chips/tags.
      Options: vegetarian, vegan, gluten-free, dairy-free, nut-free, halal,
      kosher, pescatarian, low-carb, keto.
- [x] A freeform "Other restrictions" text field is available.
- [x] Restrictions are stored as part of the settings singleton in localStorage
      under `chefness:settings` (deviation from original plan — see §9).
- [x] An "AI Memory" section appears in Settings showing saved permanent
      preferences.
- [x] Each preference is displayed with a delete button.
- [x] Preferences are stored in localStorage under
      `chefness:ai-preferences`.
- [x] System prompt injection format for restrictions:
      ```
      Dietary restrictions: vegetarian, nut-free
      Other dietary notes: "Low sodium preferred"
      ```
- [x] System prompt injection format for preferences:
      ```
      Things to remember about this user:
      - Hates cilantro
      - Prefers spicy food
      - Has a cast iron skillet and an Instant Pot
      ```
- [x] The AI memory save flow: AI detects a saveable preference → AI suggests
      remembering via system prompt instructions → "Save to Memory" button on
      assistant messages → Preference is saved to storage and included in
      future prompts. Users can also manually add preferences in Settings.

> **Implementation notes:**
> - Dietary restrictions are stored as part of the existing settings singleton
>   (`chefness:settings`) with `dietaryRestrictions: string[]` and
>   `otherDietaryNotes: string` fields, rather than a separate localStorage
>   key. Simpler — one source of truth.
> - AI Memory uses `callWithTools` with `save_preference` tool (same pattern as
>   recipe extraction in Phase 2).
> - Both manual add (in Settings > AI Memory section) and AI-detected
>   preferences are supported (resolves open question #5).
> - The system prompt instructs the AI to proactively suggest remembering
>   preferences when it detects something worth saving.

### 5.5 Conversation Persistence & Multiple Sessions

#### Description

Chat conversations persist across app restarts. Users can have multiple saved
sessions and browse session history.

#### User Stories

| ID | Story |
| --- | --- |
| **CP-1** | As a user, my current chat conversation is saved automatically and restored when I reopen the app. |
| **CP-2** | As a user, I can start a new chat session while preserving old ones. |
| **CP-3** | As a user, I can see a list of past sessions (with a title or summary). |
| **CP-4** | As a user, I can tap a past session to view the full conversation. |
| **CP-5** | As a user, I can delete old sessions. |

#### Acceptance Criteria

- [ ] A new `ChatSession` entity: `id`, `title` (auto-generated from first
      user message or AI summary), `messages` (array of
      `{role, content, timestamp}`), `mealType`, `mealSize`, `createdAt`,
      `updatedAt`.
- [ ] Sessions are stored in localStorage under `chefness:chat-sessions`.
- [ ] The Chat tab shows a session list view (accessible via a button/icon)
      with past sessions sorted by most recent.
- [ ] Auto-save triggers after each message exchange (debounced).
- [ ] Storage follows the same pattern: Zod schema → repository → tRPC →
      hook → component.

---

## 6. Technical Dependencies

### @clinebot/* Package Suite

The app uses the following packages in its OpenRouter-only LLM integration:

| Package | Version | Purpose |
| --- | --- | --- |
| `@clinebot/llms` | 0.0.32 | Browser-compatible provider metadata used to resolve OpenRouter request configuration (`getProvider`, `toProviderConfig`). Model discovery comes directly from OpenRouter's live API. |
| `@clinebot/agents` | 0.0.32 | High-level SDK for building agentic loops with LLMs. **Installed but unused at runtime** — `Agent` class requires Node.js (see §9 architectural decisions). |
| `@clinebot/core` | 0.0.32 | Cline Core SDK. Foundation dependency for the above packages. **Installed but unused at runtime.** |
| `@clinebot/shared` | 0.0.32 | Shared utilities, types, and schemas. Common types used across the integration layer. |

> **Note:** These packages are in `package.json`. Only `@clinebot/llms` is used
> at runtime (for provider/model metadata). `@clinebot/agents` and `@clinebot/core`
> are installed but unused — they could be removed from dependencies if desired,
> but they don't affect bundle size since they're tree-shaken out. See §9 for details.

### Implemented File Structure

```
src/
  App.tsx                       App shell, tRPC/React Query providers
  main.tsx                      Vite entry point
  ReloadPrompt.tsx              PWA service worker update prompt
  components/
    BottomNavBar.tsx             Bottom nav with 4 tabs (Chat, Recipes, History, Settings), active state, Tab type export
    ChatView.tsx                 Chat UI: message list, input, meal type/size pills, empty states, error handling, streaming display, direct Save Recipe and Save to Memory actions
    HistoryView.tsx              History tab: reverse-chronological cooking log list with inline rating, comment, delete (Phase 3)
    HomePage.tsx                 Tab content switching + recipe tab navigation (list/detail/edit via selectedRecipeId + recipeViewMode state)
    RecipeDetailView.tsx         Full recipe display with ingredients, steps, back/edit/delete/copy buttons (Phase 2)
    RecipeEditView.tsx           Edit form for recipes — title, description, ingredients, steps as textareas (Phase 2)
    RecipeListView.tsx           Recipe card list for Recipes tab, with empty/loading/error states (Phase 2)
    SettingsView.tsx             OpenRouter connection/model selection, Dietary Restrictions, AI Memory
    ToastProvider.tsx            Global styled toast notifications and async confirmation prompts, replacing native browser dialogs
  contexts/
    toast-context.ts             Toast API context/types (`notify`, `ask`, `dismiss`)
  hooks/
    useAiPreferences.ts         AI preferences CRUD hook (Phase 4)
    useChat.ts                  Chat state management, LLM streaming via fetch(), system prompt construction with meal type/size, recent history, dietary restrictions, AI preferences
    useClipboard.ts             Reusable clipboard hook: copyToClipboard, copied (2s timer), error (Phase 2)
    useCookingLog.ts            Cooking log CRUD hook with recentEntries (last 7 days) convenience getter (Phase 3)
    useImageAttachment.ts       Camera/image attachment preparation state and errors
    useRecipes.ts               Recipe CRUD with createRecipeAsync/updateRecipeAsync for reliable awaitable mutations
    useOpenRouterModels.ts      Live OpenRouter model catalog loading and combined free/vision/tools filters
    useSettings.ts              Settings singleton CRUD via tRPC, OpenRouter credentials, personalization getters
    useToast.ts                 Reusable hook for firing global toast notifications and confirmation prompts
  lib/
    image-attachment.ts         Resizes camera/library images and encodes them for preview, persistence, and LLM requests
    llm-stream.ts               Browser-compatible LLM streaming + non-streaming tool/function calling client, including OpenRouter image content
    openrouter-models.ts         Fetches and validates OpenRouter's live model catalog; model capability helpers
    preference-extractor.ts     Preference extraction via callWithTools with save_preference tool (Phase 4)
    recipe-extractor.ts         Thin wrapper around callWithTools with save_recipe tool definition (Phase 2)
    recipe-url-extractor.ts     Client helper that calls the same-origin Worker recipe URL extraction endpoint
    recipe-markdown.ts          Pure function: recipeToMarkdown(recipe) — converts Recipe to Markdown text (Phase 2)
    uuid.ts                     UUID generator with crypto.randomUUID() fallback for older iOS Safari (Phase 2)
  storage/
    ai-preferences.ts           AI preferences localStorage repository (key: 'chefness:ai-preferences') (Phase 4)
    cooking-log.ts              Cooking log localStorage repository (key: 'chefness:cooking-log') (Phase 3)
    settings.ts                 Settings repository singleton (storageKey: 'chefness:settings')
    recipes.ts                  Recipe repository (pre-existing)
    interface.ts                StorageRepository interface (pre-existing)
    local-storage.ts            localStorage implementation (pre-existing)
  trpc/
    router.ts                   Updated with settings, recipe, cookingLog, and aiPreference sub-routers
    client.ts                   tRPC client setup (pre-existing)
    index.ts                    tRPC exports (pre-existing)
    provider.tsx                tRPC + React Query provider wrapper (pre-existing)
  worker.ts                     Cloudflare Worker entry point: static asset fallback plus stateless `/api/extract-recipe-url` JSON-LD extraction endpoint
  types/
    ai-preference.ts            AiPreference, CreateAiPreferenceInput, UpdateAiPreferenceInput Zod schemas (Phase 4)
    cooking-log.ts              CookingLogEntry, CreateCookingLogInput, UpdateCookingLogInput Zod schemas (Phase 3)
    settings.ts                 Settings Zod schemas (settingsSchema with dietaryRestrictions + otherDietaryNotes, createSettingsInput, updateSettingsInput)
    openrouter-model.ts         Runtime schema for the OpenRouter model catalog fields used by filters
    recipe.ts                   Recipe Zod schemas (pre-existing)
```

### Pre-existing Scaffolding

The following were implemented before MVP development and served as the foundation:

| Component | Location | Status |
| --- | --- | --- |
| PWA configuration | `vite.config.ts` (VitePWA plugin) | ✅ Complete |
| Service worker registration | `src/ReloadPrompt.tsx` | ✅ Complete |
| tRPC in-browser setup | `src/trpc/` (localLink, no server) | ✅ Complete |
| Storage abstraction layer | `src/storage/interface.ts` | ✅ Complete |
| localStorage implementation | `src/storage/local-storage.ts` | ✅ Complete |
| Recipe CRUD (types, storage, router, hook) | `src/types/recipe.ts`, `src/storage/recipes.ts`, `src/trpc/router.ts`, `src/hooks/useRecipes.ts` | ✅ Complete |
| Provider wrapper (tRPC + React Query) | `src/trpc/provider.tsx` | ✅ Complete |

### What Was Built for MVP (✅ All Complete)

| Component | Location | Description |
| --- | --- | --- |
| Bottom nav bar | `src/components/BottomNavBar.tsx` | ✅ Updated tabs to Chat, Recipes, History, Settings with active state and `Tab` type export. |
| Tab content switching | `src/components/HomePage.tsx` | ✅ `useState`-based tab switching, renders correct content per tab. Chat is default. |
| Chat view | `src/components/ChatView.tsx` | ✅ Full chat UI with message list, input, send button, vision-gated camera/image attachments, meal controls, empty states, errors, and streaming display. |
| Chat hook | `src/hooks/useChat.ts` | ✅ Conversation state, persistence, vision capability detection, multimodal message orchestration, system prompts, streaming, and offline detection. |
| LLM streaming client | `src/lib/llm-stream.ts` | ✅ Browser-compatible SSE client with OpenRouter `image_url` multimodal content support. |
| Settings view | `src/components/SettingsView.tsx` | ✅ OpenRouter OAuth connection and live model selection with combinable Free, Vision, and Tools filters; no manual provider/API-key section. |
| Settings hook | `src/hooks/useSettings.ts` | ✅ Settings singleton CRUD via tRPC with OpenRouter-only effective credentials. |
| Settings storage | `src/storage/settings.ts`, `src/types/settings.ts` | ✅ Zod schemas + storage repository singleton (key: `chefness:settings`). |
| Settings tRPC router | `src/trpc/router.ts` | ✅ Added `settings.get` and `settings.update` procedures to existing router. |
| Toast provider + hook | `src/components/ToastProvider.tsx`, `src/hooks/useToast.ts` | ✅ Reusable styled toast API with `toast.notify(...)` and async `toast.ask(...)`; native browser confirmations replaced for new chat, conversation delete, recipe delete, history delete, preference removal, and chat message regeneration. |

---

## 7. MVP Scope Summary

A clear checklist of everything included in v1:

### ✅ In MVP

- [x] **Bottom nav bar** with 4 tabs: Chat, Recipes, History, Settings
- [x] **Tab switching** — tapping a tab shows its content; Chat is default
- [x] **Chat view** — full chat UI with message list, text input, send button
- [x] **AI streaming responses** — token-by-token rendering in chat bubbles
- [x] **Vision prompts** — take or attach a resized image when the selected model supports vision
- [x] **Meal type selector** — breakfast / lunch / dinner / snack / dessert
- [x] **Meal size selector** — cooking for 1 / 2 / 4 / 6+
- [x] **System prompt** — base cooking guru persona + meal type + meal size
- [x] **New Chat button** — clears current conversation and starts fresh
- [x] **Empty chat state** — suggested prompt bubbles for quick start
- [x] **Error handling in chat** — network errors, expired OpenRouter
      connection, unavailable model, rate limits, and offline state
- [x] **Settings page** — OpenRouter connection, model selection, dietary restrictions, and AI memory
- [x] **OpenRouter OAuth** — connect/disconnect without manual provider configuration
- [x] **OpenRouter model selector** — populated from the live OpenRouter catalog with Free, Vision, and Tools filters
- [x] **OAuth key status** — masked display, stored locally
- [x] **Offline detection** — chat shows offline message; rest of app works
- [x] **Recipes tab** — empty state placeholder ("Coming soon" or similar)
- [x] **History tab** — empty state placeholder ("Coming soon" or similar)
- [x] **Mobile-first responsive layout** — usable at 375px width minimum

### ✅ Phase 2 (Complete)

- [x] **Save Recipe from Chat** — user-triggered LLM extraction via native tool calling
- [x] **Recipe List View** — scrollable card list in Recipes tab with empty/loading states
- [x] **Recipe Detail View** — kitchen-friendly full recipe display (large text, ingredients bullet list, numbered steps)
- [x] **Recipe Edit & Delete** — edit form with pre-populated fields, delete with confirmation
- [x] **Share Recipe** — iOS system share sheet; Markdown clipboard export on web

### ✅ Phase 3 (Complete)

- [x] **Cooking Log** — “I Cooked This” button on saved recipe details
- [x] **History Tab** — Reverse-chronological cooking log list with inline rating (👍/👎) and comments
- [x] **AI History Context** — Last 7 days of cooking history injected into system prompt

### ✅ Phase 4 (Complete)

- [x] **Dietary Restrictions** — Toggleable chips in Settings + freeform "Other" field, injected into system prompt
- [x] **AI Memory** — Saved permanent preferences with auto-detect from chat + manual add in Settings
- [x] **Preferences Management** — View and delete saved preferences in Settings > AI Memory section

### ❌ Not in MVP, Phase 2, Phase 3, or Phase 4

- Conversation persistence (lost on refresh)
- Multiple chat sessions
- Any backend server or user accounts

---

## 8. Future Roadmap

Features are listed in suggested implementation order, grouped into phases.
Each phase builds on the previous one.

### Phase 2 — Recipes ✅ Complete

All 5 Phase 2 items have been implemented. Recipe saving uses user-triggered LLM
extraction via native tool calling. The Recipes tab now provides full list, detail,
edit, and delete flows plus the iOS system share sheet (and Markdown clipboard export on web).

1. ~~**Save Recipe from Chat** (§5.1) — Recipe detection, parsing, save action~~
2. ~~**Recipe List View** — Browse saved recipes in the Recipes tab~~
3. ~~**Recipe Detail View** — Full recipe display with kitchen-friendly layout~~
4. ~~**Recipe Edit & Delete** — Modify or remove saved recipes~~
5. ~~**Share Recipe** (§5.2) — iOS system share sheet and separate Markdown copy~~

### Phase 3 — Cooking History ✅ Complete

All 4 Phase 3 items have been implemented. The History tab is now fully functional
with cooking log entries, inline rating/comments, and AI context injection.

6. ~~**Cooking Log** (§5.3) — “I Cooked This” action on recipe details~~
7. ~~**History Tab** — Chronological cooking log display~~
8. ~~**Rating & Comments** — Thumbs up/down + freeform notes on log entries~~
9. ~~**AI History Context** — Inject last 7 days of history into system prompt~~

### Phase 4 — Personalization ✅ Complete

All 3 Phase 4 items have been implemented. Dietary restrictions and AI Memory are
fully functional in Settings, with both AI-detected and manual preference saving.

10. ~~**Dietary Restrictions** (§5.4) — Settings UI + system prompt injection~~
11. ~~**AI Memory** (§5.4) — Detect, suggest saving, and persist permanent preferences~~
12. ~~**Preferences Management** — View/delete saved preferences in Settings~~

### Phase 5 — Conversation Management

13. **Conversation Persistence** (§5.5) — Auto-save sessions to localStorage
14. **Session History List** — Browse and reopen past conversations
15. **Session Management** — Delete old sessions, session titles

### Potential Future Explorations (Not Scoped)

- Voice input for hands-free cooking
- Timer integration (set cooking timers from chat)
- Grocery/shopping list generation from recipes
- Photo-based ingredient recognition
- Nutrition information on recipes
- Weekly meal planning calendar view
- Data export/import for backup

---

## 9. Implementation Status & Architectural Decisions

### Native Migration Status: ✅ Complete (iOS)

The product now has a native Expo/React Native iOS presentation layer while
retaining the existing PWA target. Its saved-item lists use native swipe actions
and context menus, photo source selection uses an iOS action sheet, and remote
model selection uses checkmarks and pull-to-refresh. Chat and streaming, OpenRouter OAuth/model
selection, camera or photo-library attachments, persisted session history,
virtualized long collections with user-controlled streaming chat autoscroll,
recipe import/save/search/detail/edit/delete/share and AI edits, cooking history,
dietary restrictions, and AI memory all use native screens and controls.

Shared hooks, Zod schemas, the local tRPC router, and domain helpers remain the
single business-logic implementation. Native non-secret records use
AsyncStorage, the OpenRouter OAuth key uses iOS Keychain, and web records use
IndexedDB. Expo platform extension resolution selects native settings,
persistence, UUID, and OpenRouter streaming implementations. The app uses the
documented no-callback S256 PKCE flow on native (copying OpenRouter's one-time
authorization code back into the app) and an iOS scene lifecycle config plugin
for current Xcode/iOS SDK compatibility.

### MVP Status: ✅ Complete

All MVP features from §7 have been implemented for both the iOS app and retained
web target. See §6 for the feature structure and §7 for the checked-off list.

### Key Architectural Decisions

The following decisions were made during MVP implementation. Future agents must
understand these to avoid re-discovering limitations or breaking existing patterns.

#### a) @clinebot/* packages: browser limitations

- `@clinebot/llms` browser build exports provider metadata helpers (`getProvider`, `toProviderConfig`) but does **NOT** export `createHandler`/`createHandlerAsync`. These require Node.js because they dynamically import provider SDKs (`openai`, `@anthropic-ai/sdk`, etc.) which depend on Node builtins.
- `@clinebot/agents` `Agent` class is **NOT usable in the browser** because it depends on `createHandler` internally.
- **Decision:** We use `@clinebot/llms` only to resolve OpenRouter request configuration. Model discovery uses OpenRouter's live public API. Actual LLM communication uses a custom browser-compatible streaming client (`src/lib/llm-stream.ts`) that makes direct `fetch()` calls with SSE parsing.
- The `@clinebot/agents` and `@clinebot/core` packages are installed but unused at runtime. They could be removed from dependencies if desired, but they don't affect bundle size since they're tree-shaken out.

#### b) LLM streaming: fetch-based SSE client

- Chefness sends chat and tool-calling requests only to OpenRouter's
  OpenAI-compatible `/chat/completions` endpoint.
- The lower-level `src/lib/llm-stream.ts` client retains an Anthropic-native
  branch for compatibility with legacy code, but no current Settings or runtime
  flow selects it.
- The OpenRouter base URL is resolved using `toProviderConfig()` from the
  `@clinebot/llms` browser build. Models from different model vendors remain
  available only through OpenRouter's catalog and connection.

#### c) Settings reactivity pattern

- `SettingsView` uses local component state for the OpenRouter model picker and personalization controls that syncs with `useSettings` but **leads** during user interaction. This avoids the async tRPC mutation round-trip delay that would cause controls to snap back to old values.
- **This pattern should be followed** for any future Settings fields that need immediate UI feedback.

#### d) Platform navigation

- iOS uses React Navigation bottom tabs and nested native stacks from
  `src/native/navigation.tsx`. React Navigation preserves mounted tab/stack
  state and provides system safe-area, transition, back-gesture, and
  accessibility behavior.
- `src/native/navigation-routes.ts` defines typed destinations and
  `chefness://` deep links for recipes, chats, history, and settings.
- The retained web app still uses simple `useState` tab/content switching in
  `HomePage.tsx`; it does not require React Navigation.
- Chat is the default tab on both platforms.

### Phase 2 Status: ✅ Complete

All Phase 2 (Recipes) features from §8 have been implemented. The Recipes tab is
now fully functional with save, list, detail, edit, delete, and share flows.

| Component | Location | Description |
| --- | --- | --- |
| Save Recipe button | `src/components/ChatView.tsx` | ✅ Every assistant message shows a "Save Recipe" button with idle/extracting/saved/error states. Uses `extractRecipe` + `createRecipeAsync`. |
| Recipe extraction | `src/lib/recipe-extractor.ts` | ✅ Thin wrapper around `callWithTools` with `save_recipe` tool definition. Forces structured output from the LLM. |
| Tool calling client | `src/lib/llm-stream.ts` | ✅ Added `callWithTools()` public function + `ToolDefinition`, `ToolCallResult`, `ToolCallOptions` types. Non-streaming. Supports OpenAI-compatible and Anthropic-native tool calling. |
| Recipe list view | `src/components/RecipeListView.tsx` | ✅ Scrollable card list in Recipes tab with empty/loading/error states. |
| Recipe detail view | `src/components/RecipeDetailView.tsx` | ✅ Kitchen-friendly full recipe display: large text, ingredients as bullet list, numbered steps, back/edit/delete/copy buttons. |
| Recipe edit view | `src/components/RecipeEditView.tsx` | ✅ Edit form with pre-populated fields (title, description, ingredients, steps as textareas). |
| Recipe tab navigation | `src/components/HomePage.tsx` | ✅ Added `selectedRecipeId` + `recipeViewMode` state for list/detail/edit navigation within the Recipes tab. |
| Recipe sharing | `src/native/RecipesScreen.tsx`, `src/lib/recipe-markdown.ts` | ✅ iOS system share sheet with readable recipe text plus a separate Markdown clipboard action. |
| Clipboard hook | `src/hooks/useClipboard.ts` | ✅ Reusable hook: `copyToClipboard`, `copied` (2s timer), `error`. |
| UUID generation | `src/lib/uuid.ts` | ✅ `generateUUID()` with `crypto.randomUUID()` fallback for older iOS Safari. |
| Async mutations | `src/hooks/useRecipes.ts` | ✅ Added `createRecipeAsync`, `updateRecipeAsync` (via `mutateAsync`) + `onError` callbacks. |
| System prompt update | `src/hooks/useChat.ts` | ✅ Added soft recipe formatting guideline to system prompt. |

#### Phase 2 Architectural Decisions

#### e) Recipe extraction: native tool calling

- Save Recipe uses `callWithTools()` in `llm-stream.ts` which extends the fetch-based client with non-streaming tool/function calling support. The `save_recipe` tool forces structured output from the LLM.
- Works across OpenAI-compatible (function calling) and Anthropic (native tool use) protocols.
- The extraction is user-triggered: every assistant message shows a "Save Recipe" button. No auto-detection heuristic is needed.
- `src/lib/recipe-extractor.ts` is a thin wrapper that defines the `save_recipe` tool schema and calls `callWithTools`.

#### f) UUID generation fallback

- `src/lib/uuid.ts` provides `generateUUID()` with fallback from `crypto.randomUUID()` to `crypto.getRandomValues()`-based implementation for iOS Safari < 15.4 in non-secure contexts.
- Used when creating new recipes from the save flow (where `crypto.randomUUID()` may throw on older mobile browsers).

#### g) Recipe tab navigation

- On iOS, recipe list, detail, and edit are typed native-stack destinations;
  recipe IDs are route parameters and standard swipe-back is enabled.
- On web, `HomePage.tsx` continues to manage `selectedRecipeId` and
  `recipeViewMode` (`list` | `detail` | `edit`) locally.

#### h) Async mutations for reliability

- `useRecipes` exposes `createRecipeAsync` / `updateRecipeAsync` (via `mutateAsync`) for callers that need to await the result (e.g., ChatView save handler needs to show success/error state).
- Fire-and-forget `mutate` variants are still available for cases that don't need the result.
- `createRecipeAsync` was introduced as a bug fix for proper error handling on iOS Safari where the non-async `mutate` callback timing was unreliable.

### Phase 3 Status: ✅ Complete

All Phase 3 (Cooking History) features from §8 have been implemented. The History
tab is now fully functional with cooking log entries, inline rating/comments, and
AI context injection.

| Component | Location | Description |
| --- | --- | --- |
| CookingLogEntry types | `src/types/cooking-log.ts` | ✅ Zod schemas: `CookingLogEntry`, `CreateCookingLogInput`, `UpdateCookingLogInput`. |
| Cooking log storage | `src/storage/cooking-log.ts` | ✅ localStorage repository (key: `chefness:cooking-log`). |
| Cooking log tRPC router | `src/trpc/router.ts` | ✅ Added `cookingLog` sub-router with list, getById, create, update, delete procedures. |
| Cooking log hook | `src/hooks/useCookingLog.ts` | ✅ CRUD hook with `recentEntries` convenience getter (filters to last 7 days). |
| “I Cooked This” button | Recipe detail views | ✅ Adds the saved recipe to cooking history and links the resulting entry to the recipe. |
| History tab | `src/components/HistoryView.tsx` | ✅ Reverse-chronological list with title, date, inline rating (👍/👎 toggle), comment add/edit, and delete. |
| AI history context | `src/hooks/useChat.ts` | ✅ `buildSystemPrompt` injects last 7 days as "Recent cooking history" section. Uses `Intl.DateTimeFormat` for day names. |
| History tab integration | `src/components/HomePage.tsx` | ✅ Replaced history empty state with `<HistoryView />`. |

#### Phase 3 Architectural Decisions

#### i) Cooking log entity

- Full CRUD following the same pattern as recipes: Zod schema → storage repository → tRPC router → hook → component.
- `recentEntries` getter in the hook filters to the last 7 days for system prompt injection.
- The cooking log is a separate entity from recipes — a log entry may optionally link to a recipe via `recipeId`, but cooking logs exist independently.

#### j) History tab navigation

- Simple flat list, no detail/edit sub-views (unlike Recipes which has list/detail/edit modes).
- Rating (👍/👎 toggle) and comments are inline on history cards — edited in-place without navigating away.
- This is intentionally simpler than the Recipe tab's navigation model because cooking log entries are lightweight.

### Phase 4 Status: ✅ Complete

All Phase 4 (Personalization) features from §8 have been implemented. Dietary
restrictions and AI Memory are fully functional in Settings, with both AI-detected
and manual preference saving.

| Component | Location | Description |
| --- | --- | --- |
| Dietary restrictions fields | `src/types/settings.ts` | ✅ Added `dietaryRestrictions: string[]` and `otherDietaryNotes: string` to `settingsSchema`. |
| Settings storage update | `src/storage/settings.ts` | ✅ Updated `applyUpdate` for new dietary fields. |
| Settings hook update | `src/hooks/useSettings.ts` | ✅ Added `dietaryRestrictions` and `otherDietaryNotes` getters. |
| Dietary Restrictions UI | `src/components/SettingsView.tsx` | ✅ "Dietary Restrictions" section with toggleable chips (10 options) + freeform "Other" field. |
| AiPreference types | `src/types/ai-preference.ts` | ✅ Zod schemas: `AiPreference`, `CreateAiPreferenceInput`, `UpdateAiPreferenceInput`. |
| AI preferences storage | `src/storage/ai-preferences.ts` | ✅ localStorage repository (key: `chefness:ai-preferences`). |
| AI preferences tRPC router | `src/trpc/router.ts` | ✅ Added `aiPreference` sub-router. |
| AI preferences hook | `src/hooks/useAiPreferences.ts` | ✅ CRUD hook for AI preferences. |
| AI Memory UI | `src/components/SettingsView.tsx` | ✅ "AI Memory" section with saved preferences, delete buttons, + manual "Add preference" input. |
| Preference extractor | `src/lib/preference-extractor.ts` | ✅ Uses `callWithTools` with `save_preference` tool (same pattern as recipe extraction). |
| "Save to Memory" button | `src/components/ChatView.tsx` | ✅ Added on assistant messages for AI-detected preferences. |
| System prompt update | `src/hooks/useChat.ts` | ✅ Injects dietary restrictions, other notes, AI preferences, and memory detection instruction into system prompt. |

#### Phase 4 Architectural Decisions

#### k) Dietary restrictions in settings singleton

- Stored as part of the existing settings entity (`chefness:settings`) with `dietaryRestrictions: string[]` and `otherDietaryNotes: string` fields.
- Deviates from the original plan which specified a separate localStorage key (`chefness:settings:dietary-restrictions`).
- **Rationale:** Simpler — one entity to manage, one source of truth.

#### l) AI preference extraction

- Uses the same `callWithTools` pattern as recipe extraction (decision e).
- `save_preference` tool has a single `preference` string parameter.
- `src/lib/preference-extractor.ts` is a thin wrapper analogous to `recipe-extractor.ts`.

#### m) AI memory detection

- System prompt instructs the AI to proactively suggest remembering preferences when it detects something worth saving.
- Users can also manually add preferences in the Settings > AI Memory section.
- This dual approach (AI-detected + manual) gives users maximum control.

### Deviations from Original Plan

| Area | Original Plan | Actual Implementation | Reason |
| --- | --- | --- | --- |
| LLM integration | Use `@clinebot/agents` `Agent` class for chat | Custom `fetch()`-based SSE client (`llm-stream.ts`) | `Agent` class requires Node.js; not usable in browser |
| Chat hook | `useChat` calls LLM via `@clinebot/agents` | `useChat` calls LLM via `src/lib/llm-stream.ts` | Same — browser compatibility |
| Settings storage key | Multiple keys (`chefness:settings:llm-provider`, etc.) | Single key (`chefness:settings`) storing full settings object | Simpler singleton pattern via `LocalStorageRepository` |
| Provider configuration | Multiple manual providers and BYO API keys | OpenRouter OAuth only | Simplifies setup and matches the supported product direction |
| Recipe extraction | Regex-based detection + heuristic parser | User-triggered LLM extraction via native tool calling | More reliable; user controls what to save; LLM understands its own output |
| Dietary restrictions storage | Separate key `chefness:settings:dietary-restrictions` | Part of settings singleton (`chefness:settings`) | Simpler; one entity to manage |
| AI Memory save flow | AI-only detection | AI detection + manual add in Settings | More user control; resolves open question #5 |

---

## 10. Open Questions

| # | Question | Impact | Status |
| --- | --- | --- | --- |
| 1 | Which providers and models should be available? | LLM-1, LLM-2 | ✅ **Resolved** — OpenRouter is the sole provider. Models come from its live catalog and can be filtered by free pricing, vision support, and tool support. |
| 2 | How should the OpenRouter OAuth key be stored? | LLM-3 | ✅ **Resolved** — Plaintext in the local settings store. No obfuscation for MVP. Acceptable given the single-user, no-server architecture. |
| 3 | What heuristic or mechanism detects that an AI response contains a recipe vs. general conversation? Options: (a) structured output / tool call from the LLM, (b) regex-based detection, (c) a follow-up LLM call to classify. | SR-1 | ✅ **Resolved** — No auto-detection. User taps "Save Recipe" on any assistant message. The app uses native LLM tool/function calling (`callWithTools` with a `save_recipe` tool definition) to extract structured recipe data. This avoids fragile regex heuristics and gives provider-enforced structured output. |
| 4 | Should the “I Cooked This” action auto-populate the title from the recipe, or let the user name it? | HL-2 | ✅ **Resolved** — It uses the saved recipe title. The history note remains editable later in the History tab. |
| 5 | For AI Memory (DR-3), should the AI proactively suggest saving preferences, or should there also be a manual "Remember this" button the user can press? | DR-3 | ✅ **Resolved** — Both. The AI proactively suggests remembering preferences via system prompt instructions, AND users can manually add preferences in the Settings > AI Memory section. |
| 6 | Is there a maximum number of chat sessions to retain before auto-pruning old ones? localStorage has a ~5–10MB limit. | CP-2 | Open — Phase 5 |
