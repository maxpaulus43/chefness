import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "chefness-dev";
let testEnv: RulesTestEnvironment;

const recipe = {
  id: "recipe-1",
  title: "Soup",
  description: "Warm soup",
  ingredients: ["water"],
  steps: ["Simmer"],
  createdAt: "2026-07-09T00:00:00.000Z",
  updatedAt: "2026-07-09T00:00:00.000Z",
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("private user data", () => {
  it("denies unauthenticated reads and writes", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users/alice/recipes/recipe-1")));
    await assertFails(setDoc(doc(db, "users/alice/recipes/recipe-1"), recipe));
  });

  it("allows an owner to create, read, update, and delete a recipe", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    const reference = doc(db, "users/alice/recipes/recipe-1");
    await assertSucceeds(setDoc(reference, recipe));
    await assertSucceeds(getDoc(reference));
    await assertSucceeds(updateDoc(reference, { title: "Tomato soup" }));
    await assertSucceeds(deleteDoc(reference));
  });

  it("denies every cross-user operation", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(setDoc(doc(aliceDb, "users/alice/recipes/recipe-1"), recipe));

    const aliceRecipeAsBob = doc(bobDb, "users/alice/recipes/recipe-1");
    await assertFails(getDoc(aliceRecipeAsBob));
    await assertFails(setDoc(aliceRecipeAsBob, recipe));
    await assertFails(updateDoc(aliceRecipeAsBob, { title: "Stolen" }));
    await assertFails(deleteDoc(aliceRecipeAsBob));
  });

  it("allows valid documents in every private collection", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    const metadata = {
      createdAt: "2026-07-09T00:00:00.000Z",
      updatedAt: "2026-07-09T00:00:00.000Z",
    };

    await assertSucceeds(setDoc(doc(db, "users/alice/settings/app"), {
      id: "app",
      llmProvider: "openai",
      llmModel: "gpt-4.1",
      dietaryRestrictions: ["vegetarian"],
      otherDietaryNotes: "",
      ...metadata,
    }));
    await assertSucceeds(setDoc(doc(db, "users/alice/cookingLog/log-1"), {
      id: "log-1",
      title: "Soup",
      date: "2026-07-09",
      rating: null,
      comment: "",
      recipeId: null,
      ...metadata,
    }));
    await assertSucceeds(setDoc(doc(db, "users/alice/aiPreferences/pref-1"), {
      id: "pref-1",
      text: "Likes soup",
      ...metadata,
    }));
    await assertSucceeds(setDoc(doc(db, "users/alice/chatSessions/chat-1"), {
      id: "chat-1",
      title: "Soup chat",
      messages: [],
      mealType: null,
      mealSize: null,
      ...metadata,
    }));
  });

  it("rejects secret and unknown fields in cloud settings", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users/alice/settings/app"), {
      id: "app",
      llmProvider: "openai",
      llmModel: "gpt-4.1",
      llmApiKey: "must-not-sync",
      dietaryRestrictions: [],
      otherDietaryNotes: "",
      createdAt: "2026-07-09T00:00:00.000Z",
      updatedAt: "2026-07-09T00:00:00.000Z",
    }));
  });

  it("denies unknown collections by default", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users/alice/privateSurprise/item-1"), { id: "item-1" }));
  });
});
