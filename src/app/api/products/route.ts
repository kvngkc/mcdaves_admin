import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  supabase,
  mapProductToRow,
  mapVariantToRow,
  mapRowToProduct,
  mapRowToVariant,
} from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';
import { ResolvedProductVariant } from '@/lib/commerce/types';

export const dynamic = 'force-dynamic';
const SpecificationsSchema = z.object({
  frameWidthMm: z.number().finite().positive().nullable().optional(),
  lensWidthMm: z.number().finite().positive().nullable().optional(),
  bridgeWidthMm: z.number().finite().positive().nullable().optional(),
  templeLengthMm: z.number().finite().positive().nullable().optional(),
  frameSize: z.string().trim().min(1).optional(),
});
const ProductMediaSchema = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  altText: z.string().optional(),
  mediaType: z.string().optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().optional(),
});
const ProductSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1),
  name: z.string().min(1),
  collection: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  faceShape: z.array(z.string()).optional(),
  defaultPrice: z.number().min(0),
  defaultOriginalPrice: z.number().min(0).optional(),
  defaultMaterial: z.string().optional(),
  defaultWeight: z.string().optional(),
  defaultSpecifications: SpecificationsSchema.optional(),
  prescriptionRequired: z.boolean().optional(),
  tryOnAvailable: z.boolean().optional(),
  status: z.string().optional(),
  media: z.array(ProductMediaSchema).optional(),
});

// A variant is intentionally creatable before a VTO asset exists. The Admin UI
// creates the variant first, then registers the uploaded GLB and attaches the
// returned authoritative asset ID automatically.
export const VariantSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  sku: z.string().min(1),
  colorName: z.string().min(1),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  priceOverride: z.number().min(0).optional(),
  originalPriceOverride: z.number().min(0).optional(),
  materialOverride: z.string().optional(),
  weightOverride: z.string().optional(),
  specificationsOverride: SpecificationsSchema.optional(),
  descriptionOverride: z.string().optional(),
  glbPath: z.string().optional(),
  vtoAssetId: z.string().optional(),
  vtoCalibrationId: z.string().optional(),
  inStock: z.boolean().optional(),
  stockLevel: z.string().optional(),
  unitsInStock: z.number().min(0).optional(),
  hideWhenOutOfStock: z.boolean().optional(),
  sortOrder: z.number().optional(),
  status: z.string().optional(),
});

function getErrorResponse(err: unknown, fallback: string) {
  if (err instanceof z.ZodError) return { error: 'Validation failed', details: err.issues };
  if (err && typeof err === 'object') {
    const candidate = err as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const message =
      typeof candidate.message === 'string' && candidate.message.trim()
        ? candidate.message
        : fallback;
    return {
      error: message,
      ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
      ...(typeof candidate.details === 'string' && candidate.details.trim()
        ? { details: candidate.details }
        : {}),
      ...(typeof candidate.hint === 'string' && candidate.hint.trim()
        ? { hint: candidate.hint }
        : {}),
    };
  }
  return { error: fallback };
}

function stripLegacyVariantColumns(row: Record<string, unknown>) {
  // product_variants does not contain the legacy vto_calibration_id column.
  // Keep the API/type compatibility for now, but never send the stale field to PostgREST.
  delete row.vto_calibration_id;
  return row;
}

async function resolveVtoAssetId(vtoAssetId?: string, glbPath?: string) {
  if (vtoAssetId) return vtoAssetId;
  if (!glbPath || !supabase) return undefined;
  const { data, error } = await supabase
    .from('vto_asset_calibrations')
    .select('asset_id, status')
    .eq('vto_glb_url', glbPath)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      'The supplied GLB is not registered as an authoritative VTO asset. Upload or generate it through the Admin VTO flow first.',
    );
  return data.asset_id;
}

