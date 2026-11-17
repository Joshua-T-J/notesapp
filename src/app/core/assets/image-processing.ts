/** Raster formats we accept. SVG is refused: it can carry scripts and external references. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
];
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_SIDE = 1600;

export class ImageError extends Error {}

/**
 * Prepares a picked or pasted image for storage: checks the type and size, scales it down to at
 * most 1600 px on the long side, and re-encodes it as WebP (JPEG where WebP encoding is missing).
 * Re-encoding also drops embedded metadata such as camera location.
 */
export async function prepareImage(file: Blob): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageError('That file type isn’t supported. Use PNG, JPEG, WebP, GIF or AVIF.');
  }
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('That image is larger than 25 MB.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError('That image couldn’t be read.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('That image couldn’t be processed.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode('image/webp', 0.82);
  const blob = webp?.type === 'image/webp' ? webp : await encode('image/jpeg', 0.85);
  if (!blob) throw new ImageError('That image couldn’t be processed.');
  return blob;
}

export function extensionFor(type: string): string {
  return type === 'image/jpeg' ? 'jpg' : (type.split('/')[1] ?? 'bin');
}
