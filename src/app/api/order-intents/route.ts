// src/app/api/order-intents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = requireAdminSession(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let query = supabase.from('order_intents').select('*').order('created_at', { ascending: false });

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,product_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const intents = (data || []).map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email || undefined,
      productId: row.product_id,
      productName: row.product_name,
      variantId: row.variant_id,
      variantName: row.variant_name,
      variantSku: row.variant_sku,
      quantity: row.quantity,
      priceAtIntent: Number(row.price_at_intent),
      currency: row.currency,
      lensRequestId: row.lens_request_id || undefined,
      vtoSessionRef: row.vto_session_ref || undefined,
      status: row.status,
      source: row.source,
      notes: row.notes || undefined,
      paymentLinkUrl: row.payment_link_url || undefined,
      whatsappReference: row.whatsapp_reference || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ intents }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch order intents';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
