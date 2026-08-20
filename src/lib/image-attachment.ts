const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export interface ImageAttachment {
  dataUrl: string;
  name: string;
}

/** Resize a user-selected image before storing it or sending it to OpenRouter. */
export async function prepareImageAttachment(
  file: File,
): Promise<ImageAttachment> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare the image.");

    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas);

    return {
      dataUrl: await blobToDataUrl(blob),
      name: file.name || "Photo",
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Chefness could not read that image."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Chefness could not prepare that image.")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Chefness could not encode the prepared image."));
    };
    reader.onerror = () =>
      reject(new Error("Chefness could not read the prepared image."));
    reader.readAsDataURL(blob);
  });
}
