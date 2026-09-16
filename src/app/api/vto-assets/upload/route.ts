import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';

const BUCKET = 'vto-models';
const MAX_BYTES = 50 * 1024 * 1024;
const GLB_MAGIC = 0x46546c67;

export async function POST(req: NextRequest) {
  const auth = await requireManagerOrHigher(req);
  if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const action = body?.action === 'verify' ? 'verify' : 'prepare';
  const variantId = typeof body?.variantId === 'string' ? body.variantId.trim() : '';
  const filename = typeof body?.filename === 'string' ? body.filename.trim() : '';
  const sizeBytes = Number(body?.sizeBytes);
  if (!variantId || !filename || !/\.glb$/i.test(filename)) return NextResponse.json({ error: 'A valid variant and .glb filename are required.' }, { status: 400 });
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) return NextResponse.json({ error: 'GLB size must be between 1 byte and 50 MB.' }, { status: 400 });

  const { data: variant, error: variantError } = await supabase.from('product_variants').select('id,product_id,name').eq('id', variantId).maybeSingle();
  if (variantError) return NextResponse.json({ error: variantError.message }, { status: 500 });
  if (!variant) return NextResponse.json({ error: 'Variant not found.' }, { status: 404 });

  if (action === 'prepare') {
    const assetId = `vto-${variantId}-${randomUUID()}`;
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${assetId}/production/${safe}`;
    const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signedError || !signed) return NextResponse.json({ error: signedError?.message || 'Could not create upload URL.' }, { status: 500 });
    return NextResponse.json({ assetId, variantId, path, signedUrl: signed.signedUrl, token: signed.token, bucket: BUCKET });
  }

  const path = typeof body?.path === 'string' ? body.path.trim() : '';
  const assetId = typeof body?.assetId === 'string' ? body.assetId.trim() : '';
  if (!assetId || !path || !path.startsWith(`${assetId}/production/`)) return NextResponse.json({ error: 'Upload verification requires the original assetId and production path.' }, { status: 400 });

  const { data: existing } = await supabase.from('vto_asset_calibrations').select('asset_id').eq('asset_id', assetId).maybeSingle();
  if (existing) return NextResponse.json({ error: 'This VTO upload has already been registered.' }, { status: 409 });

  const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
  if (downloadError || !file) return NextResponse.json({ error: 'Uploaded GLB could not be read from storage.' }, { status: 422 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== sizeBytes) return NextResponse.json({ error: `Uploaded GLB size mismatch. Expected ${sizeBytes} bytes, received ${bytes.byteLength}.` }, { status: 422 });
  if (bytes.byteLength < 12 || new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) !== GLB_MAGIC) return NextResponse.json({ error: 'Uploaded file is not a valid binary GLB.' }, { status: 422 });

  const sourceHash = createHash('sha256').update(bytes).digest('hex');
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: insertError } = await supabase.from('vto_asset_calibrations').insert({
    id: assetId,
    asset_id: assetId,
    name: variant.name,
    status: 'UPLOADED',
    vto_glb_url: publicUrl,
    storage_bucket: BUCKET,
    storage_path: path,
    source_storage_path: path,
    source_content_hash: sourceHash,
    source_size_bytes: bytes.byteLength,
    manual_transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
    provenance: { variantId, productId: variant.product_id, sourceFileName: filename, requestedSizeBytes: sizeBytes, sourceHash },
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ assetId, variantId, status: 'UPLOADED', sizeBytes: bytes.byteLength, sourceHash }, { status: 201 });
}
