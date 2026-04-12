/**
 * Browser-compatible LLM streaming client.
 *
 * Uses fetch() + ReadableStream to call chat completion APIs directly,
 * avoiding Node-only SDK dependencies. Supports OpenAI-compatible and
 * Anthropic-native providers.
 *
 * This module is the browser replacement for the `Agent` class from
 * `@clinebot/agents`, which relies on `createHandler` from
 * `@clinebot/llms` — a function not exported from the browser build.
 */
import { toProviderConfig, getProvider } from "@clinebot/llms";
import type { ProviderInfo } from "@clinebot/llms";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single message in the conversation. */
export interface StreamMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Options for a streaming chat completion request. */
export interface StreamOptions {
  providerId: string;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
  messages: StreamMessage[];
  onToken: (token: string, accumulated: string) => void;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Protocol detection
// ---------------------------------------------------------------------------

type ApiProtocol = "openai" | "anthropic";

function detectProtocol(info: ProviderInfo | undefined): ApiProtocol {
  if (info?.client === "anthropic") return "anthropic";
  return "openai";
}

// ---------------------------------------------------------------------------
// SSE parsing
// ---------------------------------------------------------------------------

async function* parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) return;
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") return;
          if (payload.length > 0) yield payload;
        }
      }
    }
  }

  if (buffer.trim().length > 0) {
    for (const line of buffer.split("\n")) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6).trim();
        if (payload !== "[DONE]" && payload.length > 0) yield payload;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible streaming
// ---------------------------------------------------------------------------

async function streamOpenAI(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  messages: StreamMessage[],
  onToken: (token: string, accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const apiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: modelId, messages: apiMessages, stream: true }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
  }

  if (!response.body) {
    throw new Error("Response body is null — streaming not supported.");
  }

  const reader = response.body.getReader();
  let accumulated = "";

  try {
    for await (const payload of parseSSE(reader, signal)) {
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = json.choices?.[0]?.delta?.content;
        if (token) {
          accumulated += token;
          onToken(token, accumulated);
        }
      } catch {
        // Skip malformed JSON chunks.
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}

// ---------------------------------------------------------------------------
// Anthropic-native streaming
// ---------------------------------------------------------------------------

async function streamAnthropic(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  messages: StreamMessage[],
  onToken: (token: string, accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  const url = `${baseUrl.replace(/\/+$/, "")}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4096,
      system: systemPrompt,
      messages: apiMessages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
  }

  if (!response.body) {
    throw new Error("Response body is null — streaming not supported.");
  }

  const reader = response.body.getReader();
  let accumulated = "";

  try {
    for await (const payload of parseSSE(reader, signal)) {
      try {
        const json = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (json.type === "content_block_delta" && json.delta?.text) {
          accumulated += json.delta.text;
          onToken(json.delta.text, accumulated);
        }
      } catch {
        // Skip malformed JSON chunks.
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stream a chat completion from an LLM provider.
 *
 * Resolves the provider's base URL and protocol automatically via the
 * `@clinebot/llms` browser-compatible registry, then makes a direct
 * fetch() call with SSE streaming.
 *
 * @returns The full accumulated response text.
 */
export async function streamChat(options: StreamOptions): Promise<string> {
  const { providerId, modelId, apiKey, systemPrompt, messages, onToken, signal } = options;

  // Fetch provider registry info (base URL, client type) first.
  let providerInfo: ProviderInfo | undefined;
  try {
    providerInfo = await getProvider(providerId);
  } catch {
    // Fall back to OpenAI-compatible if lookup fails.
  }

  // toProviderConfig resolves baseUrl for OpenAI-compatible providers but
  // omits it for non-compatible ones (anthropic, gemini, etc.) because the
  // browser build's internal lookup table filters those out. Fall back to
  // the provider registry's baseUrl when that happens.
  const config = toProviderConfig({ provider: providerId, model: modelId, apiKey });
  const baseUrl = config.baseUrl || providerInfo?.baseUrl;

  if (!baseUrl) {
    throw new Error(
      `No base URL found for provider "${providerId}". ` +
        "Please check your provider configuration.",
    );
  }

  const protocol = detectProtocol(providerInfo);

  if (protocol === "anthropic") {
    return streamAnthropic(baseUrl, apiKey, modelId, systemPrompt, messages, onToken, signal);
  }

  return streamOpenAI(baseUrl, apiKey, modelId, systemPrompt, messages, onToken, signal);
}
