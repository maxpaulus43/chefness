# Chefness — Architecture Guide

This document captures the design rules and structural decisions for the
Chefness codebase. It exists so that any developer (or LLM) picking up a fresh
task has the full context without needing to reverse-engineer it from code.

---

## 1. Project overview

Chefness is a **client-side-first** cooking app with an Expo/React Native iOS
app and a retained PWA build. There is **no separate application backend for
user data**. All data operations run on-device through the same local tRPC
router. iOS persists through AsyncStorage; the web build uses IndexedDB. The
repository boundary keeps business hooks and router procedures platform-neutral.

Exception: the app may include tiny stateless Cloudflare Worker API endpoints
for browser-impossible network tasks, such as fetching third-party recipe pages
that block CORS. These endpoints must not store user data and must return only
small, sanitized JSON responses.

### Tech stack

| Concern          | Library                         | Version |
| ---------------- | ------------------------------- | ------- |
| Framework        | Expo / React Native / React     | 57 / 0.86 / 19 |
| Web bundler      | Vite                            | 8       |
| Native bundler   | Metro / Hermes                  | Expo 57 |
| Language         | TypeScript (strict mode)        | 6       |
| RPC layer        | tRPC (client + server)          | 11      |
| Server state     | TanStack React Query            | 5       |
| Validation       | Zod                             | 4       |
| Package manager  | Bun                             |         |

### Platform structure

- `src/App.native.tsx` is the native entry UI; `src/App.tsx` remains the web entry.
- `src/native/` contains React Native presentation screens, shared controls,
  and the iOS navigation graph. React Navigation owns the four-tab bottom bar
  and its safe-area/accessibility behavior. Each tab remains mounted after its
  first visit, preserving expected tab state. Native stacks provide standard
  headers, transitions, and edge swipe-back for recipe list/detail/edit.
  Chat history, message editing, and model selection are stack-presented iOS
  form sheets. Chat uses frame-based keyboard avoidance with no hard-coded
  vertical offset so its composer follows the keyboard correctly.
- `src/native/navigation-routes.ts` is the typed route/deep-link contract.
  The `chefness://` scheme resolves recipe IDs, chat-session IDs, history,
  settings, and model selection to nested tab/stack destinations. The retained
  web app continues to use its existing in-place navigation.
- Metro resolves `.native.ts` before `.ts`. This supplies native implementations
  of persistence (`indexed-db.native.ts`), UUID generation, and OpenRouter
  streaming without branching the shared hooks/router/domain model.
- `index.js`, `app.json`, `babel.config.cjs`, and `metro.config.cjs` configure Expo.
- Native OpenRouter connection uses OpenRouter's documented no-callback PKCE
  flow: S256 authorization opens in a secure browser sheet, the user copies the
  one-time code back into Chefness, and the app exchanges it locally for the key.
  `settings.native.ts` persists that key in iOS Keychain through
  `expo-secure-store`; it automatically migrates and scrubs the former
  AsyncStorage settings field. The PWA retains its normal HTTP callback flow
  and IndexedDB-backed credential storage.
- The local config plugin `plugins/with-ios-scene-lifecycle.cjs` adds the scene
  lifecycle required by the iOS 27 SDK during prebuild.
- The generated `ios/` directory is ignored; run `bunx expo prebuild --platform ios`
  when native projects need regeneration.

### Path aliases

`@/*` maps to `src/*` (configured in both `tsconfig.app.json` and
`vite.config.ts`). Always use `@/` imports — never relative `../` paths that
go more than one level up.

---

## 2. Directory structure

