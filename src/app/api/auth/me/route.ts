import { NextRequest, NextResponse } from 'next/server';
import { requireStaffOrHigher } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireStaffOrHigher(req);
  
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ 
    user: {
      email: auth.user.email,
      role: auth.role,
      id: auth.user.id
    }
  });
}
