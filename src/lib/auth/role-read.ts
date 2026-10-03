// src/lib/auth/role-read.ts
/**
 * Dual-read role helper (v4 plan step 2.1 — the EXPAND half of the RBAC change).
 *
 * During the migration window the authoritative role lives in `app_metadata.role`
 * after the backfill, but existing console users may still only have it in
 * `user_metadata.role`. This helper reads app_metadata first and falls back to
 * user_metadata so no existing admin is locked out mid-migration. Step 2.2 (the
 * CONTRACT half) turns the fallback off with READ_LEGACY_ROLE_FALLBACK=false.
 */
export type AdminRole = 'admin' | 'manager' | 'staff';

export interface RoleCarrier {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

export function isRoleFallbackEnabled(): boolean {
  return process.env.READ_LEGACY_ROLE_FALLBACK !== 'false';
}

/**
 * Resolve the authoritative role: app_metadata first, then (during the
 * dual-read window only) user_metadata. Returns null when neither holds a valid
 * role — the server then has no role, so the user is not authorised.
 */
export function resolveUserRole(user: RoleCarrier | null | undefined): AdminRole | null {
  if (!user) return null;
  const fromApp = user.app_metadata?.role;
  if (typeof fromApp === 'string' && fromApp) return fromApp as AdminRole;
  if (isRoleFallbackEnabled()) {
    const legacy = user.user_metadata?.role;
    if (typeof legacy === 'string' && legacy) return legacy as AdminRole;
  }
  return null;
}

export function hasRole(user: RoleCarrier | null | undefined, allowed: readonly AdminRole[]): boolean {
  const role = resolveUserRole(user);
  return role !== null && allowed.includes(role);
}
