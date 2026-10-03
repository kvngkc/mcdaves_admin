import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-auth';
import { supabase } from '@/lib/supabase/service';
import { assertNotSelfRoleChange, assertNotSelfDelete, assertAnotherAdminRemains } from '@/lib/auth/admin-guard';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
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

    // Step 2.7: never let an admin demote themselves or strand the console with
    // zero admins.
    const selfCheck = assertNotSelfRoleChange(auth.user?.id, resolvedParams.id);
    if (!selfCheck.ok) {
      return NextResponse.json({ error: selfCheck.error }, { status: 400 });
    }

    if (role !== 'admin') {
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) throw listErr;
      const target = (list?.users || []).find((u) => u.id === resolvedParams.id);
      const lastAdmin = assertAnotherAdminRemains(list?.users || [], resolvedParams.id, target);
      if (!lastAdmin.ok) {
        return NextResponse.json({ error: lastAdmin.error }, { status: 400 });
      }
    }

    const { data, error } = await supabase.auth.admin.updateUserById(resolvedParams.id, {
      // Step 2.2: write the authoritative role to app_metadata.role.
      app_metadata: { role },
    });

    if (error) throw error;

    return NextResponse.json({ user: data.user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const auth = await requireAdminSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database missing' }, { status: 500 });
  }

  try {
    // Step 2.7: never let an admin delete themselves or remove the last admin.
    const selfCheck = assertNotSelfDelete(auth.user?.id, resolvedParams.id);
    if (!selfCheck.ok) {
      return NextResponse.json({ error: selfCheck.error }, { status: 400 });
    }

    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const target = (list?.users || []).find((u) => u.id === resolvedParams.id);
    const lastAdmin = assertAnotherAdminRemains(list?.users || [], resolvedParams.id, target);
    if (!lastAdmin.ok) {
      return NextResponse.json({ error: lastAdmin.error }, { status: 400 });
    }

    // Actually delete the user from Supabase Auth
    const { error } = await supabase.auth.admin.deleteUser(resolvedParams.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
