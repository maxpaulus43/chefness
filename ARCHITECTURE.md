# Chefness — Architecture Guide

This document captures the design rules and structural decisions for the
Chefness codebase. It exists so that any developer (or LLM) picking up a fresh
task has the full context without needing to reverse-engineer it from code.

---

## 1. Project overview

Chefness is a **client-side-first** cooking app (PWA, offline-first). All data
operations still run in-browser through tRPC, but persistence is scoped by
identity: signed-out guests use IndexedDB and signed-in users use private Cloud
Firestore collections with persistent offline caching. There is no separate
Chefness application API server.

Exception: the app may include tiny stateless Cloudflare Worker API endpoints
for browser-impossible network tasks, such as fetching third-party recipe pages
that block CORS. These endpoints must not store user data and must return only
small, sanitized JSON responses.

### Firebase Authentication and Firestore

Firebase Authentication is connected for account identity only. Google and
email/password sign-in, account creation, verification email, password reset,
session restoration, sign-out, and reauthentication are implemented with the
modular Firebase web SDK. Account deletion is disabled until recursive trusted
cloud cleanup is available.

- `src/lib/firebase.ts` initializes the Firebase app and Auth persistence from
  `VITE_FIREBASE_*` environment variables. Analytics is intentionally disabled.
- `src/auth/auth-context.ts` defines the provider-neutral component contract.
- `src/auth/FirebaseAuthProvider.tsx` is the only module that calls Firebase Auth.
- Components access authentication only through `src/hooks/useAuth.ts`.
- `AuthChoiceView`, `AuthDialog`, and `AccountSettings` remain UI/orchestration
  components and do not import Firebase SDKs.
- Guest choice is device-local under `chefness:auth:onboarding`.

Signed-in recipes, history, preferences, chats, and non-secret settings use
Firestore paths under `users/{uid}`. API and OAuth keys are never written to
Firestore; they use UID-scoped IndexedDB records. Guests continue using the
existing IndexedDB collections. A one-time confirmed import creates a read-only
local recovery snapshot, writes and verifies cloud records, then clears active
guest records.

Firestore rules are deny-by-default, enforce UID ownership, whitelist document
fields, and explicitly reject secret settings fields. Account deletion and full
Firestore disk-cache cleanup remain disabled until their planned trusted cleanup
flow is implemented.

The target architecture and progress checklist live in
[`FIREBASE_MIGRATION_PLAN.md`](./FIREBASE_MIGRATION_PLAN.md).

### Tech stack

| Concern          | Library                         | Version |
| ---------------- | ------------------------------- | ------- |
| Framework        | React                           | 19      |
| Language         | TypeScript (strict mode)        | 6       |
| Bundler          | Vite                            | 8       |
| RPC layer        | tRPC (client + server)          | 11      |
| Server state     | TanStack React Query            | 5       |
| Validation       | Zod                             | 4       |
| Package manager  | Bun                             |         |

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
    indexed-db.ts     Guest storage and local-only device records
    firestore.ts      Generic signed-in Firestore repository
    scoped-repository.ts  Chooses guest or signed-in persistence
    guest-import.ts   Snapshot, upload, verification, and guest cleanup
    recipes.ts        Instantiates scoped recipe repositories
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

Global feedback UI is provided by `src/components/ToastProvider.tsx`, mounted in
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
│  Storage  (src/storage/)                    │  IndexedDB / Firestore
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
method returns a `Promise`**, matching both IndexedDB and Firestore without
changing call sites.

### Implementations and scoping

- `IndexedDBRepository` stores signed-out guest entities and local-only data.
- `FirestoreRepository` stores signed-in entities below `users/{uid}`.
- `ScopedRepository` selects the implementation from settled Firebase Auth
  state for every operation.
- The app is gated during Auth restoration and React Query caches are cleared
  before identity scopes change, preventing guest/user cache bleed.
- Firestore uses persistent multi-tab local cache. Reads and writes continue
  offline and queued writes sync after reconnection.
- No Firestore snapshot listeners are used. Queries refetch on startup, focus,
  reconnect, and after mutations.

Each entity module shares its `buildEntity` and `applyUpdate` functions between
its IndexedDB and Firestore repositories. Repositories continue generating IDs
and ISO timestamps; tRPC only validates and delegates.

### Settings partition

The domain `Settings` value is composed from two stores:

- Firestore `users/{uid}/settings/app`: provider, model, dietary restrictions,
  and dietary notes.
- IndexedDB `local-credentials` keyed by Firebase UID: LLM API key and
  OpenRouter OAuth key.

Guest settings remain a single IndexedDB entity. Security rules whitelist cloud
settings fields so an accidental secret write is rejected independently of the
client.

### Guest import

`guest-import.ts` detects existing guest records once per UID, saves a versioned
read-only recovery snapshot, uploads stable IDs in bounded batches, waits for
server acknowledgement, verifies cloud IDs/counts, records the decision, and
only then clears active guest stores. Failed imports retain local data and can be
retried.

---

## 7. Rule: tRPC is the app data RPC boundary

### In-browser operation

tRPC runs entirely in the browser for Chefness app data. There is no HTTP server
for recipes, settings, cooking log entries, preferences, or chat sessions. The
client uses `unstable_localLink` from `@trpc/client` to call the router directly
in the same JS context. The tRPC instance is initialized with
`allowOutsideOfServer: true` and `isServer: false`.

### Stateless Worker endpoints

`src/worker.ts` is the Cloudflare Worker entry point configured by
`wrangler.jsonc`. It handles small `/api/*` endpoints that cannot be implemented
reliably in browser JavaScript, then falls back to `env.ASSETS.fetch(request)`
for the static PWA.

Current endpoint:

- `POST /api/extract-recipe-url` — fetches a public recipe URL server-side,
  extracts schema.org JSON-LD `Recipe` data, and returns normalized recipe JSON.

Firebase Hosting is configured for temporary static preview channels using
`dist/client`, SPA fallback, and a no-cache service-worker header. It does not
yet rewrite `/api/extract-recipe-url`, so URL imports are expected to fail on
Firebase previews. Cloudflare remains the endpoint/production-hosting platform.

Chat URL imports are orchestrated in `useChat`: a URL-only/import-only user
message bypasses the LLM path, calls `src/lib/recipe-url-extractor.ts`, saves via
the existing recipe hook, and appends a local assistant success/error message.
When a URL appears inside a broader conversational instruction, `useChat`
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
| IndexedDB stores    | kebab-case              | `chat-sessions`                      |

---

## 10. Checklist: adding a new feature end-to-end

Suppose you're adding a "Shopping List" feature:

1. **Types** → `src/types/shopping-list.ts`
   - Define `shoppingListSchema`, `createShoppingListInput`,
     `updateShoppingListInput`.
   - Export inferred TS types.

2. **Storage** → `src/storage/shopping-lists.ts`
   - Define shared entity builder/update functions.
   - Instantiate IndexedDB and Firestore repositories.
   - Export them through `ScopedRepository`.

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
