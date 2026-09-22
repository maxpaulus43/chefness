import type { StreamOptions } from "@/lib/llm-stream";

/** The free router can select a classifier instead of a conversational model. */
export async function retryFreeRouterChat(
  options: StreamOptions,
  stream: (options: StreamOptions) => Promise<string>,
): Promise<string> {
  if (
    options.providerId !== "openrouter" ||
    options.modelId !== "openrouter/free"
  ) {
    return stream(options);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    options.signal?.throwIfAborted();
    const response = { classifier: false };
    const text = await stream({
      ...options,
      onModel: (modelId) => {
        response.classifier =
          modelId === "nvidia/nemotron-3.5-content-safety:free";
        if (!response.classifier) options.onModel?.(modelId);
      },
      onToken: (token, accumulated) => {
        if (!response.classifier) options.onToken(token, accumulated);
      },
    });
    if (
      !response.classifier &&
      !/^\s*User Safety:\s*(?:safe|unsafe)\s*$/i.test(text)
    ) {
      return text;
    }
    // Clear rejected text/metadata, including when the stream omitted its model.
    options.onToken("", "");
    options.onModel?.("");
    options.signal?.throwIfAborted();
  }
  throw new Error(
    "OpenRouter repeatedly selected a content-safety classifier instead of a chat model. Choose another OpenRouter model in Settings.",
  );
}
