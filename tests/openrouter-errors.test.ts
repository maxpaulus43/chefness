import { afterEach, expect, mock, test } from "bun:test";

const originalFetch = globalThis.fetch;
const echoedSecret = "provider-echoed-secret";
const failedResponse = {
  ok: false,
  status: 401,
  statusText: "Unauthorized",
  text: async () => echoedSecret,
};

mock.module("expo/fetch", () => ({
  fetch: async () => failedResponse,
}));

afterEach(() => {
  globalThis.fetch = originalFetch;
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
