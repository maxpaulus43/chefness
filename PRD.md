# Chefness — Product Requirements Document

> **Last updated:** 2026-04-12
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

**Chefness** is a mobile-first, offline-first Progressive Web App (PWA) that
helps users cook using AI. The user chats with an AI "cooking guru" that knows
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
| **Privacy-respecting** | Data stays on-device. The only network calls are to the user's chosen LLM provider using their own API key. |

---

## 2. User Persona

### Alex — The Busy Home Cook

- **Age:** 28–45
- **Tech comfort:** Uses apps daily, comfortable entering an API key if given
  clear instructions.
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
| **Settings** | Settings | LLM provider config, API key, dietary restrictions, preferences | ✅ MVP |

### Tab Behavior

- Tapping a tab switches the visible content area. There is no client-side
  router in MVP — tabs swap content in-place.
- The Chat tab is the default/home tab when the app launches.
- Each tab preserves its scroll position when the user switches away and back.
- The bottom nav bar is always visible (fixed to bottom of viewport).

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

#### Acceptance Criteria

- [ ] Chat messages render in a scrollable list with clear visual distinction
      between user messages and AI responses.
- [ ] AI responses stream token-by-token (not delivered all at once).
- [ ] The meal type and meal size controls are visible in the chat view (e.g.,
      as pill selectors or a collapsible toolbar above the input).
- [ ] Changing meal type or meal size does **not** add a visible message to
      the chat. These values are injected into the LLM's system prompt
      behind the scenes.
- [ ] The system prompt includes: the selected meal type, the selected meal
      size, and a base persona prompt establishing the AI as a friendly,
      knowledgeable cooking guru.
- [ ] The input field auto-focuses on the Chat tab (when no conversation
      is active, focus the input; when a conversation exists, show the input
      at the bottom).
- [ ] The chat auto-scrolls to the latest message as the AI streams a
      response.
- [ ] A "New Chat" button is accessible (e.g., in the chat header) and
      confirms before clearing if a conversation is in progress.
- [ ] If the LLM API key is not configured, the chat view shows a clear
      message directing the user to Settings, with a tap-to-navigate action.
- [ ] If the LLM request fails (network error, invalid key, rate limit), an
      inline error message appears with a "Retry" option.
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

### 4.2 LLM Provider & Model Selection

#### Description

The user configures their preferred LLM inference provider and model in the
Settings page. The app uses the `@clinebot/*` package suite for
provider-agnostic LLM integration. The user provides their own API key, which
is stored on-device.

#### User Stories

| ID | Story |
| --- | --- |
| **LLM-1** | As a user, I can select my LLM provider from a list of supported providers on the Settings page. |
| **LLM-2** | As a user, I can select a specific model from the chosen provider. |
| **LLM-3** | As a user, I can enter and save my API key for the selected provider. |
| **LLM-4** | As a user, I can see whether my API key is configured (without displaying the full key) — e.g., "API key: ••••••7f3a". |
| **LLM-5** | As a user, I can clear/change my API key. |
| **LLM-6** | As a user, I can test my configuration by sending a quick test message from Settings (optional but nice-to-have for MVP). |

#### Acceptance Criteria

- [ ] Provider selection uses a dropdown or selection list populated from
      `@clinebot/llms` supported providers.
- [ ] Model selection updates dynamically based on the selected provider.
- [ ] The API key is stored in localStorage via the existing storage layer
      (using key prefix `chefness:settings:*` — see ARCHITECTURE.md for
      storage conventions).
- [ ] The API key is **never** logged to the console or included in error
      reports.
- [ ] Settings persist across app restarts (localStorage).
- [ ] If no provider/model/API key is configured, the Chat tab shows a
      clear setup prompt (see CH acceptance criteria).
- [ ] Chatting with the LLM requires an internet connection. If offline,
      the chat view shows "You're offline. Chat requires an internet
      connection." The rest of the app works offline.

#### Storage Keys

| Key | Value |
| --- | --- |
| `chefness:settings:llm-provider` | Provider identifier string |
| `chefness:settings:llm-model` | Model identifier string |
| `chefness:settings:llm-api-key` | API key string |

### 4.3 Settings Page (MVP Scope)

#### Description

The Settings page is the configuration hub. In MVP, it contains only the LLM
provider/model/API key configuration (see §4.2). Future additions (dietary
restrictions, AI memory) are described in §5.

#### User Stories

| ID | Story |
| --- | --- |
| **SET-1** | As a user, I can navigate to the Settings tab and see all configurable options clearly organized. |
| **SET-2** | As a user, I see section headers grouping related settings (e.g., "AI Configuration"). |

#### Acceptance Criteria

- [ ] The Settings page has a clear header: "Settings".
- [ ] Settings are organized into labeled sections.
- [ ] MVP section: **AI Configuration** — contains provider selector, model
      selector, API key input (see §4.2).
