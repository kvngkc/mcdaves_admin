// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireStaffOrHigher } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * Resolves the prescription fields the console renders.
 *
 * Step 3.1: reads `orders.metadata` (written by the storefront checkout) and
 * falls back to the legacy `prescription_option` / `prescription_file_url`
 * columns during the dual-read window, so backfilled rows still populate.
 */
function extractPrescriptionMetadata(row: Record<string, unknown>): {
  prescriptionOption?: string;
  prescriptionFileUrl?: string;
} {
  const meta = (row.metadata as Record<string, unknown> | null) || {};
  const prescriptionOption =
    (meta.prescriptionOption as string | undefined) ??
    (row.prescription_option as string | undefined);
  const prescriptionFileUrl =
    (meta.prescriptionFileUrl as string | undefined) ??
    (row.prescription_file_url as string | undefined);
  return { prescriptionOption, prescriptionFileUrl };
}

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
      // Prescription metadata — resolved from orders.metadata with a legacy fallback.
      // prescriptionOption: 'upload' | 'plano' | 'whatsapp' | 'n/a'
      // prescriptionFileUrl: private Supabase Storage reference (set only when option === 'upload')
      ...extractPrescriptionMetadata(row as Record<string, unknown>),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ orders }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch orders';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
