// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ success: true, message: 'Logged out' });
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
