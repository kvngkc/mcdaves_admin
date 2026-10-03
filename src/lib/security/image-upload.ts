// src/lib/security/image-upload.ts
/**
 * Image upload allow-list + magic-byte validation (v4 plan step 2.5).
 *
 * The stored extension is derived from the VALIDATED MIME type via a fixed map —
 * never from `file.name.split('.').pop()`, which lets `evil.svg` / `evil.html`
 * through with a spoofed `image/png` content-type. Magic bytes are checked so a
 * file whose bytes are not actually an image is rejected even if its MIME lies.
 */
import sharp from 'sharp';

export const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/avif': 'avif',
};

export function isAllowedImageMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(MIME_TO_EXTENSION, mime);
}

export function extensionForMime(mime: string): string | null {
  return MIME_TO_EXTENSION[mime] ?? null;
}

/** Validate real image bytes (format + dimensions) with sharp. */
export async function isValidImageMagicBytes(buffer: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(buffer).metadata();
    return Boolean(meta.format) && (meta.width ?? 0) > 0 && (meta.height ?? 0) > 0;
  } catch {
    return false;
  }
}
