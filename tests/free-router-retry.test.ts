import { expect, test } from "bun:test";
import { retryFreeRouterChat } from "../src/lib/free-router-retry";
import type { StreamOptions } from "../src/lib/llm-stream";

const classifier = "nvidia/nemotron-3.5-content-safety:free";
function request(): StreamOptions {
  return {
    providerId: "openrouter",
    modelId: "openrouter/free",
    apiKey: "test",
    systemPrompt: "Cooking assistant",
    messages: [{ role: "user", content: "Can I add yogurt?" }],
    onToken: () => {},
  };
}

test("discards classifier output and retries the original conversation", async () => {
  const options = request();
  const tokens: string[] = [];
  let model = "";
  let calls = 0;
  options.onToken = (_, text) => tokens.push(text);
  options.onModel = (value) => {
    model = value;
  };
  const text = await retryFreeRouterChat(options, async (attempt) => {
    expect(attempt.messages).toBe(options.messages);
    calls++;
    const answer = calls === 1 ? "User Safety: safe" : "Yes, add yogurt.";
    attempt.onModel?.(calls === 1 ? classifier : "chat/model");
    attempt.onToken(answer, answer);
    return answer;
  });
  expect(calls).toBe(2);
  expect(text).toBe("Yes, add yogurt.");
  expect(tokens).toEqual(["", "Yes, add yogurt."]);
  expect(model).toBe("chat/model");
});

test("recognizes the exact label without metadata and stops after three attempts", async () => {
  let calls = 0;
  await expect(
    retryFreeRouterChat(request(), async () => {
      calls++;
      return "User Safety: safe";
    }),
  ).rejects.toThrow("Choose another OpenRouter model");
  expect(calls).toBe(3);
});

test("does not retry ordinary answers, refusals, or manually selected models", async () => {
  for (const answer of [
    "Yes, yogurt is safe.",
    "I cannot help with that.",
    "User Safety: safe",
  ]) {
    const options = request();
    if (answer === "User Safety: safe") options.modelId = classifier;
    let calls = 0;
    expect(
      await retryFreeRouterChat(options, async () => {
        calls++;
        return answer;
      }),
    ).toBe(answer);
    expect(calls).toBe(1);
  }
});

test("network failures and cancellation do not trigger retries", async () => {
  let calls = 0;
  await expect(
    retryFreeRouterChat(request(), async () => {
      calls++;
      throw new Error("network failed");
    }),
  ).rejects.toThrow("network failed");
  expect(calls).toBe(1);

  const controller = new AbortController();
  const options = { ...request(), signal: controller.signal };
  calls = 0;
  await expect(
    retryFreeRouterChat(options, async (attempt) => {
      calls++;
      attempt.onModel?.(classifier);
      controller.abort();
      return "User Safety: safe";
    }),
  ).rejects.toThrow();
  expect(calls).toBe(1);
});
