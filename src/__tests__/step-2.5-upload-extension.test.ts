import { describe, it, expect } from 'vitest';
import { isAllowedImageMime, extensionForMime, isValidImageMagicBytes } from '@/lib/security/image-upload';
import sharp from 'sharp';

// Step 2.5 — Constrain uploaded file extensions.
// Verify: an .svg or .html upload with a spoofed image content type is rejected;
// an upload cannot overwrite an existing object; the route reports Node runtime.

describe('2.5 — uploaded file extension allow-list + magic bytes', () => {
  it('derives the extension from the validated MIME type, never the filename', () => {
    expect(extensionForMime('image/webp')).toBe('webp');
    expect(extensionForMime('image/png')).toBe('png');
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/avif')).toBe('avif');
    expect(extensionForMime('image/svg+xml')).toBeNull();
    expect(extensionForMime('text/html')).toBeNull();
    expect(isAllowedImageMime('image/svg+xml')).toBe(false);
    expect(isAllowedImageMime('text/html')).toBe(false);
    expect(isAllowedImageMime('image/png')).toBe(true);
  });

  it('rejects a spoofed .svg payload claiming image/png (not real image bytes)', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(await isValidImageMagicBytes(svg)).toBe(false);
    const html = Buffer.from('<!doctype html><script>alert(1)</script>');
    expect(await isValidImageMagicBytes(html)).toBe(false);
  });

  it('accepts genuine image bytes', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } }).png().toBuffer();
    expect(await isValidImageMagicBytes(png)).toBe(true);
  });
});
