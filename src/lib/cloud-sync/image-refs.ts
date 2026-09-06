import type { ChatSession } from "@/types/chat-session";

/**
 * Chat photos are files under the app's documents directory, and that path
 * differs per device. Synced sessions therefore carry a portable reference
 * built from the file name only; each device maps it back to its own
 * directory when the record arrives.
 */
export const PORTABLE_IMAGE_SCHEME = "chefness-image://";

const IMAGE_RECORD_PREFIX = "chat-image__";

function withTrailingSlash(directoryUri: string): string {
  return directoryUri.endsWith("/") ? directoryUri : `${directoryUri}/`;
}

/** File name of a managed chat image, or `null` for anything else. */
export function managedChatImageName(
  uri: string,
  directoryUri: string,
): string | null {
  const prefix = withTrailingSlash(directoryUri);
  if (!uri.startsWith(prefix)) return null;
  const name = uri.slice(prefix.length);
  return name && !name.includes("/") ? name : null;
}

export function toPortableImageRef(uri: string, directoryUri: string): string {
  const name = managedChatImageName(uri, directoryUri);
  return name ? `${PORTABLE_IMAGE_SCHEME}${name}` : uri;
}

export function fromPortableImageRef(
  ref: string,
  directoryUri: string,
): string {
  if (!ref.startsWith(PORTABLE_IMAGE_SCHEME)) return ref;
  const name = ref.slice(PORTABLE_IMAGE_SCHEME.length);
  return name ? `${withTrailingSlash(directoryUri)}${name}` : "";
}

export function chatImageRecordName(name: string): string {
  return `${IMAGE_RECORD_PREFIX}${name}`;
}

export function isChatImageRecordName(recordName: string): boolean {
  return recordName.startsWith(IMAGE_RECORD_PREFIX);
}

/** Managed image file names referenced by a session, deduplicated. */
export function collectManagedImageNames(
  session: ChatSession,
  directoryUri: string,
): string[] {
  const names = new Set<string>();
  for (const message of session.messages) {
    const name = managedChatImageName(message.imageDataUrl, directoryUri);
    if (name) names.add(name);
  }
  return [...names];
}

/** Return a copy of the session with every message image URI transformed. */
export function rewriteSessionImages(
  session: ChatSession,
  transform: (uri: string) => string,
): ChatSession {
  const messages = session.messages.map((message) => {
    if (!message.imageDataUrl) return message;
    const next = transform(message.imageDataUrl);
    return next === message.imageDataUrl
      ? message
      : { ...message, imageDataUrl: next };
  });
  const changed = messages.some(
    (message, index) => message !== session.messages[index],
  );
  return changed ? { ...session, messages } : session;
}