async function assertVtoAssetIsUsable(vtoAssetId?: string) {
  if (!vtoAssetId) return;
  const { data, error } = await supabase!
    .from('vto_asset_calibrations')
    .select('asset_id, status')
    .eq('asset_id', vtoAssetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`VTO asset ${vtoAssetId} is not registered.`);
  if (!['REVIEW_REQUIRED', 'APPROVED', 'PUBLISHED'].includes(data.status))
    throw new Error(`VTO asset ${vtoAssetId} is not usable. Current status: ${data.status}`);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(req);
    if (!auth.authorized)
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    if (!supabase)
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    const { data: rawProducts, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (prodErr) throw prodErr;
    const { data: rawVariants, error: varErr } = await supabase
      .from('product_variants')
      .select('*')
      .order('sort_order', { ascending: true });
    if (varErr) throw varErr;
    const { data: rawMedia } = await supabase
      .from('product_media')
      .select('*')
      .order('sort_order', { ascending: true });
    const products = (rawProducts || []).map((row) => {
      const p = mapRowToProduct(row);
      const matchingVariants = (rawVariants || [])
        .filter((vRow) => vRow.product_id === p.id)
        .map((vRow) => {
          const v = mapRowToVariant(vRow);
          const resolvedV: ResolvedProductVariant = {
            ...v,
            effectivePrice: v.priceOverride ?? p.defaultPrice,
            effectiveOriginalPrice: v.originalPriceOverride ?? p.defaultOriginalPrice,
            effectiveMaterial: v.materialOverride ?? p.defaultMaterial,
            effectiveWeight: v.weightOverride ?? p.defaultWeight,
            effectiveSpecifications: {
              ...p.defaultSpecifications,
              ...(v.specificationsOverride || {}),
            },
            effectiveDescription: v.descriptionOverride ?? p.description,
            media: [],
            hasPriceOverride: v.priceOverride !== undefined,
            hasSpecOverride: v.specificationsOverride !== undefined,
          };
          return resolvedV;
        });
      const matchingMedia = (rawMedia || [])
        .filter((m) => m.product_id === p.id)
        .map((m) => ({
          id: m.id,
          productId: m.product_id,
          variantId: m.variant_id || undefined,
          url: m.url,
          altText: m.alt_text || '',
          mediaType:
            m.type === 'front'
              ? 'image_front'
              : m.type === 'side'
                ? 'image_side'
                : 'image_lifestyle',
          isPrimary: m.is_primary || false,
          sortOrder: m.sort_order || 0,
        }));
      const defaultVariant = matchingVariants[0] || {
        id: `default-${p.id}`,
        productId: p.id,
        slug: 'default',
        name: 'Default',
        sku: `${p.id}-DEF`,
        colorName: 'Standard',
        colorHex: '#000000',
        inStock: true,
        stockLevel: 'high' as const,
        unitsInStock: 10,
        sortOrder: 0,
        status: 'ACTIVE' as const,
        effectivePrice: p.defaultPrice,
        effectiveMaterial: p.defaultMaterial,
        effectiveWeight: p.defaultWeight,
        effectiveSpecifications: p.defaultSpecifications,
        effectiveDescription: p.description,
        media: matchingMedia as any,
        hasPriceOverride: false,
        hasSpecOverride: false,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
      return { ...p, variants: matchingVariants, defaultVariant, media: matchingMedia as any };
    });
    return NextResponse.json({ products }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(getErrorResponse(err, 'Failed to fetch catalog'), { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(req);
    if (!auth.authorized)
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    if (!supabase)
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    const body = await req.json();
    if (body.action === 'CREATE_VARIANT') {
      const parsedVariant = VariantSchema.parse(body.variant);
      const resolvedAssetId = await resolveVtoAssetId(
        parsedVariant.vtoAssetId,
        parsedVariant.glbPath,
      );
      await assertVtoAssetIsUsable(resolvedAssetId);
      const variantRow = stripLegacyVariantColumns(
        mapVariantToRow({ ...parsedVariant, vtoAssetId: resolvedAssetId } as any),
      );
      const { data, error } = await supabase
        .from('product_variants')
        .insert(variantRow)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, variant: mapRowToVariant(data) }, { status: 201 });
    }
    const parsedProduct = ProductSchema.parse(body.product);
    const productRow = mapProductToRow(parsedProduct as any);
    const { data: createdProduct, error } = await supabase
      .from('products')
      .insert(productRow)
      .select()
      .single();
    if (error) throw error;
    const initialVariant = {
      id: `var-${createdProduct.id}-standard-${Date.now().toString().slice(-4)}`,
      product_id: createdProduct.id,
      slug: 'standard',
      name: `${createdProduct.name} - Standard`,
      sku: `${createdProduct.slug.slice(0, 3).toUpperCase()}-STD-${Date.now().toString().slice(-3)}`,
      color_name: 'Classic Black',
      color_hex: '#1A1A1A',
      in_stock: true,
      stock_level: 'high',
      units_in_stock: 20,
      hide_when_out_of_stock: false,
      sort_order: 0,
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    };
    await supabase.from('product_variants').insert(initialVariant);
    if (Array.isArray(parsedProduct.media) && parsedProduct.media.length > 0)
      await supabase
        .from('product_media')
        .insert(
          parsedProduct.media.map((m: any, idx: number) => ({
            id: `med-${createdProduct.id}-${idx}-${Date.now().toString().slice(-3)}`,
            product_id: createdProduct.id,
            type: (m.mediaType || 'front').replace('image_', ''),
            url: m.url,
            alt_text: m.altText || createdProduct.name,
            is_primary: m.isPrimary ?? idx === 0,
            sort_order: m.sortOrder ?? idx,
          })),
        );
    return NextResponse.json(
      { success: true, product: mapRowToProduct(createdProduct) },
      { status: 201 },
    );
  } catch (err: unknown) {
    const response = getErrorResponse(err, 'Error creating catalog item');
    console.error('[POST /api/products] catalog operation failed', response);
    return NextResponse.json(response, { status: 400 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(req);
    if (!auth.authorized)
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    if (!supabase)
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    const body = await req.json();
    if (body.action === 'UPDATE_VARIANT') {
      const parsedVariant = VariantSchema.parse(body.variant);
      const resolvedAssetId = await resolveVtoAssetId(
        parsedVariant.vtoAssetId,
        parsedVariant.glbPath,
      );
      await assertVtoAssetIsUsable(resolvedAssetId);
      const { id, ...updates } = parsedVariant;
      const variantRow = stripLegacyVariantColumns(
        mapVariantToRow({ ...updates, vtoAssetId: resolvedAssetId } as any),
      );
      const { data, error } = await supabase
        .from('product_variants')
        .update(variantRow)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, variant: mapRowToVariant(data) }, { status: 200 });
    }
    const parsedProduct = ProductSchema.parse(body.product);
    const { id, media, ...updates } = parsedProduct;
    const { data, error } = await supabase
      .from('products')
      .update(mapProductToRow({ ...updates, id } as any))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (Array.isArray(media)) {
      await supabase.from('product_media').delete().eq('product_id', id);
      if (media.length > 0)
        await supabase
          .from('product_media')
          .insert(
            media.map((m: any, idx: number) => ({
              id: `med-${id}-${idx}-${Date.now().toString().slice(-3)}`,
              product_id: id,
              type: (m.mediaType || 'front').replace('image_', ''),
              url: m.url,
              alt_text: m.altText || data.name,
              is_primary: m.isPrimary ?? idx === 0,
              sort_order: m.sortOrder ?? idx,
            })),
          );
    }
    return NextResponse.json({ success: true, product: mapRowToProduct(data) }, { status: 200 });
  } catch (err: unknown) {
    const response = getErrorResponse(err, 'Error updating catalog item');
    return NextResponse.json(response, { status: 400 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(req);
    if (!auth.authorized)
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    if (!supabase)
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    if (type === 'variant') {
      const { error } = await supabase.from('product_variants').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Variant deleted' }, { status: 200 });
    }
    await supabase.from('product_media').delete().eq('product_id', id);
    await supabase.from('product_variants').delete().eq('product_id', id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Product deleted' }, { status: 200 });
  } catch (err: unknown) {
    const response = getErrorResponse(err, 'Error deleting catalog item');
    return NextResponse.json(response, { status: 400 });
  }
}
