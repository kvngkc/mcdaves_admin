import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, string[]> = {
  REVIEW_REQUIRED: ['APPROVED'],
  APPROVED: ['PUBLISHED'],
};

const MAX_DERIVED_SIZE_BYTES = 3 * 1024 * 1024;
const BUCKET = 'vto-models';

function storagePathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireManagerOrHigher(req);
  if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });

  const { data, error } = await supabase
    .from('vto_asset_calibrations')
    .select('asset_id, name, status, vto_glb_url, lens_width_mm, bridge_width_mm, bridge_x, bridge_y, bridge_z, measured_native_width, width_multiplier, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    assets: (data || []).map((asset) => {
      const nativeWidth = Number(asset.measured_native_width);
      const multiplier = Number(asset.width_multiplier);
      const physicalWidthMm = Number.isFinite(nativeWidth) && Number.isFinite(multiplier) && nativeWidth > 0 && multiplier > 0
        ? nativeWidth * multiplier
        : null;
      return {
        assetId: asset.asset_id,
        name: asset.name,
        status: asset.status,
        glbUrl: asset.vto_glb_url,
        physicalWidthMm,
        lensWidthMm: asset.lens_width_mm,
        bridgeWidthMm: asset.bridge_width_mm,
        measuredNativeWidth: Number.isFinite(nativeWidth) ? nativeWidth : null,
        widthMultiplier: Number.isFinite(multiplier) ? multiplier : null,
        bridge: { x: asset.bridge_x, y: asset.bridge_y, z: asset.bridge_z },
        createdAt: asset.created_at,
        updatedAt: asset.updated_at,
        attachable: asset.status === 'PUBLISHED',
      };
    }),
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(req);
    if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });

    const body = await req.json().catch(() => null);
    const assetId = typeof body?.assetId === 'string' ? body.assetId.trim() : '';
    const nextStatus = typeof body?.status === 'string' ? body.status.trim().toUpperCase() : '';
    if (!assetId || !nextStatus) return NextResponse.json({ error: 'assetId and status are required' }, { status: 400 });

    const { data: asset, error: fetchError } = await supabase
      .from('vto_asset_calibrations')
      .select('asset_id, name, status, vto_glb_url, storage_bucket, storage_path, source_storage_path, derived_storage_path, measured_native_width, width_multiplier, provenance')
      .eq('asset_id', assetId)
      .single();

    if (fetchError || !asset) return NextResponse.json({ error: 'VTO asset not found' }, { status: 404 });
    if (asset.status === nextStatus) return NextResponse.json({ success: true, assetId, status: nextStatus });

    const allowed = TRANSITIONS[asset.status] || [];
    if (!allowed.includes(nextStatus)) {
      return NextResponse.json({ error: `Invalid VTO lifecycle transition: ${asset.status} -> ${nextStatus}` }, { status: 409 });
    }

    if (nextStatus === 'APPROVED') {
      const nativeWidth = Number(asset.measured_native_width);
      const multiplier = Number(asset.width_multiplier);
      if (!asset.vto_glb_url || !Number.isFinite(nativeWidth) || nativeWidth <= 0 || !Number.isFinite(multiplier) || multiplier <= 0) {
        return NextResponse.json({ error: 'Asset must have a verified GLB, measured native width, and physical calibration before approval.' }, { status: 422 });
      }
    }

    if (nextStatus === 'PUBLISHED') {
      const sourcePath = asset.storage_path || storagePathFromPublicUrl(asset.vto_glb_url);
      if (!sourcePath) {
        return NextResponse.json({ error: 'Cannot publish VTO asset: verified GLB storage path is missing.' }, { status: 422 });
      }

      const bucket = asset.storage_bucket || BUCKET;
      const { data: fileData, error: downloadError } = await supabase.storage.from(bucket).download(sourcePath);
      if (downloadError || !fileData) {
        return NextResponse.json({ error: `Cannot publish VTO asset: failed to read verified GLB from storage. ${downloadError?.message || ''}`.trim() }, { status: 422 });
      }

      const bytes = new Uint8Array(await fileData.arrayBuffer());
      if (bytes.byteLength === 0) {
        return NextResponse.json({ error: 'Cannot publish VTO asset: GLB is empty.' }, { status: 422 });
      }
      if (bytes.byteLength > MAX_DERIVED_SIZE_BYTES) {
        return NextResponse.json({ error: `Cannot publish VTO asset: verified GLB is ${bytes.byteLength} bytes, above the ${MAX_DERIVED_SIZE_BYTES} byte publication limit.` }, { status: 422 });
      }

      const hash = createHash('sha256').update(bytes).digest('hex');
      const derivedPath = asset.derived_storage_path || `derived_${assetId}_${hash.slice(0, 16)}.glb`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from(bucket).upload(
        derivedPath,
        Buffer.from(bytes),
        { contentType: 'model/gltf-binary', upsert: true },
      );
      if (uploadError || !uploadData) {
        return NextResponse.json({ error: `Cannot publish VTO asset: failed to create verified derivative. ${uploadError?.message || ''}`.trim() }, { status: 422 });
      }

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(derivedPath);
      const derivedUrl = publicUrlData?.publicUrl;
      if (!derivedUrl) {
        return NextResponse.json({ error: 'Cannot publish VTO asset: failed to create derivative public URL.' }, { status: 422 });
      }

      const provenance = asset.provenance && typeof asset.provenance === 'object' ? asset.provenance : {};
      const { data: linkedVariant } = await supabase
        .from('product_variants')
        .select('id')
        .eq('vto_asset_id', assetId)
        .limit(1)
        .maybeSingle();

      const updatedProvenance = {
        ...provenance,
        variantId: provenance.variantId || linkedVariant?.id || undefined,
        publishedFrom: sourcePath,
        publishedAt: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('vto_asset_calibrations')
        .update({
          status: 'PUBLISHED',
          derived_storage_path: derivedPath,
          derived_content_hash: hash,
          derived_size_bytes: bytes.byteLength,
          output_size_status: 'PASS',
          vto_glb_url: derivedUrl,
          provenance: updatedProvenance,
          updated_at: new Date().toISOString(),
        })
        .eq('asset_id', assetId)
        .eq('status', 'APPROVED');

      if (updateError) {
        await supabase.storage.from(bucket).remove([derivedPath]).catch(() => null);
        return NextResponse.json({ error: `Cannot publish VTO asset: database publication failed. ${updateError.message}` }, { status: 500 });
      }

      if (sourcePath !== derivedPath) {
        await supabase.storage.from(bucket).remove([sourcePath]).catch(() => null);
      }

      return NextResponse.json({
        success: true,
        assetId,
        status: 'PUBLISHED',
        derivedStoragePath: derivedPath,
        derivedSizeBytes: bytes.byteLength,
        derivedContentHash: hash,
        vtoGlbUrl: derivedUrl,
      });
    }

    const { error: updateError } = await supabase
      .from('vto_asset_calibrations')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('asset_id', assetId)
      .eq('status', asset.status);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ success: true, assetId, status: nextStatus });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'VTO lifecycle update failed' }, { status: 500 });
  }
}