- [ ] Future sections (Dietary Restrictions, AI Memory) are **not shown** in
      MVP — no empty placeholders or "coming soon" labels.
- [ ] All settings save immediately on change (no "Save" button needed).
- [ ] The page is scrollable if content exceeds the viewport.

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
- [x] Empty state in Recipes tab: "No saved recipes yet. Chat with your
      cooking guru and save recipes you like!"

### 5.2 Share Recipes

#### Description

Users can copy a saved recipe to the clipboard as formatted Markdown text.

#### User Stories

| ID | Story |
| --- | --- |
| **SH-1** | As a user, I can tap a "Share" or "Copy" button on a saved recipe to copy it to my clipboard as Markdown. |
| **SH-2** | As a user, I see a brief confirmation (e.g., "Copied!") after the copy action. |

#### Acceptance Criteria

- [x] The share button is available on the recipe detail view.
- [x] The Markdown output includes: title (as `#`), description, ingredients
      (as bullet list), steps (as numbered list).
- [x] Uses the Clipboard API (`navigator.clipboard.writeText`).
- [x] Graceful fallback or error message if Clipboard API is unavailable.

### 5.3 Cooking Log & History

#### Description

Users can log that they cooked a meal at the end of a cooking session
conversation. Logged meals appear in the History tab and are used to give the
AI context about recent meals.

#### User Stories

