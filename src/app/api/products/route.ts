// src/app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  supabase,
  mapProductToRow,
  mapVariantToRow,
  mapRowToProduct,
  mapRowToVariant,
} from '@/lib/supabase/service';
import { requireAdminSession } from '@/lib/auth/admin-auth';
import { ResolvedProduct, ResolvedProductVariant } from '@/lib/commerce/types';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

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
          mediaType: m.type === 'front' ? 'image_front' : m.type === 'side' ? 'image_side' : 'image_lifestyle',
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

      const resolved: ResolvedProduct = {
        ...p,
        variants: matchingVariants,
        defaultVariant,
        media: matchingMedia as any,
      };
      return resolved;
    });

    return NextResponse.json({ products }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch catalog';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = requireAdminSession(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'CREATE_VARIANT') {
      const variantRow = mapVariantToRow(body.variant);
      const { data, error } = await supabase.from('product_variants').insert(variantRow).select().single();
      if (error) throw error;
      return NextResponse.json({ success: true, variant: mapRowToVariant(data) }, { status: 201 });
    }

    const productRow = mapProductToRow(body.product);
    const { data: createdProduct, error } = await supabase.from('products').insert(productRow).select().single();
    if (error) {
      console.error('[Create Product] DB Insert Error:', error);
      throw error;
    }

    // Provision Initial Default Variant in product_variants so the product is immediately usable
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

    const { error: varInsertErr } = await supabase.from('product_variants').insert(initialVariant);
    if (varInsertErr) {
      console.warn('[Create Product] Variant Provision Warning:', varInsertErr);
    }

    // Handle media if provided
    if (Array.isArray(body.product.media) && body.product.media.length > 0) {
      const mediaRows = body.product.media.map((m: any, idx: number) => ({
        id: `med-${createdProduct.id}-${idx}-${Date.now().toString().slice(-3)}`,
        product_id: createdProduct.id,
        type: (m.mediaType || 'front').replace('image_', ''),
        url: m.url,
        alt_text: m.altText || createdProduct.name,
        is_primary: m.isPrimary ?? (idx === 0),
        sort_order: m.sortOrder ?? idx,
      }));

      await supabase.from('product_media').insert(mediaRows);
    }

    return NextResponse.json({ success: true, product: mapRowToProduct(createdProduct) }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating catalog item';
    console.error('[/api/products POST]', err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = requireAdminSession(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'UPDATE_VARIANT') {
      const { id, ...updates } = body.variant;
      const { data, error } = await supabase
        .from('product_variants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, variant: data }, { status: 200 });
    }

    const { id, media, ...updates } = body.product;
    const { data, error } = await supabase
      .from('products')
      .update(mapProductToRow({ ...updates, id }))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Update media records if passed
    if (Array.isArray(media)) {
      await supabase.from('product_media').delete().eq('product_id', id);
      if (media.length > 0) {
        const mediaRows = media.map((m: any, idx: number) => ({
          id: `med-${id}-${idx}-${Date.now().toString().slice(-3)}`,
          product_id: id,
          type: (m.mediaType || 'front').replace('image_', ''),
          url: m.url,
          alt_text: m.altText || data.name,
          is_primary: m.isPrimary ?? (idx === 0),
          sort_order: m.sortOrder ?? idx,
        }));
        await supabase.from('product_media').insert(mediaRows);
      }
    }

    return NextResponse.json({ success: true, product: mapRowToProduct(data) }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating catalog item';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = requireAdminSession(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (type === 'variant') {
      const { error } = await supabase.from('product_variants').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Variant deleted' }, { status: 200 });
    }

    // Cascade delete media and variants first
    await supabase.from('product_media').delete().eq('product_id', id);
    await supabase.from('product_variants').delete().eq('product_id', id);

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Product deleted' }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting catalog item';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
