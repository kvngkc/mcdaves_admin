// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireStaffOrHigher } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireStaffOrHigher(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

    if (search) {
      query = query.or(`id.ilike.%${search}%,payment_reference.ilike.%${search}%,customer_id.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const orders = (data || []).map((row) => ({
      id: row.id,
      orderIntentId: row.order_intent_id || undefined,
      customerId: row.customer_id,
      paymentId: row.payment_id || undefined,
      paymentReference: row.payment_reference,
      items: Array.isArray(row.items) ? row.items : [],
      subtotal: Number(row.subtotal),
      shippingFee: Number(row.shipping_fee || 0),
      totalAmount: Number(row.total_amount),
      currency: row.currency,
      status: row.status,
      shippingAddress: row.shipping_address,
      customerNotes: row.customer_notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ orders }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch orders';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
