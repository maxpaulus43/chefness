import { expect, test } from "bun:test";
import { linking } from "../src/native/navigation-routes";

const resolvePath = linking.getStateFromPath!;

test("resolves recipe destinations from deep links", () => {
  const state = resolvePath("recipes/recipe-123");
  expect(state).toMatchObject({ index: 1, routes: [{ name: "ChatTab" }, { name: "RecipesTab" }, { name: "HistoryTab" }, { name: "SettingsTab" }] });
  expect(state?.routes[1]).toMatchObject({
    name: "RecipesTab",
    state: { routes: [{ name: "RecipeList" }, { name: "RecipeDetail", params: { recipeId: "recipe-123" } }] },
  });
});

test("resolves chat and settings destinations from deep links", () => {
  const chatState = resolvePath("chats/chat-456");
  expect(chatState).toMatchObject({ index: 0, routes: [{ name: "ChatTab" }, { name: "RecipesTab" }, { name: "HistoryTab" }, { name: "SettingsTab" }] });
  expect(chatState?.routes[0]).toMatchObject({
    name: "ChatTab",
    state: { routes: [{ name: "Chat", params: { sessionId: "chat-456" } }] },
  });
  const settingsState = resolvePath("settings/models");
  expect(settingsState).toMatchObject({ index: 3, routes: [{ name: "ChatTab" }, { name: "RecipesTab" }, { name: "HistoryTab" }, { name: "SettingsTab" }] });
  expect(settingsState?.routes[3]).toMatchObject({
    name: "SettingsTab",
    state: { routes: [{ name: "Settings" }, { name: "ModelSelection" }] },
  });
});
