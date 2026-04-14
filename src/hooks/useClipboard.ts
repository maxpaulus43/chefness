/**
 * Reusable hook for clipboard copy operations.
 *
 * Wraps `navigator.clipboard.writeText` with success/error state and
 * a 2-second "copied" feedback timer.
 *
 * No tRPC calls — this is a browser API utility hook.
 */
import { useState, useCallback, useRef } from "react";

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Ref to the pending reset timeout so we can clear it on unmount or re-copy. */
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    // Clear any previous state.
    setError(null);
    setCopied(false);

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- clipboard API may be unavailable in insecure contexts
    if (!navigator.clipboard) {
      setError("Clipboard not available in this browser.");
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to copy to clipboard.";
      setError(message);
      return false;
    }
  }, []);

  return { copyToClipboard, copied, error } as const;
}