| ID | Story |
| --- | --- |
| **HL-1** | As a user, at the end of a chat conversation (or at any point), I see an "I cooked this!" button when the AI has provided a recipe. |
| **HL-2** | As a user, when I tap "I cooked this!", the meal is added to my cooking log with today's date. |
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
> - "I Cooked This!" title is auto-populated from the first non-empty line of
>   the assistant message, stripped of Markdown formatting (resolves open
>   question #4). No LLM call required.
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

The app uses the following packages for provider-agnostic LLM integration:

| Package | Version | Purpose |
| --- | --- | --- |
| `@clinebot/llms` | 0.0.32 | Config-driven SDK for selecting, extending, and instantiating LLM providers and models. **Browser build used for provider/model registry only** (`getAllProviders`, `getModelsForProvider`, `toProviderConfig`). |
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
    ChatView.tsx                 Chat UI: message list, input, meal type/size pills, empty states, error handling, streaming display, Save Recipe button, "I Cooked This!" button (Phase 3), "Save to Memory" button (Phase 4)
    HistoryView.tsx              History tab: reverse-chronological cooking log list with inline rating, comment, delete (Phase 3)
    HomePage.tsx                 Tab content switching + recipe tab navigation (list/detail/edit via selectedRecipeId + recipeViewMode state)
    RecipeDetailView.tsx         Full recipe display with ingredients, steps, back/edit/delete/copy buttons (Phase 2)
    RecipeEditView.tsx           Edit form for recipes — title, description, ingredients, steps as textareas (Phase 2)
    RecipeListView.tsx           Recipe card list for Recipes tab, with empty/loading/error states (Phase 2)
    SettingsView.tsx             AI Configuration, Dietary Restrictions (chips + freeform), AI Memory (preference list + add/delete)
  hooks/
    useAiPreferences.ts         AI preferences CRUD hook (Phase 4)
    useChat.ts                  Chat state management, LLM streaming via fetch(), system prompt construction with meal type/size, recent history, dietary restrictions, AI preferences
    useClipboard.ts             Reusable clipboard hook: copyToClipboard, copied (2s timer), error (Phase 2)
    useCookingLog.ts            Cooking log CRUD hook with recentEntries (last 7 days) convenience getter (Phase 3)
    useRecipes.ts               Recipe CRUD with createRecipeAsync/updateRecipeAsync for reliable awaitable mutations
    useSettings.ts              Settings singleton CRUD via tRPC, convenience getters (isConfigured, llmProvider, dietaryRestrictions, etc.)
  lib/
    llm-stream.ts               Browser-compatible LLM streaming + non-streaming tool/function calling client. Supports OpenAI-compatible and Anthropic native APIs.
    preference-extractor.ts     Preference extraction via callWithTools with save_preference tool (Phase 4)
    recipe-extractor.ts         Thin wrapper around callWithTools with save_recipe tool definition (Phase 2)
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
  types/
    ai-preference.ts            AiPreference, CreateAiPreferenceInput, UpdateAiPreferenceInput Zod schemas (Phase 4)
    cooking-log.ts              CookingLogEntry, CreateCookingLogInput, UpdateCookingLogInput Zod schemas (Phase 3)
    settings.ts                 Settings Zod schemas (settingsSchema with dietaryRestrictions + otherDietaryNotes, createSettingsInput, updateSettingsInput)
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
| Chat view | `src/components/ChatView.tsx` | ✅ Full chat UI with message list, text input, send button, meal type/size pill selectors, empty state with suggested prompts, error display, streaming display. |
| Chat hook | `src/hooks/useChat.ts` | ✅ Conversation state management, LLM streaming via `fetch()` (not `@clinebot/agents`), system prompt construction with meal type/size, offline detection. |
| LLM streaming client | `src/lib/llm-stream.ts` | ✅ Browser-compatible SSE streaming client. Supports OpenAI-compatible and Anthropic native APIs via direct `fetch()` calls. |
| Settings view | `src/components/SettingsView.tsx` | ✅ AI Configuration section: provider dropdown, model dropdown (both from `@clinebot/llms` registry), API key input with masked display. |
| Settings hook | `src/hooks/useSettings.ts` | ✅ Settings singleton CRUD via tRPC, convenience getters (`isConfigured`, `llmProvider`, etc.). |
| Settings storage | `src/storage/settings.ts`, `src/types/settings.ts` | ✅ Zod schemas + storage repository singleton (key: `chefness:settings`). |
| Settings tRPC router | `src/trpc/router.ts` | ✅ Added `settings.get` and `settings.update` procedures to existing router. |

---

## 7. MVP Scope Summary

A clear checklist of everything included in v1:

### ✅ In MVP

- [x] **Bottom nav bar** with 4 tabs: Chat, Recipes, History, Settings
- [x] **Tab switching** — tapping a tab shows its content; Chat is default
- [x] **Chat view** — full chat UI with message list, text input, send button
- [x] **AI streaming responses** — token-by-token rendering in chat bubbles
- [x] **Meal type selector** — breakfast / lunch / dinner / snack / dessert
- [x] **Meal size selector** — cooking for 1 / 2 / 4 / 6+
- [x] **System prompt** — base cooking guru persona + meal type + meal size
- [x] **New Chat button** — clears current conversation and starts fresh
- [x] **Empty chat state** — suggested prompt bubbles for quick start
- [x] **Error handling in chat** — network errors, invalid API key, offline state
- [x] **Settings page** — AI Configuration section
- [x] **LLM provider selector** — populated from `@clinebot/llms`
- [x] **LLM model selector** — updates based on selected provider
- [x] **API key input** — masked display, save, clear, stored in localStorage
- [x] **Offline detection** — chat shows offline message; rest of app works
- [x] **Recipes tab** — empty state placeholder ("Coming soon" or similar)
- [x] **History tab** — empty state placeholder ("Coming soon" or similar)
- [x] **Mobile-first responsive layout** — usable at 375px width minimum

### ✅ Phase 2 (Complete)

- [x] **Save Recipe from Chat** — user-triggered LLM extraction via native tool calling
- [x] **Recipe List View** — scrollable card list in Recipes tab with empty/loading states
- [x] **Recipe Detail View** — kitchen-friendly full recipe display (large text, ingredients bullet list, numbered steps)
- [x] **Recipe Edit & Delete** — edit form with pre-populated fields, delete with confirmation
- [x] **Share Recipe as Markdown** — copy-to-clipboard with `navigator.clipboard.writeText`

### ✅ Phase 3 (Complete)

- [x] **Cooking Log** — "I Cooked This!" button in Chat, auto-populated title from first line
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
edit, and delete flows plus copy-to-clipboard sharing.

1. ~~**Save Recipe from Chat** (§5.1) — Recipe detection, parsing, save action~~
2. ~~**Recipe List View** — Browse saved recipes in the Recipes tab~~
3. ~~**Recipe Detail View** — Full recipe display with kitchen-friendly layout~~
4. ~~**Recipe Edit & Delete** — Modify or remove saved recipes~~
5. ~~**Share Recipe as Markdown** (§5.2) — Copy to clipboard~~

### Phase 3 — Cooking History ✅ Complete

All 4 Phase 3 items have been implemented. The History tab is now fully functional
with cooking log entries, inline rating/comments, and AI context injection.

6. ~~**Cooking Log** (§5.3) — "I cooked this!" action in chat~~
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

### MVP Status: ✅ Complete

All MVP features from §7 have been implemented. The app is a fully functional
mobile-first PWA with AI chat, settings configuration, and placeholder tabs for
future features. See §6 for the complete file structure and §7 for the checked-off
feature list.

### Key Architectural Decisions

The following decisions were made during MVP implementation. Future agents must
understand these to avoid re-discovering limitations or breaking existing patterns.

#### a) @clinebot/* packages: browser limitations

- `@clinebot/llms` browser build exports the model/provider **registry** (`getAllProviders`, `getModelsForProvider`, `toProviderConfig`) but does **NOT** export `createHandler`/`createHandlerAsync`. These require Node.js because they dynamically import provider SDKs (`openai`, `@anthropic-ai/sdk`, etc.) which depend on Node builtins.
- `@clinebot/agents` `Agent` class is **NOT usable in the browser** because it depends on `createHandler` internally.
- **Decision:** We use `@clinebot/llms` for provider/model metadata only. Actual LLM communication uses a custom browser-compatible streaming client (`src/lib/llm-stream.ts`) that makes direct `fetch()` calls with SSE parsing.
- The `@clinebot/agents` and `@clinebot/core` packages are installed but unused at runtime. They could be removed from dependencies if desired, but they don't affect bundle size since they're tree-shaken out.

#### b) LLM streaming: fetch-based SSE client

- `src/lib/llm-stream.ts` implements streaming for two protocols:
  - **OpenAI-compatible:** POST to `{baseUrl}/chat/completions` with `stream:true` (covers ~80% of providers: OpenAI, OpenRouter, Groq, Together, Fireworks, DeepSeek, etc.)
  - **Anthropic native:** POST to `{baseUrl}/messages` with `stream:true`, using `x-api-key` header and `anthropic-version` header
- Provider base URL is resolved using `toProviderConfig()` from `@clinebot/llms` browser build.
- **Google Gemini native API is NOT yet supported** (would need a different endpoint/format). Users can access Gemini via OpenRouter or other proxies.

#### c) Settings reactivity pattern

- `SettingsView` uses local component state (`selectedProvider`, `selectedModel`, `localApiKey`) that syncs with the `useSettings` hook on load but **leads** during user interaction. This avoids the async tRPC mutation round-trip delay that would cause dropdowns to snap back to old values.
- **This pattern should be followed** for any future Settings fields that need immediate UI feedback.

#### d) Tab switching: no router

- Navigation uses simple `useState` in `HomePage.tsx`. No client-side router library. Tabs swap content in-place.
- Chat tab is default on launch.

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
| Share as Markdown | `src/lib/recipe-markdown.ts` | ✅ Pure function `recipeToMarkdown(recipe)` — converts Recipe to Markdown text. |
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

- `HomePage.tsx` manages `selectedRecipeId` + `recipeViewMode` state (`list` | `detail` | `edit`) for navigation within the Recipes tab.
- No router needed — the same `useState`-based pattern from MVP (decision d) is extended.
- The Recipes tab renders `RecipeListView`, `RecipeDetailView`, or `RecipeEditView` based on the current state.

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
| "I Cooked This!" button | `src/components/ChatView.tsx` | ✅ Added alongside Save Recipe button. Uses first-line title extraction (no LLM call). |
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
| Provider list | Potentially curated subset | All providers from `getAllProviders()` | Maximizes user choice; user enters their own API key |
| Recipe extraction | Regex-based detection + heuristic parser | User-triggered LLM extraction via native tool calling | More reliable; user controls what to save; LLM understands its own output |
| Dietary restrictions storage | Separate key `chefness:settings:dietary-restrictions` | Part of settings singleton (`chefness:settings`) | Simpler; one entity to manage |
| AI Memory save flow | AI-only detection | AI detection + manual add in Settings | More user control; resolves open question #5 |

---

## 10. Open Questions

| # | Question | Impact | Status |
| --- | --- | --- | --- |
| 1 | Which `@clinebot/llms` providers/models should be available by default? Do we show all supported providers or a curated subset? | LLM-1, LLM-2 | ✅ **Resolved** — All providers from `getAllProviders()` are shown. The user selects their provider and enters their own API key. |
| 2 | Should the API key be stored as plaintext in localStorage or lightly obfuscated? | LLM-3 | ✅ **Resolved** — Plaintext in localStorage (same as all other settings). No obfuscation for MVP. Acceptable given the single-user, no-server architecture. |
| 3 | What heuristic or mechanism detects that an AI response contains a recipe vs. general conversation? Options: (a) structured output / tool call from the LLM, (b) regex-based detection, (c) a follow-up LLM call to classify. | SR-1 | ✅ **Resolved** — No auto-detection. User taps "Save Recipe" on any assistant message. The app uses native LLM tool/function calling (`callWithTools` with a `save_recipe` tool definition) to extract structured recipe data. This avoids fragile regex heuristics and gives provider-enforced structured output. |
| 4 | Should the "I cooked this!" action auto-populate the title from the recipe, or let the user name it? | HL-2 | ✅ **Resolved** — Auto-populated from the first non-empty line of the assistant message, stripped of Markdown formatting. Editable later in the History tab. |
| 5 | For AI Memory (DR-3), should the AI proactively suggest saving preferences, or should there also be a manual "Remember this" button the user can press? | DR-3 | ✅ **Resolved** — Both. The AI proactively suggests remembering preferences via system prompt instructions, AND users can manually add preferences in the Settings > AI Memory section. |
| 6 | Is there a maximum number of chat sessions to retain before auto-pruning old ones? localStorage has a ~5–10MB limit. | CP-2 | Open — Phase 5 |
