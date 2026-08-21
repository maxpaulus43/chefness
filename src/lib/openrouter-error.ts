export function formatOpenRouterError(
  cause: unknown,
  fallback = "An unexpected error occurred while contacting OpenRouter.",
): string {
  if (!(cause instanceof Error) || !cause.message.trim()) return fallback;

  const message = cause.message.toLowerCase();
  if (message.includes("401") || message.includes("unauthorized")) {
    return "Your OpenRouter connection is no longer valid. Reconnect in Settings.";
  }
  if (message.includes("403") || message.includes("forbidden")) {
    return "OpenRouter denied this request. Check your connection and selected model in Settings.";
  }
  if (message.includes("404") || message.includes("not found")) {
    return "This OpenRouter model is unavailable. Choose another model in Settings.";
  }
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("rate-limit")
  ) {
    return "OpenRouter is rate limiting requests. Wait a moment and try again.";
  }

  return cause.message;
}
