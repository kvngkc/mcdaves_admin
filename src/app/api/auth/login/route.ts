// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/service';
import { ADMIN_COOKIE_NAME, ADMIN_CSRF_COOKIE, generateCsrfToken } from '@/lib/auth/admin-auth';
import { verifyTurnstileToken } from '@/lib/security/turnstile';
import { resolveLoginAnonKey } from '@/lib/supabase/resolve-key';
import {
  checkLoginLockout,
  recordLoginFailure,
  clearLoginFailures,
} from '@/lib/security/login-lockout';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { email, password, turnstileToken } = body;
    if (!email || !password) return NextResponse.json({ success: false, error: 'Email and password required.' }, { status: 400 });
    if (!await verifyTurnstileToken(turnstileToken)) return NextResponse.json({ success: false, error: 'Security check failed. Please refresh.' }, { status: 400 });
    if (!supabase || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ success: false, error: 'Database client missing.' }, { status: 500 });

    // Step 5.6: per-account lockout, independent of the global IP limiter.
    const lockout = await checkLoginLockout(email);
    if (lockout.locked) {
      return NextResponse.json(
        { success: false, error: `Too many failed attempts. Try again in ${lockout.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(lockout.retryAfterSeconds) } },
      );
    }

    // Step 2.3: the login client uses the ANON key only. It must never fall back
    // to the service-role key — that would authenticate the public login
    // endpoint with full admin privileges.
    let anonKey: string;
    try {
      anonKey = resolveLoginAnonKey();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Authentication is not configured (missing anon key).' },
        { status: 500 },
      );
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      // Step 5.6: count the failure against this email; lock + alert at the threshold.
      const failure = await recordLoginFailure(email);
      return NextResponse.json(
        {
          success: false,
          error: failure.locked
            ? 'Too many failed attempts. Account temporarily locked.'
            : 'Incorrect credentials. Access denied.',
        },
        { status: failure.locked ? 429 : 401 },
      );
    }
    if (data.user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin role required.' }, { status: 403 });
    }
    // Step 5.6: a successful login clears the failure counter for this email.
    await clearLoginFailures(email);
    const isProduction = process.env.NODE_ENV === 'production';
    const csrfToken = generateCsrfToken();
    const res = NextResponse.json({ success: true, message: 'Administrator session authenticated', csrfToken });
    res.cookies.set({ name: ADMIN_COOKIE_NAME, value: data.session.access_token, httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/', maxAge: data.session.expires_in });
    res.cookies.set({ name: ADMIN_CSRF_COOKIE, value: csrfToken, httpOnly: false, secure: isProduction, sameSite: 'lax', path: '/', maxAge: data.session.expires_in });
    return res;
  } catch {
    return NextResponse.json({ success: false, error: 'Authentication server error' }, { status: 500 });
  }
}
