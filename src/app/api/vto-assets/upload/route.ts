import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';

const BUCKET = 'vto-models';
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireManagerOrHigher(req);
  if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
  const body = await req.json().catch(() => null);
  const variantId = typeof body?.variantId === 'string' ? body.variantId.trim() : '';
  const filename = typeof body?.filename === 'string' ? body.filename.trim() : '';
  const sizeBytes = Number(body?.sizeBytes);
  if (!variantId || !filename || !/\.glb$/i.test(filename) || !Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) return NextResponse.json({ error: 'Valid variant, .glb filename and size up to 50 MB are required.' }, { status: 400 });
  const { data: variant, error: variantError } = await supabase.from('product_variants').select('id,product_id,name').eq('id', variantId).maybeSingle();
  if (variantError) return NextResponse.json({ error: variantError.message }, { status: 500 });
  if (!variant) return NextResponse.json({ error: 'Variant not found.' }, { status: 404 });
  const assetId = `vto-${variantId}-${randomUUID()}`;
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${assetId}/production/${safe}`;
  const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signedError || !signed) return NextResponse.json({ error: signedError?.message || 'Could not create upload URL.' }, { status: 500 });
  const { error: insertError } = await supabase.from('vto_asset_calibrations').insert({ id: assetId, asset_id: assetId, name: variant.name, status: 'UPLOADED', vto_glb_url: '', storage_bucket: BUCKET, storage_path: path, source_storage_path: path, manual_transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, provenance: { variantId, productId: variant.product_id, sourceFileName: filename, requestedSizeBytes: sizeBytes } });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ assetId, variantId, path, signedUrl: signed.signedUrl, token: signed.token, bucket: BUCKET });
}