```
src/
  types/              Zod schemas and inferred TypeScript types
    recipe.ts         Recipe, CreateRecipeInput, UpdateRecipeInput
  storage/            Persistence layer (the abstraction boundary)
    interface.ts      StorageRepository<TEntity, TCreate, TUpdate> interface
    local-storage.ts  localStorage implementation of the interface
    recipes.ts        Instantiates and exports the recipe repository
  trpc/               RPC plumbing — procedures, client, providers
    index.ts          initTRPC instance (shared router/procedure builders)
    router.ts         appRouter — all tRPC procedures
    client.ts         In-browser tRPC client (localLink, createTRPCReact)
    provider.tsx      <TRPCProvider> — wraps app with tRPC + React Query
  hooks/              Custom React hooks — all business logic lives here
    useRecipes.ts     Recipe CRUD operations, cache invalidation
    useRecipeAiEditor.ts  AI recipe edit orchestration + preview/apply state
    useChat.ts      Chat state, LLM streaming, session persistence, and chat URL import orchestration
    useToast.ts     Access to global toast notifications and async confirmations
  contexts/           React contexts shared by hooks/providers
    toast-context.ts  Toast API types and context (`notify`, `ask`, `dismiss`)
  lib/                Pure client-side helpers for AI calls and formatting
    recipe-extractor.ts  Tool-calling recipe extraction and natural-language recipe edits
    recipe-url-extractor.ts  Client helper for same-origin Worker recipe URL extraction
  worker.ts           Stateless Cloudflare Worker API endpoints + static asset fallback
  theme.ts            Shared design tokens (colors, fonts, shadows, radii)
  index.css           Global CSS — font imports, gradient background, grain, scrollbars
  App.tsx             Root UI component (pure presentation)
  main.tsx            Entry point — renders providers around <App />
```

Reusable presentational UI lives under `src/components/`. Shared UI glyphs use
`src/components/Icon.tsx`, a small in-repo SVG icon set that inherits
`currentColor` so controls can use theme-token colors without emoji rendering
differences across platforms.

Native feedback uses React Native `Alert` and accessible modal sheets where
platform-native confirmation or selection is appropriate. Web feedback remains
provided by `src/components/ToastProvider.tsx`, mounted in
`src/main.tsx` inside the tRPC provider. Components call `useToast()` and then
`toast.notify(...)` for transient messages or `await toast.ask(...)` for custom
confirmation prompts. Do not use native `window.alert`/`window.confirm` for app
flows; the toast provider keeps confirmations styled, accessible, and reusable.

---

## 3. Layered architecture

The app has four strict layers. Data flows downward; dependencies point
downward. No layer may skip a level or reach into a layer above it.

```
┌─────────────────────────────────────────────┐
│  Components  (App.tsx, future UI files)     │  Renders UI, calls hooks
├─────────────────────────────────────────────┤
│  Hooks  (src/hooks/)                        │  Business logic, tRPC calls
├─────────────────────────────────────────────┤
│  tRPC Router  (src/trpc/router.ts)          │  Procedures, validation
├─────────────────────────────────────────────┤
│  Storage  (src/storage/)                    │  Persistence (localStorage)
└─────────────────────────────────────────────┘
```

### What each layer is allowed to import

| Layer       | May import from                                    |
| ----------- | -------------------------------------------------- |
| Components  | `src/hooks/`, `src/types/`                         |
| Hooks       | `src/trpc/client.ts`, `src/types/`, pure helpers from `src/lib/` when orchestrating AI/domain workflows |
| tRPC Router | `src/trpc/index.ts`, `src/storage/`, `src/types/`  |
| Storage     | `src/storage/interface.ts`, `src/types/`            |

### What each layer must NOT do

| Layer       | Forbidden                                                                  |
| ----------- | -------------------------------------------------------------------------- |
| Components  | Import `trpc` directly, call tRPC hooks, manage cache invalidation, read/write localStorage |
| Hooks       | Import from `src/storage/`, touch localStorage, contain JSX                |
| tRPC Router | Import React, import from `src/hooks/`, touch localStorage directly        |
| Storage     | Import tRPC, import React, know about procedures or hooks                  |

---

## 4. Rule: Components are presentation-only

Components handle **layout, styling, and user interaction**. They do not contain
business logic.

**What belongs in a component:**

- JSX / markup / styling
- Destructuring return values from hooks
- Simple event handlers that call hook-provided actions
  (e.g. `onClick={() => deleteRecipe(id)}`)
- Conditional rendering based on hook-provided state (`isLoading`, `error`)

**What does NOT belong in a component:**

