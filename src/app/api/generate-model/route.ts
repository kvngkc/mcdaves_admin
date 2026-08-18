// src/app/api/generate-model/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireAdminSession } from '@/lib/auth/admin-auth';
import {
  buildParametricEyewear,
  exportGroupToOptimizedGlb,
  EyewearStyle,
} from '@/lib/vto/parametric-eyewear-builder';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = requireAdminSession(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const body = await request.json();
    const {
      style = 'round',
      colorHex = '#1A1A1A',
      materialType = 'acetate',
      productName = 'Eyewear Frame',
      variantName = 'Standard',
      frameWidthMm = 140,
      lensWidthMm = 50,
      lensHeightMm = 40,
      bridgeWidthMm = 18,
    } = body;

    // 1. Build 3D Eyewear Model
    const modelGroup = buildParametricEyewear({
      style: style as EyewearStyle,
      colorHex,
      materialType: materialType as 'acetate' | 'metal' | 'tortoise',
      frameWidthMm: Number(frameWidthMm) || 140,
      lensWidthMm: Number(lensWidthMm) || 50,
      lensHeightMm: Number(lensHeightMm) || 40,
      bridgeWidthMm: Number(bridgeWidthMm) || 18,
    });

    // 2. Export to Optimized Binary GLB
    const optResult = await exportGroupToOptimizedGlb(modelGroup);

    // 3. Sanitize filename
    const cleanPrefix = `${productName}_${variantName}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    const sanitizedFilename = `mcd_${cleanPrefix}_${Date.now().toString().slice(-4)}.glb`;

    // 4. Upload to Supabase Storage bucket 'vto-models'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('vto-models')
      .upload(sanitizedFilename, optResult.optimizedBuffer, {
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
      console.warn('[Supabase Storage] Notice: upload fallback to relative path:', uploadError);
    }

    return NextResponse.json(
      {
        success: true,
        glbPath: glbUrl,
        filename: sanitizedFilename,
        sizeBytes: optResult.optimizedSizeBytes,
        originalSizeBytes: optResult.originalSizeBytes,
        savingsPercent: optResult.savingsPercent,
        summary: `3D model generated: ${(optResult.optimizedSizeBytes / 1024).toFixed(1)} KB`,
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
