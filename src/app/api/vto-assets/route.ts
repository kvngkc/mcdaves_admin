import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, string[]> = {
  REVIEW_REQUIRED: ['APPROVED'],
  APPROVED: ['PUBLISHED'],
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireManagerOrHigher(req);
  if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });

  const { data, error } = await supabase
    .from('vto_asset_calibrations')
    .select('asset_id, name, status, vto_glb_url, physical_width_mm, lens_width_mm, bridge_width_mm, pantoscopic_tilt, bridge_x, bridge_y, bridge_z, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    assets: (data || []).map((asset) => ({
      assetId: asset.asset_id,
      name: asset.name,
      status: asset.status,
      glbUrl: asset.vto_glb_url,
      physicalWidthMm: asset.physical_width_mm,
      lensWidthMm: asset.lens_width_mm,
      bridgeWidthMm: asset.bridge_width_mm,
      pantoscopicTilt: asset.pantoscopic_tilt,
      bridge: { x: asset.bridge_x, y: asset.bridge_y, z: asset.bridge_z },
      createdAt: asset.created_at,
      updatedAt: asset.updated_at,
      attachable: asset.status === 'PUBLISHED',
    })),
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const auth = await requireManagerOrHigher(req);
  if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const assetId = typeof body?.assetId === 'string' ? body.assetId.trim() : '';
  const nextStatus = typeof body?.status === 'string' ? body.status.trim().toUpperCase() : '';
  if (!assetId || !nextStatus) return NextResponse.json({ error: 'assetId and status are required' }, { status: 400 });

  const { data: asset, error: fetchError } = await supabase
    .from('vto_asset_calibrations')
    .select('asset_id, status, vto_glb_url, physical_width_mm')
    .eq('asset_id', assetId)
    .single();

  if (fetchError || !asset) return NextResponse.json({ error: 'VTO asset not found' }, { status: 404 });
  if (asset.status === nextStatus) return NextResponse.json({ success: true, assetId, status: nextStatus });

  const allowed = TRANSITIONS[asset.status] || [];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json({ error: `Invalid VTO lifecycle transition: ${asset.status} -> ${nextStatus}` }, { status: 409 });
  }

  if (nextStatus === 'APPROVED' && (!asset.vto_glb_url || !asset.physical_width_mm)) {
    return NextResponse.json({ error: 'Asset must have a GLB URL and physical frame width before approval.' }, { status: 422 });
  }

  const { error: updateError } = await supabase
    .from('vto_asset_calibrations')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('asset_id', assetId)
    .eq('status', asset.status);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ success: true, assetId, status: nextStatus });
}
