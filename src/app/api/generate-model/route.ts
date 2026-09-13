// src/app/api/generate-model/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';
import {
  buildParametricEyewear,
  exportGroupToOptimizedGlb,
  EyewearStyle,
} from '@/lib/vto/parametric-eyewear-builder';
import { convertImageTo3DGlb } from '@/lib/vto/image-to-glb-builder';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const contentType = request.headers.get('content-type') || '';
    let optResult;
    let productName = 'Eyewear Frame';
    let variantName = 'Custom';

    if (contentType.includes('multipart/form-data')) {
      // ─── 1. 2D IMAGE TO 3D GLB PIPELINE ────────────────────────────────────
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      productName = (formData.get('productName') as string) || productName;
      variantName = (formData.get('variantName') as string) || variantName;
      const frameWidthMm = Number(formData.get('frameWidthMm')) || 140;

      if (!file) {
        return NextResponse.json({ error: 'No image file provided for 3D conversion' }, { status: 400 });
      }

      const imageBuffer = Buffer.from(await file.arrayBuffer());
      optResult = await convertImageTo3DGlb(imageBuffer, { frameWidthMm, wrapRadiusMm: 145 });
    } else {
      // ─── 2. PARAMETRIC VECTOR GENERATOR ────────────────────────────────────
      const body = await request.json();
      const {
        style = 'round',
        colorHex = '#1A1A1A',
        materialType = 'acetate',
        frameWidthMm = 140,
        lensWidthMm = 50,
        lensHeightMm = 40,
        bridgeWidthMm = 18,
      } = body;
      productName = body.productName || productName;
      variantName = body.variantName || variantName;

      const modelGroup = buildParametricEyewear({
        style: style as EyewearStyle,
        colorHex,
        materialType: materialType as 'acetate' | 'metal' | 'tortoise',
        frameWidthMm: Number(frameWidthMm) || 140,
        lensWidthMm: Number(lensWidthMm) || 50,
        lensHeightMm: Number(lensHeightMm) || 40,
        bridgeWidthMm: Number(bridgeWidthMm) || 18,
      });

      optResult = await exportGroupToOptimizedGlb(modelGroup);
    }

    // 3. Sanitize filename
    const cleanPrefix = `${productName}_${variantName}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    const sanitizedFilename = `mcd_vto_${cleanPrefix}_${Date.now().toString().slice(-4)}.glb`;

    // 4. Upload to Supabase Storage bucket 'vto-models'
    const bucketName = 'vto-models';
    const storagePath = `tmp_${sanitizedFilename}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, optResult.optimizedBuffer, {
        contentType: 'model/gltf-binary',
        upsert: true,
      });

    if (uploadError || !uploadData) {
      throw new Error(`Storage upload failed: ${uploadError?.message || 'Unknown error'}`);
    }

    // 5. Verify Durable Storage (Verify object actually exists)
    // Wait for the object to be fully written or just get its metadata
    // In Supabase, upload is atomic but we can verify it by getting public URL or checking if we can download it. 
    // A better check is to list or get metadata if possible. For simplicity, we just check if we can get publicUrl, but we should also check the db if needed. Wait, getPublicUrl is synchronous and doesn't check existence. 
    // We can use createSignedUrl or download to verify, but download is heavy. Let's just assume `upload` returning success is a good start, but the user requested explicit verification. We will use `download` with a byte range of 0-1, or just let `uploadData` be enough? No, user explicitly said: "Storage Object Verification: Returning a public URL is not sufficient. The system must verify the expected storage object exists (e.g. by querying the object metadata or ensuring the upload returns a positive byte size) before creating the production DB record."
    // Let's query object metadata (supabase storage doesn't have a direct stat, but we can do list or download). Wait, upload returns { path: string, id?: string }. Wait, supabase storage `upload` returns { data: { path: string, ... }, error: null } if successful. There is no `headObject` equivalent in the standard `supabase-js` v2 for storage unless we list files. 
    // Let's use `from(bucketName).list()` to verify it exists and has positive size.
    const { data: listData, error: listError } = await supabase.storage
      .from(bucketName)
      .list(undefined, { search: storagePath });
      
    const uploadedObject = listData?.find(item => item.name === storagePath);
    if (listError || !uploadedObject || uploadedObject.metadata?.size === 0) {
      // If we can't find it or size is 0, the upload was not truly successful
      throw new Error('Storage verification failed: object not found or empty after upload.');
    }

    let glbUrl = '';
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);
    if (publicUrlData?.publicUrl) {
      glbUrl = publicUrlData.publicUrl;
    } else {
       throw new Error('Failed to generate public URL for storage object.');
    }

    // 6. Return temporary URL for client processing
    return NextResponse.json(
      {
        success: true,
        glbPath: glbUrl,
        filename: sanitizedFilename,
        sizeBytes: optResult.optimizedSizeBytes,
        originalSizeBytes: optResult.originalSizeBytes,
        savingsPercent: optResult.savingsPercent,
        summary: `3D model generated (temporary): ${(optResult.optimizedSizeBytes / 1024).toFixed(1)} KB`,
        message: '3D GLB model generated and optimized successfully',
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate 3D model';
    console.error('[/api/generate-model] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
