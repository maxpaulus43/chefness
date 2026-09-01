import { afterEach, expect, mock, test } from "bun:test";
import { formatOpenRouterError } from "../src/lib/openrouter-error";

const originalFetch = globalThis.fetch;
const echoedSecret = "provider-echoed-secret";
const failedResponse = {
  ok: false,
  status: 401,
  statusText: "Unauthorized",
  text: async () => echoedSecret,
};
let expoFetchResponse: object = failedResponse;

mock.module("expo/fetch", () => ({
  fetch: async () => expoFetchResponse,
}));

afterEach(() => {
  globalThis.fetch = originalFetch;
  expoFetchResponse = failedResponse;
});

test("formats OpenRouter request failures with actionable user copy", () => {
  expect(formatOpenRouterError(new Error("Request failed (401)"))).toBe(
    "Your OpenRouter connection is no longer valid. Reconnect in Settings.",
  );
  expect(formatOpenRouterError(new Error("Request failed (404)"))).toBe(
    "This OpenRouter model is unavailable. Choose another model in Settings.",
  );
  expect(formatOpenRouterError(new Error("Request failed (429)"))).toBe(
    "OpenRouter is rate limiting requests. Wait a moment and try again.",
  );
  expect(formatOpenRouterError(undefined, "OpenRouter fallback.")).toBe(
    "OpenRouter fallback.",
  );
});

test("OAuth exchange errors exclude provider response bodies", async () => {
  globalThis.fetch = (async () => failedResponse) as typeof fetch;
  const { exchangeCodeForKey } = await import("../src/lib/openrouter-oauth");

  await expect(exchangeCodeForKey("code", "verifier", "S256")).rejects.toThrow(
    "OpenRouter key exchange failed (401).",
  );
  await expect(
    exchangeCodeForKey("code", "verifier", "S256"),
  ).rejects.not.toThrow(echoedSecret);
});

test("native chat errors exclude provider response bodies", async () => {
  const { streamChat } = await import("../src/lib/llm-stream.native");
  const request = streamChat({
    providerId: "openrouter",
    modelId: "test/model",
    apiKey: "request-secret",
    systemPrompt: "test",
    messages: [],
    onToken: () => undefined,
  });

  await expect(request).rejects.toThrow("OpenRouter request failed (401).");
  await expect(request).rejects.not.toThrow(echoedSecret);
});

test("native streaming reports the model selected by OpenRouter", async () => {
  expoFetchResponse = {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"model":"google/gemini-2.0-flash","choices":[{"delta":{"content":"Hi"}}]}\n',
          ),
        );
        controller.close();
      },
    }),
  };
  const { streamChat } = await import("../src/lib/llm-stream.native");
  let modelId = "";

  await streamChat({
    providerId: "openrouter",
    modelId: "openrouter/free",
    apiKey: "request-secret",
    systemPrompt: "test",
    messages: [],
    onToken: () => undefined,
    onModel: (value) => {
      modelId = value;
    },
  });

  expect(modelId).toBe("google/gemini-2.0-flash");
});

test("native tool calls report the model selected by OpenRouter", async () => {
  expoFetchResponse = {
    ok: true,
    json: async () => ({
      model: "google/gemini-2.0-flash",
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: "save_recipe",
                  arguments: '{"title":"Test"}',
                },
              },
            ],
          },
        },
      ],
    }),
  };
  const { callWithTools } = await import("../src/lib/llm-stream.native");
  let modelId = "";

  await callWithTools({
    providerId: "openrouter",
    modelId: "openrouter/free",
    apiKey: "request-secret",
    systemPrompt: "test",
    messages: [],
    tools: [{ name: "save_recipe", description: "test", parameters: {} }],
    onModel: (value) => {
      modelId = value;
    },
  });

  expect(modelId).toBe("google/gemini-2.0-flash");
});

test("native AI tool errors exclude provider response bodies", async () => {
  const { callWithTools } = await import("../src/lib/llm-stream.native");
  const request = callWithTools({
    providerId: "openrouter",
    modelId: "test/model",
    apiKey: "request-secret",
    systemPrompt: "test",
    messages: [],
    tools: [{ name: "test", description: "test", parameters: {} }],
  });

  await expect(request).rejects.toThrow("OpenRouter request failed (401).");
  await expect(request).rejects.not.toThrow(echoedSecret);
});
