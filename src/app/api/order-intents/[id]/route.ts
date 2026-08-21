// src/app/api/order-intents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const auth = await requireAdminSession(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, generatePaymentLink } = body;

    const { data: intent, error: fetchErr } = await supabase
      .from('order_intents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !intent) {
      return NextResponse.json({ error: 'Order intent not found' }, { status: 404 });
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
    }

    if (generatePaymentLink) {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret) {
        throw new Error('Paystack secret key is not configured');
      }

      const totalAmountKobo = Math.round(Number(intent.price_at_intent) * intent.quantity * 100);
      const storeUrl = process.env.NEXT_PUBLIC_STORE_URL || 'https://mcdaves.com.ng';

      const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: intent.customer_email || `customer-${intent.customer_id.toLowerCase()}@mcdaves.com.ng`,
          amount: totalAmountKobo,
          currency: 'NGN',
          callback_url: `${storeUrl}/checkout/success?intentId=${intent.id}`,
          metadata: {
            orderIntentId: intent.id,
            customerId: intent.customer_id,
            productName: intent.product_name,
            variantName: intent.variant_name,
            custom_fields: [
              { display_name: 'Customer Name', variable_name: 'customer_name', value: intent.customer_name },
              { display_name: 'Product', variable_name: 'product', value: `${intent.product_name} - ${intent.variant_name}` },
              { display_name: 'Quantity', variable_name: 'quantity', value: intent.quantity.toString() },
            ],
          },
        }),
      });

      const paystackData = await paystackRes.json();
      if (!paystackRes.ok || !paystackData.data?.authorization_url) {
        throw new Error(paystackData.message || 'Failed to initialize Paystack transaction');
      }

      updates.payment_link_url = paystackData.data.authorization_url;
      updates.status = 'PAYMENT_PENDING';
    }

    const { data: updated, error: updateErr } = await supabase
      .from('order_intents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, intent: updated }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update order intent';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
