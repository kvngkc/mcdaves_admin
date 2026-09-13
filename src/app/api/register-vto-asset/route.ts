// src/app/api/register-vto-asset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';
import { validateAssetConsistency, ClientAssetCalibrationEvidence } from '@/lib/vto/vto-validation-core';
import crypto from 'node:crypto';

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

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: 'Invalid FormData' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    const evidenceStr = formData.get('evidence') as string | null;
    const clientValidationStatus = formData.get('clientValidationStatus') as string | null;
    const tmpGlbUrl = formData.get('tmpGlbUrl') as string | null;

    if (!file || !evidenceStr) {
      return NextResponse.json({ error: 'Missing file or evidence in request' }, { status: 400 });
    }

    let evidence: ClientAssetCalibrationEvidence;
    try {
      evidence = JSON.parse(evidenceStr);
    } catch (err) {
      return NextResponse.json({ error: 'Evidence is not valid JSON' }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    const glbBuffer = Buffer.from(arrayBuf);

    // 1. Server-Side Consistency Validation
    const validationResult = await validateAssetConsistency(glbBuffer, evidence);

    const assetId = evidence.assetId || `vto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const baseName = evidence.name || 'Unknown Model';

    // 2. Derive Lifecycle Status
    let derivedStatus = 'REVIEW_REQUIRED';
    let rejectionNotes = null;

    if (clientValidationStatus === 'FAIL') {
      derivedStatus = 'PROCESSING_FAILED';
      rejectionNotes = 'Client AssetValidator rejected the asset.';
    } else if (!validationResult.isValid) {
      derivedStatus = validationResult.recommendedStatus;
      rejectionNotes = `Server Validation Failed: ${validationResult.failureReason}`;
    }

    // 3. Duplicate check / Idempotency
    const { data: existingAsset } = await supabase
      .from('vto_asset_calibrations')
      .select('id, asset_content_hash, status')
      .eq('asset_id', assetId)
      .single();

    if (existingAsset) {
      // If the exact same byte content was uploaded and it's already recorded, just return success
      if (existingAsset.asset_content_hash === validationResult.contentHash) {
        return NextResponse.json({
          success: true,
          status: existingAsset.status,
          assetId,
          contentHash: validationResult.contentHash,
          message: 'VTO Asset already registered with identical contents.',
        }, { status: 200 });
      }
      // If it exists but with different contents, we'll allow overwriting/updating since it's a registration retry
      // provided it hasn't reached PUBLISHED.
      if (existingAsset.status === 'APPROVED' || existingAsset.status === 'PUBLISHED') {
        return NextResponse.json({
          error: 'Cannot overwrite an asset that is already APPROVED or PUBLISHED.'
        }, { status: 409 });
      }
    }

    // 4. Durable Storage Upload
    const bucketName = 'vto-models';
    const storagePath = `opt_${assetId}_${validationResult.contentHash.substring(0, 8)}.glb`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, glbBuffer, {
        contentType: 'model/gltf-binary',
        upsert: true,
      });

    if (uploadError || !uploadData) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError?.message}` }, { status: 500 });
    }

    // 5. Verify Durable Storage exists
    const { data: listData, error: listError } = await supabase.storage
      .from(bucketName)
      .list(undefined, { search: storagePath });

    const uploadedObject = listData?.find(item => item.name === storagePath);
    if (listError || !uploadedObject || uploadedObject.metadata?.size === 0) {
      return NextResponse.json({ error: 'Storage verification failed: object not found or empty after upload.' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    const glbUrl = publicUrlData?.publicUrl;
    if (!glbUrl) {
      return NextResponse.json({ error: 'Failed to generate public URL for storage object.' }, { status: 500 });
    }

    // 6. Database Registration
    const dbRecord: any = {
      asset_id: assetId,
      name: baseName,
      status: derivedStatus,
      source_glb_url: evidence.paths?.sourceGlbUrl || glbUrl, // Keep source if provided, else self
      vto_glb_url: glbUrl,
      storage_bucket: bucketName,
      storage_path: storagePath,
      asset_content_hash: validationResult.contentHash,
      physical_width_mm: evidence.physicalDimensions?.frameWidthMm || null,
      lens_width_mm: evidence.physicalDimensions?.lensWidthMm || null,
      bridge_width_mm: evidence.physicalDimensions?.bridgeWidthMm || null,
      pantoscopic_tilt: evidence.registration?.pantoscopicTilt || -12,
      bridge_x: evidence.registration?.bridge?.x || 0,
      bridge_y: evidence.registration?.bridge?.y || 0,
      bridge_z: evidence.registration?.bridge?.z || 0,
    };

    let dbError;
    if (existingAsset) {
      const { error } = await supabase.from('vto_asset_calibrations').update(dbRecord).eq('asset_id', assetId);
      dbError = error;
    } else {
      const { error } = await supabase.from('vto_asset_calibrations').insert({ id: crypto.randomUUID(), ...dbRecord });
      dbError = error;
    }

    if (dbError) {
      console.warn(`[ORPHAN_STORAGE_WARNING] DB save failed for asset ${assetId}. Error: ${dbError.message}`);
      return NextResponse.json({ error: `Database registration failed: ${dbError.message}` }, { status: 500 });
    }

    // 7. Clean up tmp_ file if provided
    if (tmpGlbUrl && tmpGlbUrl.includes('tmp_')) {
      const tmpFileName = tmpGlbUrl.split('/').pop();
      if (tmpFileName) {
        await supabase.storage.from('vto-models').remove([tmpFileName]).catch(() => null);
      }
    }

    if (derivedStatus !== 'REVIEW_REQUIRED') {
      return NextResponse.json(
        {
          success: false,
          status: derivedStatus,
          message: 'Asset processing failed validation and was saved in a failed state.',
          rejectionNotes,
          assetId,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: derivedStatus,
        assetId,
        glbPath: glbUrl,
        contentHash: validationResult.contentHash,
        message: 'VTO Asset registered successfully and is awaiting review.',
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to register VTO asset';
    console.error('[/api/register-vto-asset] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
