import { fetch } from "expo/fetch";

export interface StreamMessage {
  role: "user" | "assistant" | "system";
  content: string;
  imageDataUrl?: string;
}
export interface StreamOptions {
  providerId: string;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
  messages: StreamMessage[];
  onToken: (token: string, accumulated: string) => void;
  signal?: AbortSignal;
}
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface ToolCallOptions {
  providerId: string;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
  messages: StreamMessage[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
}
export interface ToolCallResult {
  toolName: string;
  arguments: Record<string, unknown>;
}
const endpoint = "https://openrouter.ai/api/v1/chat/completions";

async function content(message: StreamMessage) {
  if (!message.imageDataUrl) return message.content;
  const imageDataUrl = message.imageDataUrl.startsWith("data:")
    ? message.imageDataUrl
    : await (await import("./chat-image-storage.native")).chatImageDataUrl(
        message.imageDataUrl,
      );
  return [
    ...(message.content ? [{ type: "text", text: message.content }] : []),
    { type: "image_url", image_url: { url: imageDataUrl } },
  ];
}
function headers(apiKey: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-Title": "Chefness",
  };
}

export async function streamChat(options: StreamOptions): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: headers(options.apiKey),
    body: JSON.stringify({
      model: options.modelId,
      stream: true,
      messages: [
        { role: "system", content: options.systemPrompt },
        ...(await Promise.all(
          options.messages.map(async (message) => ({
            role: message.role,
            content: await content(message),
          })),
        )),
      ],
    }),
    signal: options.signal,
  });
  if (!response.ok)
    throw new Error(`OpenRouter request failed (${response.status}).`);
  const body = response.body as ReadableStream<Uint8Array>;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stream read loop ends on `done`
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n");
    buffer = chunks.pop() ?? "";
    for (const line of chunks) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const token = parsed.choices?.[0]?.delta?.content ?? "";
        if (token) {
          accumulated += token;
          options.onToken(token, accumulated);
        }
      } catch {
        /* partial event */
      }
    }
  }
  return accumulated;
}

export async function callWithTools(
  options: ToolCallOptions,
): Promise<ToolCallResult> {
  const tools = options.tools.map((tool) => ({
    type: "function",
    function: tool,
  }));
  const firstTool = options.tools[0];
  if (!firstTool) throw new Error("At least one tool is required.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: headers(options.apiKey),
    body: JSON.stringify({
      model: options.modelId,
      stream: false,
      messages: [
        { role: "system", content: options.systemPrompt },
        ...options.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      tools,
      tool_choice:
        tools.length === 1
          ? { type: "function", function: { name: firstTool.name } }
          : "required",
    }),
    signal: options.signal,
  });
  if (!response.ok)
    throw new Error(`OpenRouter request failed (${response.status}).`);
  const data = (await response.json()) as {
    choices?: {
      message?: {
        tool_calls?: { function?: { name?: string; arguments?: string } }[];
      };
    }[];
  };
  const fn = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!fn?.name)
    throw new Error("The model did not return the requested tool call.");
  let args: unknown;
  try {
    args = JSON.parse(fn.arguments ?? "{}");
  } catch {
    throw new Error("The model returned invalid structured data.");
  }
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new Error("The model returned invalid tool arguments.");
  return { toolName: fn.name, arguments: args as Record<string, unknown> };
}