- Direct `trpc.*` calls (`useQuery`, `useMutation`, `useUtils`)
- Cache invalidation logic
- Data transformation or business rules
- Direct localStorage / fetch / API calls

**Correct:**

```tsx
import { useRecipes } from "@/hooks/useRecipes";

function RecipeList() {
  const { recipes, isLoading, deleteRecipe } = useRecipes();
  // ... render UI using these values
}
```

**Wrong:**

```tsx
import { trpc } from "@/trpc/client";

function RecipeList() {
  const utils = trpc.useUtils();
  const query = trpc.recipe.list.useQuery();
  const mutation = trpc.recipe.delete.useMutation({
    onSuccess: () => void utils.recipe.list.invalidate()
  });
}
```

---

## 4a. Styling & theming

Chefness styles components with **inline `React.CSSProperties` style objects**
(a `const styles: Record<string, React.CSSProperties>` at the bottom of each
component). There is **no Tailwind / CSS-in-JS library**; only `src/index.css`
holds global rules (font imports, the cream gradient `body` background, the
grain overlay, and custom scrollbars).

**Design system — "warm kitchen glassmorphism".** All visual tokens live in a
single source of truth at **`src/theme.ts`**, which exports:

| Export    | Purpose                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `colors`  | Palette — `cream`, `espresso` (text), `saffron` (primary accent), `rose`/`roseText` (destructive & "AI" accents), warm `stone*` neutrals, translucent `glass*` surfaces, and `*Tint`/status colors |
| `fonts`   | `serif` (Fraunces — used for headings/titles) and `sans` (Inter — body) |
| `shadows` | `glass`, `glassLg`, `glassXl` — soft layered card shadows                |
| `radii`   | `sm`/`md`/`lg`/`xl`/`pill` corner radii                                  |

**Conventions:**

- Import tokens via `import { colors, fonts, shadows, radii } from "@/theme";`.
  Never hardcode hex colors in component style objects — reference a token.
- Screen titles (`<h1>`) and section headings use `fontFamily: fonts.serif`.
- Card-like surfaces use `colors.glass` background, a `colors.glassBorder`
  border, and a `shadows.glass*` shadow for the translucent "frosted" look.
- Primary actions use `colors.saffron`; destructive actions use the
  `danger`/`rose` tokens. Active chips/tabs are saffron-tinted.
- Interactive glyphs use `<Icon />` from `src/components/Icon.tsx` instead of
  emojis. Icons should be decorative (`aria-hidden`) when adjacent to visible
  text, or paired with an `aria-label` on icon-only controls.
- The app shell (`HomePage`) is a centered `max-width: 480px` mobile column;
  the bottom nav and chat header/composer use blurred translucent bars.

When adding UI, extend `src/theme.ts` rather than introducing new ad-hoc colors.

---

## 5. Rule: Hooks own all business logic

Every domain entity gets a custom hook in `src/hooks/` (e.g. `useRecipes`).
The hook:

1. Calls the tRPC React hooks (`useQuery`, `useMutation`).
2. Wires up cache invalidation in `onSuccess` callbacks.
3. Returns a **flat object** of data, status flags, and action functions.
4. Uses `as const` on the return for maximal type narrowing.

### Return value conventions

| Kind    | Naming                  | Examples                                    |
| ------- | ----------------------- | ------------------------------------------- |
| Data    | Plural noun / noun      | `recipes`, `recipe`, `error`                |
| Status  | `is` + participle       | `isLoading`, `isCreating`, `isDeleting`     |
| Actions | Verb + noun (camelCase) | `createRecipe(data)`, `deleteRecipe(id)`    |

Action functions accept **domain types** (`CreateRecipeInput`, `string` for ID)
— never raw tRPC input shapes. This keeps the component layer decoupled from
the RPC schema.

---

## 6. Rule: Storage is interface-driven and async

### The interface

`src/storage/interface.ts` defines `StorageRepository<TEntity, TCreate, TUpdate>`
with five methods: `getAll`, `getById`, `create`, `update`, `delete`. **Every
method returns a `Promise`**, even though the current localStorage
implementation is synchronous. This means swapping to an async backend (HTTP,
IndexedDB, etc.) requires zero changes to any call site.

