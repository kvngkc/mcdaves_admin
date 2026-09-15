import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireManagerOrHigher(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('vto_asset_calibrations')
    .select('asset_id, name, status, vto_glb_url, physical_width_mm, lens_width_mm, bridge_width_mm, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    assets: (data || []).map((asset) => ({
      assetId: asset.asset_id,
      name: asset.name,
      status: asset.status,
      glbUrl: asset.vto_glb_url,
      physicalWidthMm: asset.physical_width_mm,
      lensWidthMm: asset.lens_width_mm,
      bridgeWidthMm: asset.bridge_width_mm,
      createdAt: asset.created_at,
      updatedAt: asset.updated_at,
      attachable: asset.status === 'PUBLISHED',
    })),
  });
}
