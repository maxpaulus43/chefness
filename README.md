# 👨‍🍳 Chefness

**Your AI sous-chef that lives in your pocket.**

Chefness is a mobile-first, offline-first Progressive Web App (PWA) that helps you cook using AI. Chat with a knowledgeable cooking guru that remembers your dietary restrictions, recent cooking history, and preferences — and helps you plan meals, discover recipes, and cook step-by-step. Save recipes to a personal collection, log what you've cooked, and let the AI suggest variety based on your history. It runs entirely in the browser with no backend server — you bring your own LLM API key.


|      |      |      |      |      |
| ---- | ---- | ---- | ---- | ---- |
|   <img width="424" height="906" alt="image" src="https://github.com/user-attachments/assets/0e976598-056b-4aa2-8ee2-612b73d54799" /> |   <img width="424" height="906" alt="image" src="https://github.com/user-attachments/assets/954112d7-f186-4479-ba6e-796c593b042b" />|   <img width="424" height="906" alt="image" src="https://github.com/user-attachments/assets/a99d9687-3f35-4da6-b332-9438f698c988" />|   <img width="424" height="906" alt="image" src="https://github.com/user-attachments/assets/284502b9-7f6d-4e3d-b57a-000c35fac420" />|   <img width="424" height="906" alt="image" src="https://github.com/user-attachments/assets/80938759-65a2-4f0f-8751-194442e52dfd" />   |


---

## ✨ Features

### Core (MVP)

- 💬 **AI Chat** — Streaming conversations with a cooking guru persona
- 📷 **Vision Prompts** — take or attach photos when the selected model supports image input
- ⚙️ **OpenRouter Integration** — connect with OpenRouter OAuth and filter the live model catalog by free, vision, and tool support
- 🍳 **Meal Planning** — Meal type (breakfast / lunch / dinner / snack / dessert) and serving size selectors
- 📱 **Mobile-First PWA** — Installable, offline-capable, designed for kitchen use

### Recipes (Phase 2 — Complete)

- 💾 **Save Recipe from Chat** — One-tap save with LLM-powered structured extraction via native tool calling
- 📖 **Recipe Collection** — Browse, view, edit, and delete saved recipes
- 📋 **Share as Markdown** — Copy recipes to clipboard in clean Markdown format

### Cooking History (Phase 3 — In Progress)

- 🍽 **"I Cooked This!"** — Log meals from chat
- 📅 **History Tab** — Chronological cooking log with ratings and notes
- 🧠 **AI Context** — Recent cooking history injected into the AI's system prompt

---

## 🚀 Getting Started

```bash
# Clone
git clone https://github.com/maxpaulus43/chefness.git
cd chefness

# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

Open the app, go to **Settings**, connect your OpenRouter account, and select a model. Start chatting!

---

## 🛠 Tech Stack

| Concern | Technology |
| --- | --- |
| Framework | React 19 |
| Language | TypeScript 6 (strict) |
| Bundler | Vite 8 |
| RPC Layer | tRPC 11 (in-browser, no server) |
| Server State | TanStack React Query 5 |
| Validation | Zod 4 |
| LLM Integration | OpenRouter OAuth + live model catalog + custom fetch-based streaming client |
| PWA | vite-plugin-pwa |
| Package Manager | Bun |

---

## 🏗 Architecture Overview

Chefness uses a strict four-layer architecture. Data flows downward; dependencies point downward.

```
┌─────────────────────────────────────────────┐
│  Components  (UI, presentation only)        │
├─────────────────────────────────────────────┤
│  Hooks  (business logic, tRPC calls)        │
├─────────────────────────────────────────────┤
│  tRPC Router  (procedures, validation)      │
├─────────────────────────────────────────────┤
│  Storage  (localStorage repositories)       │
└─────────────────────────────────────────────┘
```

All data operations run in-browser via tRPC with local persistence. **No application backend server.** LLM requests are sent to OpenRouter.

👉 See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

---

## 📂 Project Structure

```
src/
  components/    UI components (ChatView, RecipeListView, SettingsView, etc.)
  hooks/         Business logic hooks (useChat, useRecipes, useCookingLog, etc.)
  lib/           Utilities (llm-stream, recipe-extractor, recipe-markdown, etc.)
  storage/       Persistence layer (localStorage repositories)
  trpc/          In-browser tRPC setup (router, client, provider)
  types/         Zod schemas and TypeScript types
```

---

## 🔒 Privacy & Data

- All data stays on-device in localStorage
- No accounts, no server, no tracking
- LLM network calls are sent only to OpenRouter
- The OpenRouter OAuth key is stored locally and sent only to OpenRouter

---

## 🗺 Roadmap

- **Phase 4:** Personalization — dietary restrictions, AI memory
- **Phase 5:** Conversation management — session persistence, history

👉 See [PRD.md](./PRD.md) for the full roadmap.

---

## 📄 License

MIT
