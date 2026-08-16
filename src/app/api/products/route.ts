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
        media: [],
        hasPriceOverride: false,
        hasSpecOverride: false,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };

      const resolved: ResolvedProduct = {
        ...p,
        variants: matchingVariants,
        defaultVariant,
        media: [],
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
    const { data, error } = await supabase.from('products').insert(productRow).select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, product: mapRowToProduct(data) }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating catalog item';
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

    const { id, ...updates } = body.product;
    const { data, error } = await supabase
      .from('products')
      .update(mapProductToRow({ ...updates, id }))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

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
      return NextResponse.json({ error: 'Missing ID parameter' }, { status: 400 });
    }

    if (type === 'variant') {
      const { error } = await supabase.from('product_variants').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: `Variant ${id} deleted` });
    }

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: `Product ${id} deleted` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting item';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