### The implementations

Entity repositories import `src/storage/indexed-db.ts`. Platform resolution
selects the appropriate implementation:

- Web: `indexed-db.ts` stores entities in IndexedDB.
- Native: `indexed-db.native.ts` stores the same entity arrays in AsyncStorage.

Both implement the same async `StorageRepository`, so routers, hooks, validation,
and cache invalidation are shared unchanged. `local-storage.ts` and the one-time
web migration helper remain only for upgrading older PWA installations.

### Entity wiring

Each entity gets a file in `src/storage/` (e.g. `recipes.ts`) that:

1. Imports the interface type and the `LocalStorageRepository` class.
2. Exports a typed alias (e.g. `RecipeRepository`).
3. Exports a singleton instance with entity-specific configuration
   (`storageKey`, `buildEntity`, `applyUpdate`).

The repository is responsible for generating `id`, `createdAt`, and `updatedAt`
inside `buildEntity` — the tRPC router just passes user input through.

Native and web records are intentionally device-local and are not synchronized.
On iOS, non-secret settings remain in AsyncStorage while the OpenRouter OAuth key
is stored separately in iOS Keychain by the native settings repository. Repository
reads hydrate the key in memory for existing hooks, while writes strip it from the
AsyncStorage record. The repository performs an idempotent one-time migration of
legacy plaintext keys before any settings operation. The web target continues to
store its credential in the IndexedDB settings record.

### How to swap to a real backend

1. Create a new class (e.g. `HttpRecipeRepository`) that
   `implements StorageRepository<Recipe, CreateRecipeInput, UpdateRecipeInput>`
   and makes `fetch()` calls.
2. In `src/storage/recipes.ts`, change the instantiation from
   `new LocalStorageRepository(…)` to `new HttpRecipeRepository(…)`.
3. Nothing else changes. The router, hooks, and components are unaffected.

---

## 7. Rule: tRPC is the app data RPC boundary

### In-browser operation

tRPC runs entirely in the browser for Chefness app data. There is no HTTP server
for recipes, settings, cooking log entries, preferences, or chat sessions. The
client uses `unstable_localLink` from `@trpc/client` to call the router directly
in the same JS context. The tRPC instance is initialized with
`allowOutsideOfServer: true` and `isServer: false`.

### OpenRouter-only LLM configuration

Chefness uses OpenRouter as its sole LLM provider. Users connect through the
OpenRouter OAuth PKCE flow and select an OpenRouter model in Settings. The
former manual provider/API-key configuration UI has been removed. Legacy
`llmProvider` and `llmApiKey` fields remain readable in the settings schema so
existing persisted records still parse, but runtime credential resolution
ignores them and always uses the OpenRouter OAuth key.

`src/lib/openrouter-models.ts` fetches and runtime-validates OpenRouter's public
`/api/v1/models` catalog. `useOpenRouterModels` owns catalog loading, errors,
and combined filters. A model is free when both prompt and completion prices
are zero, supports vision when `image` is an input modality, and supports tools
when `tools` is listed in `supported_parameters`. The default is the stable
`openrouter/free` router rather than a specific free model that may disappear.

For vision-capable selected models, Chat exposes an image attachment control.
`useImageAttachment` delegates resizing/encoding to
`src/lib/image-attachment.ts`; photos from the device camera or image library
are resized to a maximum 1600px dimension and JPEG-encoded before being
persisted on the user message. The
streaming client sends these images to OpenRouter as OpenAI-compatible
`image_url` content parts. Models without `image` in their input modalities do
not show the attachment control.

### Stateless Worker endpoints

`src/worker.ts` is the Cloudflare Worker entry point configured by
`wrangler.jsonc`. It handles small `/api/*` endpoints that cannot be implemented
reliably in browser JavaScript, then falls back to `env.ASSETS.fetch(request)`
for the static PWA.

Current endpoint:

- `POST /api/extract-recipe-url` — fetches a public recipe URL server-side,
  extracts schema.org JSON-LD `Recipe` data, and returns normalized recipe JSON.

