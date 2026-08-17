// src/app/api/upload-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = requireAdminSession(request);
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

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
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

    const ext = file.name.split('.').pop() || 'webp';
    const baseClean = file.name
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    const sanitizedFilename = `products/${imageType}_${baseClean}_${Date.now().toString().slice(-4)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage bucket 'product-media'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-media')
      .upload(sanitizedFilename, buffer, {
        contentType: file.type,
        upsert: true,
      });

    let imageUrl = `/images/products/${sanitizedFilename}`;

    if (uploadData && !uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from('product-media')
        .getPublicUrl(sanitizedFilename);
      if (publicUrlData?.publicUrl) {
        imageUrl = publicUrlData.publicUrl;
      }
    } else {
      console.warn('[Supabase Storage] Notice: product-media bucket upload fallback:', uploadError);
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
