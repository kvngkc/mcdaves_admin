// src/app/api/upload-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';
import { isAllowedImageMime, extensionForMime, isValidImageMagicBytes } from '@/lib/security/image-upload';

// Step 2.5: sharp needs the Node runtime, not Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const imageType = (formData.get('imageType') as string) || 'front'; // front | side | lifestyle

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    if (!isAllowedImageMime(file.type)) {
      return NextResponse.json(
        { error: 'Invalid image format. Supported formats: WEBP, PNG, JPG, JPEG.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image size exceeds maximum allowed limit (10MB).' },
        { status: 400 },
      );
    }

    // Step 2.5: the stored extension comes from the validated MIME type, never
    // from the caller-supplied filename.
    const ext = extensionForMime(file.type);
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
    }

    const baseClean = (file.name || 'upload')
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 60) || 'upload';

    const buffer = Buffer.from(await file.arrayBuffer());

    // Step 2.5: reject spoofed content types — the bytes must really be an image.
    if (!(await isValidImageMagicBytes(buffer))) {
      return NextResponse.json(
        { error: 'File content is not a valid image.' },
        { status: 400 },
      );
    }

    const sanitizedFilename = `products/${imageType}_${baseClean}_${Date.now().toString().slice(-4)}.${ext}`;

    // Upload to Supabase Storage bucket 'product-media'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-media')
      .upload(sanitizedFilename, buffer, {
        contentType: file.type,
        // Step 2.5: never overwrite an existing object.
        upsert: false,
      });

    if (uploadError || !uploadData) {
      console.error('[upload-image] Storage upload failed', {
        bucket: 'product-media',
        message: uploadError?.message || 'No upload data returned',
        name: uploadError?.name,
        details: uploadError,
        filename: sanitizedFilename,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to upload image to storage.',
          code: 'STORAGE_UPLOAD_FAILED',
          details: process.env.NODE_ENV === 'development' ? uploadError?.message : undefined,
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('product-media')
      .getPublicUrl(sanitizedFilename);

    const imageUrl = publicUrlData?.publicUrl;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to verify uploaded image URL.', code: 'STORAGE_VERIFICATION_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        imageUrl,
        filename: sanitizedFilename,
        imageType,
        sizeBytes: file.size,
        message: 'Product photo uploaded successfully',
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process image upload';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