Chat URL imports are orchestrated in `useChat`: a URL-only/import-only user
message bypasses the LLM path and saves via
the existing recipe hook, and appends a local assistant success/error message.
The web helper calls the same-origin Worker to bypass browser CORS; the
`.native.ts` helper fetches and parses schema.org JSON-LD directly on-device,
where browser CORS does not apply. When a URL appears inside a broader
conversational instruction, `useChat`
extracts the recipe, stores formatted recipe data as hidden
`importedRecipeContext` on the visible user message, sends that context to the
LLM, and persists it in the chat session so later "Save Current Recipe"
extraction can reconstruct the edited recipe.

Worker endpoint rules:

- No user data persistence.
- No database, KV, Durable Object, or queue usage unless explicitly documented.
- Dependency-free or minimal dependencies only.
- Validate URLs and reject localhost/private-network targets where practical.
- Time out remote fetches and cap response size.
- Never proxy arbitrary remote HTML back to the browser; return sanitized JSON
  or a small error payload.

### Procedure conventions

- Every procedure has explicit `.input()` and `.output()` Zod schemas.
- All procedure resolvers are `async` — they `await` the repository.
- Procedures delegate to the storage repository — they do not contain
  persistence logic or touch localStorage.

### Router structure

The router is organized by entity with sub-routers:

```ts
export const appRouter = router({
  recipe: recipeRouter,
  // mealPlan: mealPlanRouter,  ← future entities follow the same pattern
});
```

`AppRouter` is exported from `src/trpc/router.ts` and used as the generic
parameter for `createTRPCReact<AppRouter>()` and
`createTRPCClient<AppRouter>()`. This is the single source of type truth for
the entire client.

---

## 8. Rule: Types are Zod-first

All data types are defined as **Zod schemas first**, with TypeScript types
inferred via `z.infer<>`. Do not write standalone TypeScript interfaces for
data shapes that also need runtime validation — define the Zod schema and
infer the type.

```ts
// ✅ Correct
export const recipeSchema = z.object({ ... });
export type Recipe = z.infer<typeof recipeSchema>;

// ❌ Wrong — duplicates the shape, can drift
export interface Recipe { ... }
```

Type files live in `src/types/` and are importable from any layer.

---

## 9. Naming conventions

| Kind                | Convention              | Example                              |
| ------------------- | ----------------------- | ------------------------------------ |
| Files               | kebab-case              | `local-storage.ts`                   |
| React components    | PascalCase              | `RecipeList`                         |
| Custom hooks        | `use` + PascalCase noun | `useRecipes`                         |
| Zod schemas         | camelCase               | `recipeSchema`, `createRecipeInput`  |
| TypeScript types    | PascalCase              | `Recipe`, `CreateRecipeInput`        |
| tRPC procedures     | camelCase verb/noun     | `recipe.list`, `recipe.create`       |
| localStorage keys   | `chefness:` prefix      | `chefness:recipes`                   |

---

## 10. Checklist: adding a new feature end-to-end

Suppose you're adding a "Shopping List" feature:

1. **Types** → `src/types/shopping-list.ts`
   - Define `shoppingListSchema`, `createShoppingListInput`,
     `updateShoppingListInput`.
   - Export inferred TS types.

2. **Storage** → `src/storage/shopping-lists.ts`
   - Import `LocalStorageRepository` and `StorageRepository` interface.
   - Export a `shoppingListRepository` singleton with
     `storageKey: "chefness:shopping-lists"`.

3. **Router** → add a `shoppingList` sub-router in `src/trpc/router.ts`
   - Define `list`, `getById`, `create`, `update`, `delete` procedures.
   - Wire to `shoppingListRepository`.
   - Add to `appRouter`.

4. **Hook** → `src/hooks/useShoppingLists.ts`
   - Call the tRPC procedures.
   - Handle cache invalidation.
   - Return data + status + actions.
   - For AI-assisted workflows, keep provider/settings/status orchestration in
     the hook and delegate pure LLM tool-calling transforms to `src/lib/`.

5. **Component** → use the hook in your component
   - Import `useShoppingLists`.
   - Render UI. No tRPC imports, no storage imports.
