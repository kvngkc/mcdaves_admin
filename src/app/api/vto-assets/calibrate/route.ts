import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const validTransform = (t: any) => !!t && ['position','rotation'].every(k => t[k] && ['x','y','z'].every(a => num(t[k][a]))) && num(t.scale) && t.scale > 0;
const dimensions = ['frameWidthMm','lensWidthMm','bridgeWidthMm','templeLengthMm'] as const;
const columns = { frameWidthMm:'frame_width_mm', lensWidthMm:'lens_width_mm', bridgeWidthMm:'bridge_width_mm', templeLengthMm:'temple_length_mm' } as const;

export async function POST(req: NextRequest) {
  const auth = await requireManagerOrHigher(req);
  if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
  const body = await req.json().catch(() => null);
  const assetId = typeof body?.assetId === 'string' ? body.assetId.trim() : '';
  if (!assetId || !validTransform(body?.manualTransform)) return NextResponse.json({ error: 'assetId and a complete manualTransform are required.' }, { status: 400 });
  const patch: Record<string, unknown> = { manual_transform: body.manualTransform, rotation_offset_euler: body.manualTransform.rotation, bridge_x: num(body.bridge?.x) ? body.bridge.x : 0, bridge_y: num(body.bridge?.y) ? body.bridge.y : 0, bridge_z: num(body.bridge?.z) ? body.bridge.z : 0, metadata_source: 'McDaves VTO Manual Calibration Studio', status: 'CALIBRATED', updated_at: new Date().toISOString() };
  if (body.physicalDimensions && typeof body.physicalDimensions === 'object') for (const key of dimensions) if (body.physicalDimensions[key] == null || num(body.physicalDimensions[key])) patch[columns[key]] = body.physicalDimensions[key] ?? null;
  const { data, error } = await supabase.from('vto_asset_calibrations').update(patch).eq('asset_id', assetId).in('status', ['UPLOADED','CALIBRATED']).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'VTO asset not found or no longer editable.' }, { status: 404 });
  return NextResponse.json({ asset: data });
}
