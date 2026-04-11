# Chefness — Architecture Guide

This document captures the design rules and structural decisions for the
Chefness codebase. It exists so that any developer (or LLM) picking up a fresh
task has the full context without needing to reverse-engineer it from code.

---

## 1. Project overview

Chefness is a **fully client-side** cooking app (PWA, offline-first). There is
**no separate backend server**. All data operations run in-browser via tRPC with
localStorage as the current persistence layer. The architecture is designed so
that localStorage can be swapped for a real remote backend without changing any
UI code.

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
    local-storage.ts  localStorage implementation of the interface
    recipes.ts        Instantiates and exports the recipe repository
  trpc/               RPC plumbing — procedures, client, providers
    index.ts          initTRPC instance (shared router/procedure builders)
    router.ts         appRouter — all tRPC procedures
    client.ts         In-browser tRPC client (localLink, createTRPCReact)
    provider.tsx      <TRPCProvider> — wraps app with tRPC + React Query
  hooks/              Custom React hooks — all business logic lives here
    useRecipes.ts     Recipe CRUD operations, cache invalidation
  App.tsx             Root UI component (pure presentation)
  main.tsx            Entry point — renders providers around <App />
```

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
| Hooks       | `src/trpc/client.ts`, `src/types/`                 |
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

### The implementation

`src/storage/local-storage.ts` contains `LocalStorageRepository` — a class that
implements the interface. It is the **only file in the entire codebase that
touches `window.localStorage`**. No other file may call `localStorage.getItem`,
`localStorage.setItem`, or `localStorage.removeItem`.

### Entity wiring

Each entity gets a file in `src/storage/` (e.g. `recipes.ts`) that:

1. Imports the interface type and the `LocalStorageRepository` class.
2. Exports a typed alias (e.g. `RecipeRepository`).
3. Exports a singleton instance with entity-specific configuration
   (`storageKey`, `buildEntity`, `applyUpdate`).

The repository is responsible for generating `id`, `createdAt`, and `updatedAt`
inside `buildEntity` — the tRPC router just passes user input through.

### How to swap to a real backend

1. Create a new class (e.g. `HttpRecipeRepository`) that
   `implements StorageRepository<Recipe, CreateRecipeInput, UpdateRecipeInput>`
   and makes `fetch()` calls.
2. In `src/storage/recipes.ts`, change the instantiation from
   `new LocalStorageRepository(…)` to `new HttpRecipeRepository(…)`.
3. Nothing else changes. The router, hooks, and components are unaffected.

---

## 7. Rule: tRPC is the RPC boundary

### In-browser operation

tRPC runs entirely in the browser. There is no HTTP server. The client uses
`unstable_localLink` from `@trpc/client` to call the router directly in the
same JS context. The tRPC instance is initialized with
`allowOutsideOfServer: true` and `isServer: false`.

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

5. **Component** → use the hook in your component
   - Import `useShoppingLists`.
   - Render UI. No tRPC imports, no storage imports.
