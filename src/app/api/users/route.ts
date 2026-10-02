import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-auth';
import { recordAdminAudit } from '@/lib/auth/audit-log';
import { supabase } from '@/lib/supabase/service';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// GET: List all users
export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database missing' }, { status: 500 });
  }

  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) throw error;

    // Filter out potential non-admin users if necessary, or just return them all
    return NextResponse.json({ users: users.users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create a new user (Invite)
export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database missing' }, { status: 500 });
  }

  try {
    const { email, role } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    if (!['admin', 'manager', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Auto-generate a secure random password for the initial invite
    const tempPassword = crypto.randomBytes(12).toString('hex') + 'aA1!';

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: role
      }
    });

    if (error) throw error;

    // Step 3.4: record the mutation with the acting user.
    await recordAdminAudit({
      actorId: auth.user?.id,
      actorEmail: auth.user?.email,
      action: 'user.create',
      targetType: 'user',
      targetId: data.user?.id,
      metadata: { role, email },
    });

    return NextResponse.json({ 
      user: data.user, 
      tempPassword,
      message: 'User created successfully. Provide the temporary password securely to the user.'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
