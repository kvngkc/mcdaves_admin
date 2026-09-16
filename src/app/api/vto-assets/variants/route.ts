import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';

export async function GET(req: NextRequest) {
  const auth = await requireManagerOrHigher(req);
  if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'Supabase client not configured' }, { status: 500 });
  const { data, error } = await supabase.from('product_variants').select('id,name,sku,product_id,products:product_id(id,name,slug,frame_width_mm,lens_width_mm,bridge_width_mm,temple_length_mm)').eq('status','ACTIVE').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ variants: data || [] });
}
