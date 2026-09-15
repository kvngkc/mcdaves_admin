// src/app/api/generate-model/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';
import { buildParametricEyewear, exportGroupToOptimizedGlb, EyewearStyle } from '@/lib/vto/parametric-eyewear-builder';
import { convertImageTo3DGlb } from '@/lib/vto/image-to-glb-builder';
import { registerStoredVtoAsset } from '@/lib/vto/register-stored-asset';
import { parsePositiveMillimeters } from '@/lib/vto/physical-dimensions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });

    const contentType = request.headers.get('content-type') || '';
    let optResult: any;
    let productName = 'Eyewear Frame';
    let variantName = 'Custom';
    let frameWidthMm: number;
    let bridgeWidthMm: number;
    let lensWidthMm: number;
    let lensHeightMm: number;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      productName = (formData.get('productName') as string) || productName;
      variantName = (formData.get('variantName') as string) || variantName;
      if (!file) return NextResponse.json({ error: 'No image file provided for 3D conversion' }, { status: 400 });
      frameWidthMm = parsePositiveMillimeters(formData.get('frameWidthMm'), 'Frame width');
      bridgeWidthMm = parsePositiveMillimeters(formData.get('bridgeWidthMm'), 'Bridge width');
      lensWidthMm = parsePositiveMillimeters(formData.get('lensWidthMm'), 'Lens width');
      lensHeightMm = parsePositiveMillimeters(formData.get('lensHeightMm'), 'Lens height');
      optResult = await convertImageTo3DGlb(Buffer.from(await file.arrayBuffer()), { frameWidthMm, wrapRadiusMm: frameWidthMm });
    } else {
      const body = await request.json();
      const style = body.style || 'round';
      const colorHex = body.colorHex || '#1A1A1A';
      const materialType = body.materialType || 'acetate';
      productName = body.productName || productName;
      variantName = body.variantName || variantName;
      frameWidthMm = parsePositiveMillimeters(body.frameWidthMm, 'Frame width');
      lensWidthMm = parsePositiveMillimeters(body.lensWidthMm, 'Lens width');
      lensHeightMm = parsePositiveMillimeters(body.lensHeightMm, 'Lens height');
      bridgeWidthMm = parsePositiveMillimeters(body.bridgeWidthMm, 'Bridge width');
      const modelGroup = buildParametricEyewear({ style: style as EyewearStyle, colorHex, materialType: materialType as 'acetate' | 'metal' | 'tortoise', frameWidthMm, lensWidthMm, lensHeightMm, bridgeWidthMm });
      optResult = await exportGroupToOptimizedGlb(modelGroup);
    }

    const cleanPrefix = `${productName}_${variantName}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
    const sanitizedFilename = `mcd_vto_${cleanPrefix}_${Date.now().toString().slice(-4)}.glb`;
    const bucketName = 'vto-models';
    const storagePath = `tmp_${sanitizedFilename}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, optResult.optimizedBuffer, { contentType: 'model/gltf-binary', upsert: true });
    if (uploadError || !uploadData) throw new Error(`Storage upload failed: ${uploadError?.message || 'Unknown error'}`);
    const { data: listData, error: listError } = await supabase.storage.from(bucketName).list(undefined, { search: storagePath });
    const uploadedObject = listData?.find((item) => item.name === storagePath);
    if (listError || !uploadedObject || uploadedObject.metadata?.size === 0) throw new Error('Storage verification failed: object not found or empty after upload.');
    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    const glbUrl = publicUrlData?.publicUrl;
    if (!glbUrl) throw new Error('Failed to generate public URL for storage object.');

    const assetId = `vto_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const evidence = {
      assetId,
      name: `${productName} - ${variantName}`,
      physicalDimensions: { frameWidthMm, lensWidthMm, bridgeWidthMm, templeLengthMm: null },
      registration: { bridge: { x: 0, y: 0, z: 0 }, measuredNativeWidth: 0, widthMultiplier: 1, rotationOffsetEuler: { x: 0, y: 0, z: 0 }, pantoscopicTilt: -12 },
      orientation: { forward: '-Z', up: 'Y', handedness: 'right' },
      templeProcessing: {}, versioning: { source: 'admin-generator' }, paths: { sourceGlbUrl: glbUrl },
    };
    const registration = await registerStoredVtoAsset({ storagePath, evidence, tmpGlbUrl: glbUrl });
    if (!registration.success) return NextResponse.json({ error: registration.rejectionNotes || registration.message, status: registration.status, assetId: registration.assetId }, { status: 422 });

    return NextResponse.json({ success: true, glbPath: registration.glbPath, vtoAssetId: registration.assetId, status: registration.status, filename: sanitizedFilename, sizeBytes: optResult.optimizedSizeBytes, originalSizeBytes: optResult.originalSizeBytes, savingsPercent: optResult.savingsPercent, summary: `3D model generated and registered as a VTO asset (temporary processing complete): ${(optResult.optimizedSizeBytes / 1024).toFixed(1)} KB`, message: '3D GLB model generated, validated, and is awaiting VTO review' }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate 3D model' }, { status: 400 });
  }
}
