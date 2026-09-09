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

export type AdminRole = 'admin' | 'manager' | 'staff';

export interface AuthResult {
  authorized: boolean;
  role?: AdminRole;
  error?: string;
  user?: any;
}

/**
 * Checks if the request contains a valid Supabase access token for an admin user
 * and verifies their role against the allowed roles.
 */
export async function requireRole(req: NextRequest, allowedRoles: AdminRole[]): Promise<AuthResult> {
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

  const userRole = data.user.user_metadata?.role as AdminRole;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return { authorized: false, error: 'Forbidden: Insufficient permissions.' };
  }

  return { authorized: true, role: userRole, user: data.user };
}

// Legacy helper, defaults to just 'admin' if called
export async function requireAdminSession(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ['admin']);
}

// Helpers for specific access levels
export async function requireManagerOrHigher(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ['admin', 'manager']);
}

export async function requireStaffOrHigher(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ['admin', 'manager', 'staff']);
}
