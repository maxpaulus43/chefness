import { expect, test } from "bun:test";
import {
  isPristineSettings,
  mergeSettings,
  pickLatest,
  settingsToPayload,
} from "../src/lib/cloud-sync/merge";
import {
  entityFromRecordFields,
  entityToRecordFields,
  parseRecordName,
  recordNameFor,
} from "../src/lib/cloud-sync/records";
import {
  chatImageRecordName,
  collectManagedImageNames,
  fromPortableImageRef,
  managedChatImageName,
  rewriteSessionImages,
  toPortableImageRef,
} from "../src/lib/cloud-sync/image-refs";
import { recipeSchema } from "../src/types/recipe";
import { settingsSchema, type Settings } from "../src/types/settings";
import type { ChatSession } from "../src/types/chat-session";

const recipe = {
  id: "r1",
  title: "Soup",
  description: "",
  ingredients: ["water"],
  steps: ["boil"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

test("last write wins by updatedAt and ties keep the local copy", () => {
  const older = { ...recipe, title: "Old" };
  const newer = {
    ...recipe,
    title: "New",
    updatedAt: "2026-01-03T00:00:00.000Z",
  };
  expect(pickLatest(older, newer)).toBe(newer);
  expect(pickLatest(newer, older)).toBe(newer);
  const tie = { ...recipe, title: "Tie" };
  expect(pickLatest(recipe, tie)).toBe(recipe);

  const tombstone = {
    ...recipe,
    updatedAt: "2026-01-04T00:00:00.000Z",
    deletedAt: "2026-01-04T00:00:00.000Z",
  };
  expect(pickLatest(newer, tombstone)).toBe(tombstone);
});

const baseSettings: Settings = settingsSchema.parse({
  id: "user-settings",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

test("settings merge protects real data from a fresh install", () => {
  const remote: Settings = {
    ...baseSettings,
    dietaryRestrictions: ["vegan"],
    llmModel: "openai/gpt",
    hasCompletedOnboarding: true,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const freshLocal: Settings = {
    ...baseSettings,
    hasCompletedOnboarding: false,
    openRouterOAuthKey: "local-secret",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
  expect(isPristineSettings(freshLocal)).toBe(true);
  const merged = mergeSettings(freshLocal, remote);
  expect(merged.dietaryRestrictions).toEqual(["vegan"]);
  expect(merged.llmModel).toBe("openai/gpt");
  expect(merged.hasCompletedOnboarding).toBe(true);
  expect(merged.openRouterOAuthKey).toBe("local-secret");
});

test("settings merge is last-write-wins once both sides are customized", () => {
  const local: Settings = {
    ...baseSettings,
    dietaryRestrictions: ["keto"],
    hasCompletedOnboarding: true,
    updatedAt: "2026-03-01T00:00:00.000Z",
  };
  const remote: Settings = {
    ...baseSettings,
    dietaryRestrictions: ["vegan"],
    hasCompletedOnboarding: false,
    updatedAt: "2026-02-01T00:00:00.000Z",
  };
  expect(mergeSettings(local, remote)).toBe(local);
  const newerRemote = { ...remote, updatedAt: "2026-04-01T00:00:00.000Z" };
  const merged = mergeSettings(local, newerRemote);
  expect(merged.dietaryRestrictions).toEqual(["vegan"]);
  expect(merged.hasCompletedOnboarding).toBe(true);
});

test("settings payload never carries credentials", () => {
  const payload = settingsToPayload({
    ...baseSettings,
    openRouterOAuthKey: "secret",
    llmApiKey: "legacy",
  });
  expect(payload.openRouterOAuthKey).toBe("");
  expect(payload.llmApiKey).toBe("");
});

test("record names round-trip and fields carry the JSON payload", () => {
  const name = recordNameFor("cooking-log", "abc-123");
  expect(parseRecordName(name)).toEqual({
    storeName: "cooking-log",
    id: "abc-123",
  });
  expect(parseRecordName("chat-image__x.jpg")).toEqual({
    storeName: "chat-image",
    id: "x.jpg",
  });
  expect(parseRecordName("nonsense")).toBeNull();

  const tombstone = { ...recipe, deletedAt: recipe.updatedAt };
  const fields = entityToRecordFields(tombstone);
  expect(fields.updatedAt).toEqual({ type: "date", value: recipe.updatedAt });
  expect(fields.deletedAt).toEqual({ type: "date", value: recipe.updatedAt });
  expect(entityToRecordFields(recipe).deletedAt).toBeUndefined();

  const parse = (value: unknown) => recipeSchema.safeParse(value).data ?? null;
  expect(entityFromRecordFields(fields, parse)).toEqual(tombstone);
  expect(
    entityFromRecordFields({ payload: { value: "{not json" } }, parse),
  ).toBeNull();
  expect(
    entityFromRecordFields({ payload: { value: '{"id":"x"}' } }, parse),
  ).toBeNull();
});

const directory = "file:///var/app/Documents/chefness-chat-images/";

test("chat image references become portable and back", () => {
  const uri = `${directory}123-abc.jpg`;
  expect(managedChatImageName(uri, directory)).toBe("123-abc.jpg");
  expect(managedChatImageName("file:///elsewhere/x.jpg", directory)).toBeNull();
  expect(toPortableImageRef(uri, directory)).toBe(
    "chefness-image://123-abc.jpg",
  );
  expect(toPortableImageRef("data:image/jpeg;base64,abc", directory)).toBe(
    "data:image/jpeg;base64,abc",
  );
  const otherDevice = "file:///var/other/Documents/chefness-chat-images";
  expect(
    fromPortableImageRef("chefness-image://123-abc.jpg", otherDevice),
  ).toBe(`${otherDevice}/123-abc.jpg`);
  expect(fromPortableImageRef(uri, directory)).toBe(uri);
  expect(chatImageRecordName("123-abc.jpg")).toBe("chat-image__123-abc.jpg");
});

test("session image rewriting only allocates when something changes", () => {
  const session: ChatSession = {
    id: "s1",
    title: "t",
    mealType: null,
    mealSize: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages: [
      {
        role: "user",
        content: "hi",
        modelId: "",
        imageDataUrl: `${directory}a.jpg`,
        timestamp: "2026-01-01T00:00:00.000Z",
        importedRecipeContext: "",
        savedRecipeId: "",
        memorySaved: false,
      },
      {
        role: "assistant",
        content: "hello",
        modelId: "",
        imageDataUrl: "",
        timestamp: "2026-01-01T00:00:00.000Z",
        importedRecipeContext: "",
        savedRecipeId: "",
        memorySaved: false,
      },
    ],
  };
  expect(collectManagedImageNames(session, directory)).toEqual(["a.jpg"]);
  const portable = rewriteSessionImages(session, (uri) =>
    toPortableImageRef(uri, directory),
  );
  expect(portable.messages[0]?.imageDataUrl).toBe("chefness-image://a.jpg");
  expect(portable.messages[1]).toBe(session.messages[1]);
  expect(rewriteSessionImages(session, (uri) => uri)).toBe(session);
});
