// src/lib/auth/admin-auth.ts
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY || 'mcdaves-admin-secure-pass';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'mcdaves-optical-secure-server-signing-key-2026';
export const ADMIN_COOKIE_NAME = 'mcdaves_admin_session';

export function createAdminSessionToken(): string {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = `admin:${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}:${signature}`;
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    const [role, expiresAtStr, signature] = parts;
    if (role !== 'admin') return false;

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

    const expectedPayload = `${role}:${expiresAtStr}`;
    const expectedSignature = crypto
      .createHmac('sha256', ADMIN_SESSION_SECRET)
      .update(expectedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    return false;
  }
}

export function verifyAdminPasskey(attempt: string): boolean {
  if (!attempt || !ADMIN_PASSKEY) return false;
  try {
    const a = Buffer.from(attempt.trim());
    const b = Buffer.from(ADMIN_PASSKEY.trim());
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function requireAdminSession(request: NextRequest): { authorized: boolean; error?: string } {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME);
  if (!cookie || !verifyAdminSessionToken(cookie.value)) {
    return { authorized: false, error: 'Unauthorized: Administrator authentication required.' };
  }
  return { authorized: true };
}
