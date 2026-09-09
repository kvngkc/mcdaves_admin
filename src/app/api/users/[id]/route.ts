import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-auth';
import { supabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database missing' }, { status: 500 });
  }

  try {
    const { role } = await req.json();

    if (!['admin', 'manager', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.admin.updateUserById(params.id, {
      user_metadata: { role }
    });

    if (error) throw error;

    return NextResponse.json({ user: data.user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database missing' }, { status: 500 });
  }

  try {
    // Actually delete the user from Supabase Auth
    const { error } = await supabase.auth.admin.deleteUser(params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
