// src/app/api/upload-model/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // --- STEP 1: Generate Signed Upload URL ---
    if (body.action === 'generate-url') {
      const originalName = body.filename || 'model.glb';
      if (!originalName.toLowerCase().endsWith('.glb')) {
        return NextResponse.json({ error: 'Invalid file format. Must be .glb' }, { status: 400 });
      }

      const baseClean = originalName.toLowerCase().replace(/\.glb$/i, '').replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
      const rawPath = `raw_${baseClean}_${Date.now()}.glb`;

      // Create signed upload URL for the raw file
      const { data, error } = await supabase.storage.from('vto-models').createSignedUploadUrl(rawPath);
      
      if (error || !data) {
        return NextResponse.json({ error: 'Failed to generate upload URL', details: error?.message }, { status: 500 });
      }

      return NextResponse.json({
        signedUrl: data.signedUrl,
        path: data.path,
        token: data.token,
      });
    }

    // --- STEP 2: Process Uploaded File ---
    if (body.action === 'process-model') {
      const rawPath = body.rawPath;
      if (!rawPath) return NextResponse.json({ error: 'rawPath required' }, { status: 400 });

      try {
        // 1. Download raw file from Supabase
        const { data: fileData, error: downloadError } = await supabase.storage.from('vto-models').download(rawPath);
        if (downloadError || !fileData) {
          return NextResponse.json({ error: 'Failed to download raw model from storage' }, { status: 500 });
        }

        const arrayBuf = await fileData.arrayBuffer();
        const rawBuffer = Buffer.from(arrayBuf);
        const originalSizeBytes = rawBuffer.length;
        
        if (originalSizeBytes > MAX_FILE_SIZE_BYTES) {
          return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 });
        }

        // 2. Optimize and center
        let finalBuffer: Buffer = rawBuffer as Buffer;
        let optimizedSizeBytes = originalSizeBytes;
        let savingsPercent = 0;

        try {
          const { optimizeGlbBuffer } = await import('@/lib/vto/glb-optimizer');
          const optResult = await optimizeGlbBuffer(rawBuffer, { maxTextureDimension: 1024, textureQuality: 82 });
          finalBuffer = optResult.optimizedBuffer;
          optimizedSizeBytes = optResult.optimizedSizeBytes;
          savingsPercent = optResult.savingsPercent;
        } catch (optError) {
          console.warn('[VTO] Optimization failed; uploading original binary:', optError);
        }

        // 3. Upload optimized file to final path
        const finalPath = rawPath.replace(/^raw_/, 'tmp_');
        const bucketName = 'vto-models';
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(finalPath, finalBuffer, {
            contentType: 'model/gltf-binary',
            upsert: true,
          });

        if (uploadError || !uploadData) {
          throw new Error(`Failed to upload optimized model: ${uploadError?.message || 'Unknown error'}`);
        }

        // 4. Verify Durable Storage (Verify object actually exists)
        const { data: listData, error: listError } = await supabase.storage
          .from(bucketName)
          .list(undefined, { search: finalPath });
          
        const uploadedObject = listData?.find(item => item.name === finalPath);
        if (listError || !uploadedObject || uploadedObject.metadata?.size === 0) {
          throw new Error('Storage verification failed: object not found or empty after upload.');
        }

        let glbUrl = '';
        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(finalPath);
        if (publicUrlData?.publicUrl) {
          glbUrl = publicUrlData.publicUrl;
        } else {
           throw new Error('Failed to generate public URL for storage object.');
        }

        // 5. Return temporary URL for client processing

        return NextResponse.json(
          {
            success: true,
            glbPath: glbUrl,
            storagePath: finalPath,
            filename: finalPath,
            sizeBytes: optimizedSizeBytes,
            originalSizeBytes,
            savingsPercent,
            compressionSummary: `${(originalSizeBytes / (1024 * 1024)).toFixed(2)} MB ➔ ${(optimizedSizeBytes / 1024).toFixed(1)} KB (${savingsPercent}% saved)`,
            message: '3D GLB model uploaded, centered, and optimized successfully',
          },
          { status: 201 },
        );
      } finally {
        // ALWAYS clean up the temporary raw file from Supabase
        await supabase.storage.from('vto-models').remove([rawPath]).catch(() => null);
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process 3D model upload';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
