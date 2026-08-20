import {
  prepareImageAttachment,
  type ImageAttachment,
} from "@/lib/image-attachment";
import { useCallback, useState } from "react";

export function useImageAttachment() {
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachImage = useCallback(async (file: File) => {
    setIsPreparing(true);
    setError(null);

    try {
      setAttachment(await prepareImageAttachment(file));
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Unable to attach that image.",
      );
    } finally {
      setIsPreparing(false);
    }
  }, []);

  const clearImage = useCallback(() => {
    setAttachment(null);
    setError(null);
  }, []);

  return {
    attachment,
    isPreparing,
    error,
    attachImage,
    clearImage,
  } as const;
}
