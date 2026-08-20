/**
 * Generate a v4 UUID string.
 *
 * Uses `crypto.randomUUID()` when available (modern browsers in a secure
 * context) and falls back to a `crypto.getRandomValues()`-based
 * implementation for older environments (e.g. iOS Safari < 15.4).
 */
export function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback: build a v4 UUID from crypto.getRandomValues().
  // The template encodes the positions of the hex digits and the
  // version (4) / variant (8–b) bits required by RFC 4122.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const byteSix = bytes[6];
  const byteEight = bytes[8];
  if (byteSix === undefined || byteEight === undefined) {
    throw new Error("Failed to generate UUID bytes.");
  }

  // Set version 4 (0100) in the high nibble of byte 6.
  bytes[6] = (byteSix & 0x0f) | 0x40;
  // Set variant 1 (10xx) in the high two bits of byte 8.
  bytes[8] = (byteEight & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
