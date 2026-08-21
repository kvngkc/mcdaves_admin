// src/lib/auth/admin-auth.ts
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';

export const ADMIN_COOKIE_NAME = 'mcdaves_sb_access_token';
export const ADMIN_CSRF_COOKIE = 'mcdaves_admin_csrf';

/**
 * Generates a random CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verifies that the CSRF token in the request header matches the cookie
 */
export function verifyCsrfToken(req: NextRequest): boolean {
  // Allow safe methods
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }

  const csrfCookie = req.cookies.get(ADMIN_CSRF_COOKIE)?.value;
  const csrfHeader = req.headers.get('x-csrf-token');

  if (!csrfCookie || !csrfHeader) return false;
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(csrfCookie),
      Buffer.from(csrfHeader)
    );
  } catch {
    return false;
  }
}

/**
 * Checks if the request contains a valid Supabase access token for an admin user
 */
export async function requireAdminSession(req: NextRequest): Promise<{ authorized: boolean; error?: string }> {
  // 1. Verify CSRF for mutating requests
  if (!verifyCsrfToken(req)) {
    return { authorized: false, error: 'CSRF token missing or invalid' };
  }

  // 2. Verify Session
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return { authorized: false, error: 'Unauthorized: No session token found.' };
  }

  if (!supabase) {
    return { authorized: false, error: 'Internal Server Error: Database client missing' };
  }

  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data.user) {
    return { authorized: false, error: 'Unauthorized: Invalid or expired session.' };
  }

  // Ensure they are an admin
  if (data.user.user_metadata?.role !== 'admin') {
    return { authorized: false, error: 'Forbidden: Admin role required.' };
  }

  return { authorized: true };
}
