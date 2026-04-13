/**
 * OpenRouter OAuth PKCE helpers.
 *
 * Pure functions — no React imports, no Node dependencies.
 * Uses the Web Crypto API (browser-compatible) for all cryptographic operations.
 */

const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";

// ---------------------------------------------------------------------------
// Internal: base64url encoding helpers (no Buffer, no npm dependency)
// ---------------------------------------------------------------------------

/** Encode a Uint8Array to a base64url string (RFC 4648 §5, no padding). */
function base64urlEncode(bytes: Uint8Array): string {
  // Convert bytes → binary string → base64, then make URL-safe.
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random code verifier.
 *
 * Returns a 64-character base64url string (well within the 43-128 range
 * mandated by RFC 7636).
 */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(48); // 48 bytes → 64 base64url chars
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

/**
 * Create a SHA-256 code challenge from a verifier (base64url-encoded).
 */
export async function createCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64urlEncode(new Uint8Array(digest));
}

/**
 * Build the full OpenRouter authorization URL for PKCE (S256).
 */
export function buildAuthUrl(callbackUrl: string, codeChallenge: string): string {
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", callbackUrl);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/**
 * Exchange an authorization code + verifier for an OpenRouter API key.
 *
 * @returns The API key string (e.g. `"sk-or-..."`).
 * @throws On network errors or non-OK responses from OpenRouter.
 */
export async function exchangeCodeForKey(code: string, codeVerifier: string): Promise<string> {
  const response = await fetch(OPENROUTER_KEYS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      code_challenge_method: "S256",
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter key exchange failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const data: unknown = await response.json();

  if (typeof data !== "object" || data === null || !("key" in data)) {
    throw new Error("OpenRouter key exchange returned an unexpected response shape.");
  }

  const { key } = data as { key: string };

  if (typeof key !== "string" || key.length === 0) {
    throw new Error("OpenRouter key exchange returned an empty key.");
  }

  return key;
}
