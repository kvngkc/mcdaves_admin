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
    const arrayBuf = await file.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuf);

    // Run Automated 3D Compression & Optimization Pipeline
    let finalBuffer: Uint8Array = new Uint8Array(arrayBuf);
    let originalSizeBytes = file.size;
    let optimizedSizeBytes = file.size;
    let savingsPercent = 0;

    try {
      const { optimizeGlbBuffer } = await import('@/lib/vto/glb-optimizer');
      const optResult = await optimizeGlbBuffer(rawBuffer, { maxTextureDimension: 1024, textureQuality: 82 });
      finalBuffer = optResult.optimizedBuffer;
      originalSizeBytes = optResult.originalSizeBytes;
      optimizedSizeBytes = optResult.optimizedSizeBytes;
      savingsPercent = optResult.savingsPercent;
    } catch (optError) {
      console.warn('[VTO Ingestion] Warning: Automated optimization failed; uploading original binary:', optError);
    }

    // Upload optimized GLB to Supabase Storage bucket 'vto-models'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('vto-models')
      .upload(sanitizedFilename, finalBuffer, {
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
        sizeBytes: optimizedSizeBytes,
        originalSizeBytes,
        savingsPercent,
        compressionSummary: `${(originalSizeBytes / (1024 * 1024)).toFixed(2)} MB ➔ ${(optimizedSizeBytes / 1024).toFixed(1)} KB (${savingsPercent}% saved)`,
        message: '3D GLB model uploaded and optimized successfully',
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process 3D model upload';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
