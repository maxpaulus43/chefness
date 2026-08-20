// Encodes a shared URL for transport through the share-extension deep link.
//
// The share extension opens the host app via
// `chefness://chats?sharedUrl=<payload>`. The payload must survive two naive
// URL-building/parsing steps (URLComponents in the extension, React
// Navigation's query parser), so we base64url-encode it: the output alphabet
// (A-Z a-z 0-9 - _) is safe in both query values and never re-escaped.
// Hermes has no atob/btoa, so this is a tiny self-contained implementation.

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function encodeSharedUrl(url: string): string {
  // encodeURIComponent first so every char code fits in one byte.
  const ascii = encodeURIComponent(url);
  let out = "";
  for (let i = 0; i < ascii.length; i += 3) {
    const b0 = ascii.charCodeAt(i);
    const b1 = i + 1 < ascii.length ? ascii.charCodeAt(i + 1) : NaN;
    const b2 = i + 2 < ascii.length ? ascii.charCodeAt(i + 2) : NaN;
    out += ALPHABET.charAt(b0 >> 2);
    out += ALPHABET.charAt(((b0 & 3) << 4) | (Number.isNaN(b1) ? 0 : b1 >> 4));
    if (!Number.isNaN(b1)) {
      out += ALPHABET.charAt(
        ((b1 & 15) << 2) | (Number.isNaN(b2) ? 0 : b2 >> 6),
      );
    }
    if (!Number.isNaN(b2)) out += ALPHABET.charAt(b2 & 63);
  }
  return out;
}

export function decodeSharedUrl(payload: string): string | null {
  try {
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const char of payload) {
      const value = ALPHABET.indexOf(char);
      if (value < 0) return null;
      buffer = (buffer << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 255);
      }
    }
    return decodeURIComponent(String.fromCharCode(...bytes));
  } catch {
    return null;
  }
}
