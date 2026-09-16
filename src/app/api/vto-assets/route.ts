import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';
const BUCKET = 'vto-models';
const MAX_BYTES = 50 * 1024 * 1024;
const TRANSITIONS: Record<string, string[]> = { UPLOADED: ['CALIBRATED'], CALIBRATED: ['APPROVED'], APPROVED: ['PUBLISHED'] };
const validNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const validTransform = (t: any) => !!t && ['position','rotation'].every(k => t[k] && ['x','y','z'].every(a => validNumber(t[k][a]))) && validNumber(t.scale) && t.scale > 0;
const publicUrl = (path: string) => supabase!.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export async function GET(req: NextRequest) {
  const auth = await requireManagerOrHigher(req);
  if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
  const assetId = req.nextUrl.searchParams.get('assetId')?.trim();
  let query = supabase.from('vto_asset_calibrations').select('asset_id,name,status,vto_glb_url,storage_bucket,storage_path,source_storage_path,source_content_hash,source_size_bytes,frame_width_mm,lens_width_mm,bridge_width_mm,temple_length_mm,bridge_x,bridge_y,bridge_z,rotation_offset_euler,manual_transform,provenance,created_at,updated_at').order('updated_at', { ascending: false });
  if (assetId) query = query.eq('asset_id', assetId);
  const { data, error } = assetId ? await query.maybeSingle() : await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (assetId && !data) return NextResponse.json({ error: 'VTO asset not found' }, { status: 404 });
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return NextResponse.json({ assets: rows.map((a:any) => ({ assetId:a.asset_id,name:a.name,status:a.status,glbUrl:a.vto_glb_url || (a.storage_path ? publicUrl(a.storage_path) : null),storagePath:a.storage_path || a.source_storage_path,physicalDimensions:{frameWidthMm:a.frame_width_mm,lensWidthMm:a.lens_width_mm,bridgeWidthMm:a.bridge_width_mm,templeLengthMm:a.temple_length_mm},bridge:{x:a.bridge_x ?? 0,y:a.bridge_y ?? 0,z:a.bridge_z ?? 0},manualTransform:a.manual_transform,sourceContentHash:a.source_content_hash,sourceSizeBytes:a.source_size_bytes,provenance:a.provenance,createdAt:a.created_at,updatedAt:a.updated_at,attachable:a.status==='PUBLISHED'})) });
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireManagerOrHigher(req);
    if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    const body = await req.json().catch(() => null);
    const assetId = typeof body?.assetId === 'string' ? body.assetId.trim() : '';
    const nextStatus = typeof body?.status === 'string' ? body.status.trim().toUpperCase() : '';
    if (!assetId || !nextStatus) return NextResponse.json({ error: 'assetId and status are required' }, { status: 400 });
    const { data: asset, error } = await supabase.from('vto_asset_calibrations').select('*').eq('asset_id', assetId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!asset) return NextResponse.json({ error: 'VTO asset not found' }, { status: 404 });
    if (asset.status === nextStatus) return NextResponse.json({ success:true,assetId,status:nextStatus });
    if (!(TRANSITIONS[asset.status] || []).includes(nextStatus)) return NextResponse.json({ error:`Invalid lifecycle transition: ${asset.status} -> ${nextStatus}` }, { status:409 });
    if (nextStatus === 'APPROVED' && !validTransform(asset.manual_transform)) return NextResponse.json({ error:'A valid manual calibration must be saved before approval.' }, { status:422 });

    if (nextStatus === 'PUBLISHED') {
      const path = asset.source_storage_path || asset.storage_path;
      if (!path) return NextResponse.json({ error:'Production GLB storage path is missing.' }, { status:422 });
      const { data:file,error:readError } = await supabase.storage.from(asset.storage_bucket || BUCKET).download(path);
      if (readError || !file) return NextResponse.json({ error:'Production GLB could not be verified before publication.' }, { status:422 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return NextResponse.json({ error:'Production GLB is empty or exceeds the 50 MB source limit.' }, { status:422 });
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (asset.source_size_bytes && Number(asset.source_size_bytes) !== bytes.byteLength) return NextResponse.json({ error:'Production GLB size changed since upload.' }, { status:422 });
      if (asset.source_content_hash && asset.source_content_hash !== hash) return NextResponse.json({ error:'Production GLB content changed since upload.' }, { status:422 });
      if (!asset.vto_glb_url) {
        const url = publicUrl(path);
        const { error:updateUrlError } = await supabase.from('vto_asset_calibrations').update({ vto_glb_url:url }).eq('asset_id',assetId).eq('status','APPROVED');
        if (updateUrlError) return NextResponse.json({ error:updateUrlError.message }, { status:500 });
      }
      const { data:published,error:publishError } = await supabase.rpc('publish_vto_asset',{p_asset_id:assetId});
      if (publishError) return NextResponse.json({ error:`Publication transaction failed: ${publishError.message}` }, { status:500 });
      return NextResponse.json(published ?? { success:true,assetId,status:'PUBLISHED' });
    }

    const { error:updateError } = await supabase.from('vto_asset_calibrations').update({ status:nextStatus,updated_at:new Date().toISOString() }).eq('asset_id',assetId).eq('status',asset.status);
    if (updateError) return NextResponse.json({ error:updateError.message }, { status:500 });
    return NextResponse.json({ success:true,assetId,status:nextStatus });
  } catch (err) {
    return NextResponse.json({ error:err instanceof Error ? err.message : 'VTO lifecycle update failed' }, { status:500 });
  }
}
