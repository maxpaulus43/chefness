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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- standard infinite loop pattern
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
          choices?: { delta?: { content?: string } }[];
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
// Tool calling types
// ---------------------------------------------------------------------------

/** JSON Schema definition for a tool the model can call. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** The parsed result of a tool call returned by the model. */
export interface ToolCallResult {
  name: string;
  arguments: Record<string, unknown>;
}

/** Options for a non-streaming tool-calling LLM request. */
export interface ToolCallOptions {
  providerId: string;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
  messages: StreamMessage[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible tool calling (non-streaming)
// ---------------------------------------------------------------------------

async function callWithToolsOpenAI(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  messages: StreamMessage[],
  tools: ToolDefinition[],
  signal?: AbortSignal,
): Promise<ToolCallResult> {
  const apiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const openaiTools = tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const toolChoice =
    tools.length === 1
      ? { type: "function" as const, function: { name: tools[0]!.name } }
      : undefined;

  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: apiMessages,
      tools: openaiTools,
      tool_choice: toolChoice,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
  }

  const json = (await response.json()) as {
    choices?: {
      message?: {
        tool_calls?: {
          function?: { name?: string; arguments?: string };
        }[];
      };
    }[];
  };

  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.name || !toolCall.function.arguments) {
    throw new Error(
      "The model did not return a tool call. The message may not contain a recipe.",
    );
  }

  let parsedArgs: Record<string, unknown>;
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse the extracted recipe data.");
  }

  return { name: toolCall.function.name, arguments: parsedArgs };
}

// ---------------------------------------------------------------------------
// Anthropic-native tool calling (non-streaming)
// ---------------------------------------------------------------------------

async function callWithToolsAnthropic(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  messages: StreamMessage[],
  tools: ToolDefinition[],
  signal?: AbortSignal,
): Promise<ToolCallResult> {
  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  const toolChoice =
    tools.length === 1
      ? { type: "tool" as const, name: tools[0]!.name }
      : undefined;

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
      tools: anthropicTools,
      tool_choice: toolChoice,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `${response.status} ${response.statusText}${body ? `: ${body}` : ""}`,
    );
  }

  const json = (await response.json()) as {
    content?: {
      type?: string;
      name?: string;
      input?: Record<string, unknown>;
    }[];
  };

  const toolUseBlock = json.content?.find((b) => b.type === "tool_use");
  if (!toolUseBlock?.name || !toolUseBlock.input) {
    throw new Error(
      "The model did not return a tool call. The message may not contain a recipe.",
    );
  }

  return { name: toolUseBlock.name, arguments: toolUseBlock.input };
}

// ---------------------------------------------------------------------------
// Public API — tool calling
// ---------------------------------------------------------------------------

/**
 * Make a non-streaming LLM call with tool definitions and return the tool
 * call result.
 *
 * Uses the same provider resolution logic as `streamChat`. The model is
 * forced to call the specified tool (via `tool_choice`), giving guaranteed
 * structured output.
 */
export async function callWithTools(
  options: ToolCallOptions,
): Promise<ToolCallResult> {
  const { providerId, modelId, apiKey, systemPrompt, messages, tools, signal } =
    options;

  let providerInfo: ProviderInfo | undefined;
  try {
    providerInfo = await getProvider(providerId);
  } catch {
    // Fall back to OpenAI-compatible if lookup fails.
  }

  const config = toProviderConfig({
    provider: providerId,
    model: modelId,
    apiKey,
  });
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string should also fall through
  const baseUrl = config.baseUrl || providerInfo?.baseUrl;

  if (!baseUrl) {
    throw new Error(
      `No base URL found for provider "${providerId}". ` +
        "Please check your provider configuration.",
    );
  }

  const protocol = detectProtocol(providerInfo);

  if (protocol === "anthropic") {
    return callWithToolsAnthropic(
      baseUrl, apiKey, modelId, systemPrompt, messages, tools, signal,
    );
  }

  return callWithToolsOpenAI(
    baseUrl, apiKey, modelId, systemPrompt, messages, tools, signal,
  );
}

// ---------------------------------------------------------------------------
// Public API — streaming
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
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string should also fall through
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
