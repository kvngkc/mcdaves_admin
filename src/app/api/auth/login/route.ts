// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminPasskey,
  createAdminSessionToken,
  ADMIN_COOKIE_NAME,
} from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { passkey } = body;

    if (!passkey || !verifyAdminPasskey(passkey)) {
      return NextResponse.json(
        { success: false, error: 'Incorrect administrator passkey. Access denied.' },
        { status: 401 },
      );
    }

    const token = createAdminSessionToken();
    const isProduction = process.env.NODE_ENV === 'production';

    const res = NextResponse.json({
      success: true,
      message: 'Administrator session authenticated',
    });

    res.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return res;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Authentication server error' },
      { status: 500 },
    );
  }
}
