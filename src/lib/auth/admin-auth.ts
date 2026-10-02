// src/lib/auth/admin-auth.ts
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { resolveUserRole, type AdminRole } from '@/lib/auth/role-read';

export const ADMIN_COOKIE_NAME = 'mcdaves_sb_access_token';
export const ADMIN_CSRF_COOKIE = 'mcdaves_admin_csrf';

// Step 5.4: the CSRF token is bound to the session token via an HMAC, so a token
// minted for one session cannot be replayed against another. The secret is
// server-only (service-role key, or a dedicated secret in dev).
function csrfSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_CSRF_SECRET ||
    'mcdaves-dev-csrf-secret'
  );
}

function csrfSignature(sessionToken: string): string {
  return crypto.createHmac('sha256', csrfSecret()).update(sessionToken).digest('hex');
}

export function generateCsrfToken(sessionToken: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  return `${nonce}.${csrfSignature(`${nonce}.${sessionToken}`)}`;
}

export function verifyCsrfToken(req: NextRequest, sessionToken: string): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const cookie = req.cookies.get(ADMIN_CSRF_COOKIE)?.value;
  const header = req.headers.get('x-csrf-token');
  if (!cookie || !header || cookie.length !== header.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) return false;
  } catch {
    return false;
  }
  const [nonce, sig] = cookie.split('.');
  if (!nonce || !sig) return false;
  const expected = csrfSignature(`${nonce}.${sessionToken}`);
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export type { AdminRole };
export interface AuthResult {
  authorized: boolean;
  role?: AdminRole;
  error?: string;
  user?: any;
}

export async function requireRole(
  req: NextRequest,
  allowedRoles: AdminRole[],
): Promise<AuthResult> {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return { authorized: false, error: 'Unauthorized: No session token found.' };
  if (!verifyCsrfToken(req, token))
    return { authorized: false, error: 'CSRF token missing or invalid' };
  if (!supabase)
    return { authorized: false, error: 'Internal Server Error: Database client missing' };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user)
    return { authorized: false, error: 'Unauthorized: Invalid or expired session.' };
  // Step 2.1: dual-read (app_metadata first, user_metadata fallback during the window).
  const userRole = resolveUserRole(data.user);
  if (!userRole || !allowedRoles.includes(userRole))
    return { authorized: false, error: 'Forbidden: Insufficient permissions.' };
  return { authorized: true, role: userRole, user: data.user };
}

export async function requireAdminSession(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ['admin']);
}

export async function requireManagerOrHigher(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ['admin', 'manager']);
}

export async function requireStaffOrHigher(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ['admin', 'manager', 'staff']);
}
