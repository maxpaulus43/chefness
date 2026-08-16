/**
 * OpenRouter OAuth PKCE helpers.
 *
 * Pure functions — no React imports or Node dependencies.
 */

const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";

export type CodeChallengeMethod = "S256" | "plain";

export interface CodeChallenge {
  value: string;
  method: CodeChallengeMethod;
}

/** Encode bytes as unpadded base64url (RFC 4648 §5). */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Generate an RFC 7636 code verifier. */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

/**
 * Create a PKCE challenge using S256 when Web Crypto is available.
 *
 * OpenRouter officially supports the `plain` method, which is used for older
 * Safari/PWA contexts that provide secure random values but not SubtleCrypto.
 */
export async function createCodeChallenge(verifier: string): Promise<CodeChallenge> {
  const subtle = (crypto as unknown as {
    subtle?: { digest?: SubtleCrypto["digest"] };
  }).subtle;

  if (typeof subtle?.digest !== "function") {
    return { value: verifier, method: "plain" };
  }

  const encoded = new TextEncoder().encode(verifier);
  const digest = await subtle.digest("SHA-256", encoded);
  return { value: base64urlEncode(new Uint8Array(digest)), method: "S256" };
}

/** Build the OpenRouter authorization URL. */
export function buildAuthUrl(
  callbackUrl: string,
  codeChallenge: string,
  method: CodeChallengeMethod,
): string {
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", callbackUrl);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", method);
  return url.toString();
}

/** Exchange an authorization code for a user-controlled OpenRouter API key. */
export async function exchangeCodeForKey(
  code: string,
  codeVerifier: string,
  method: CodeChallengeMethod,
): Promise<string> {
  const response = await fetch(OPENROUTER_KEYS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      code_challenge_method: method,
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
