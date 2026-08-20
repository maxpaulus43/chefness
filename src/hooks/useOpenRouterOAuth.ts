/**
 * Custom hook that orchestrates the OpenRouter OAuth PKCE flow.
 *
 * ## Responsibilities
 * - `startOAuth()` kicks off the flow (verifier generation → redirect).
 * - On mount, detects an incoming `?code=` callback, exchanges it for an
 *   API key, persists it via `useSettings`, and cleans up the URL.
 *
 * The hook is designed to be called once near the top of the component tree
 * (inside `TRPCProvider` so `useSettings()` works).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateCodeVerifier,
  createCodeChallenge,
  buildAuthUrl,
  exchangeCodeForKey,
  type CodeChallengeMethod,
} from "@/lib/openrouter-oauth";
import { useSettings } from "@/hooks/useSettings";

const VERIFIER_SESSION_KEY = "chefness:oauth:code_verifier";
const METHOD_SESSION_KEY = "chefness:oauth:code_challenge_method";

export function useOpenRouterOAuth() {
  const { updateSettings } = useSettings();
  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Guard against StrictMode double-invoke / multiple effect runs.
  const exchangeStarted = useRef(false);

  // ------------------------------------------------------------------
  // startOAuth: generate verifier, store it, redirect to OpenRouter
  // ------------------------------------------------------------------
  const startOAuth = useCallback(async () => {
    setOauthError(null);
    setIsStartingOAuth(true);

    try {
      const verifier = generateCodeVerifier();
      const challenge = await createCodeChallenge(verifier);

      sessionStorage.setItem(VERIFIER_SESSION_KEY, verifier);
      sessionStorage.setItem(METHOD_SESSION_KEY, challenge.method);

      const callbackUrl = window.location.origin + window.location.pathname;
      const authUrl = buildAuthUrl(
        callbackUrl,
        challenge.value,
        challenge.method,
      );

      // Suppress referrer-based app attribution. OpenRouter derives the app
      // from callback_url; sending the PWA referrer can conflict with an
      // existing app record and fail authorization with HTTP 409.
      const link = document.createElement("a");
      link.href = authUrl;
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start OpenRouter sign-in.";
      setOauthError(message);
      setIsStartingOAuth(false);
    }
  }, []);

  // ------------------------------------------------------------------
  // On mount: detect ?code= param and exchange it
  // ------------------------------------------------------------------
  /* eslint-disable react-hooks/set-state-in-effect -- intentional: OAuth callback side-effect sets error/processing state */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) return;
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    const verifier = sessionStorage.getItem(VERIFIER_SESSION_KEY);
    const storedMethod = sessionStorage.getItem(METHOD_SESSION_KEY);
    const method: CodeChallengeMethod =
      storedMethod === "plain" ? "plain" : "S256";

    if (!verifier) {
      setOauthError(
        "OAuth callback received but no code verifier found in session. Please try again.",
      );
      // Clean up the URL even on error so the param doesn't linger.
      cleanUpUrl(params);
      return;
    }

    setIsProcessingCallback(true);

    exchangeCodeForKey(code, verifier, method)
      .then((key) => {
        updateSettings({ openRouterOAuthKey: key });
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : "Unknown error during OAuth exchange.";
        setOauthError(message);
      })
      .finally(() => {
        sessionStorage.removeItem(VERIFIER_SESSION_KEY);
        sessionStorage.removeItem(METHOD_SESSION_KEY);
        cleanUpUrl(params);
        setIsProcessingCallback(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional mount-only
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    /** Kick off the OpenRouter OAuth PKCE flow. */
    startOAuth,
    /** `true` while preparing the authorization redirect. */
    isStartingOAuth,
    /** `true` while the code→key exchange is in flight. */
    isProcessingCallback,
    /** Error message if the exchange failed, otherwise `null`. */
    oauthError,
  } as const;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove the `code` query param and rewrite the URL without a reload. */
function cleanUpUrl(params: URLSearchParams): void {
  params.delete("code");
  const qs = params.toString();
  const newUrl = window.location.pathname + (qs ? `?${qs}` : "");
  window.history.replaceState(null, "", newUrl);
}
