import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const IMAGE_DIRECTORY_NAME = "chefness-chat-images";
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.72;
const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function imageDirectory(): Directory {
  return new Directory(Paths.document, IMAGE_DIRECTORY_NAME);
}

function isManagedImage(uri: string): boolean {
  return uri.startsWith(imageDirectory().uri);
}

/** Resize a picker image and move it from the picker cache into durable storage. */
export async function storeChatImage(
  uri: string,
  width: number,
  height: number,
): Promise<string> {
  const largestDimension = Math.max(width, height);
  const resize =
    largestDimension > MAX_IMAGE_DIMENSION
      ? width >= height
        ? { width: MAX_IMAGE_DIMENSION }
        : { height: MAX_IMAGE_DIMENSION }
      : null;
  const source = new File(uri);
  const context = ImageManipulator.manipulate(uri);
  if (resize) context.resize(resize);
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });
  const directory = imageDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(
    directory,
    `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
  );

  try {
    await new File(result.uri).move(destination);
    if (source.exists && source.uri !== destination.uri) source.delete();
    return destination.uri;
  } catch (error) {
    if (destination.exists) destination.delete();
    throw error;
  }
}

/** Convert a persisted file URI to the data URL required by OpenRouter. */
export async function chatImageDataUrl(uri: string): Promise<string> {
  if (!uri || uri.startsWith("data:")) return uri;
  const file = new File(uri);
  if (!file.exists)
    throw new Error("The attached photo is no longer available.");
  return `data:image/jpeg;base64,${await file.base64()}`;
}

export function deleteChatImages(uris: string[]): void {
  for (const uri of new Set(uris)) {
    if (!isManagedImage(uri)) continue;
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}

/** Remove old files that are no longer referenced by any saved conversation. */
export function deleteOrphanedChatImages(referencedUris: string[]): void {
  const directory = imageDirectory();
  if (!directory.exists) return;
  const referenced = new Set(referencedUris);
  const cutoff = Date.now() - ORPHAN_MAX_AGE_MS;

  for (const entry of directory.list()) {
    if (!(entry instanceof File) || referenced.has(entry.uri)) continue;
    const modificationTime = entry.lastModified ?? 0;
    if (modificationTime < cutoff) entry.delete();
  }
}
