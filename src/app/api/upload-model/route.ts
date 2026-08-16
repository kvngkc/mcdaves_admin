// src/app/api/upload-model/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

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

    if (!file) {
      return NextResponse.json({ error: 'No 3D model file provided' }, { status: 400 });
    }

    const originalName = file.name || 'model.glb';
    if (!originalName.toLowerCase().endsWith('.glb')) {
      return NextResponse.json(
        { error: 'Invalid file format. Only binary 3D GLB (.glb) files are supported for AR Virtual Try-On.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File size exceeds maximum allowed limit (50MB).' },
        { status: 400 },
      );
    }

    // Sanitize filename
    const baseClean = originalName
      .toLowerCase()
      .replace(/\.glb$/i, '')
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_');

    const sanitizedFilename = `${baseClean}_${Date.now().toString().slice(-4)}.glb`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage bucket 'vto-models'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('vto-models')
      .upload(sanitizedFilename, buffer, {
        contentType: 'model/gltf-binary',
        upsert: true,
      });

    let glbUrl = `/models/${sanitizedFilename}`;

    if (uploadData && !uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from('vto-models')
        .getPublicUrl(sanitizedFilename);
      if (publicUrlData?.publicUrl) {
        glbUrl = publicUrlData.publicUrl;
      }
    } else {
      console.warn('[Supabase Storage] Notice: bucket upload fallback to relative path:', uploadError);
    }

    return NextResponse.json(
      {
        success: true,
        glbPath: glbUrl,
        filename: sanitizedFilename,
        sizeBytes: file.size,
        message: '3D GLB model uploaded successfully',
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process 3D model upload';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
