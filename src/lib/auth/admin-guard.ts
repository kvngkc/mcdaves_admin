// src/lib/auth/admin-guard.ts
/**
 * Self-demotion / last-admin guard (v4 plan step 2.7).
 *
 * Two invariants the console must never break:
 *   1. An admin cannot change their own role or delete themselves.
 *   2. The console must always keep at least one `admin`.
 */
import { resolveUserRole, type RoleCarrier } from './role-read';

export interface GuardResult {
  ok: boolean;
  error?: string;
}

export function assertNotSelfRoleChange(actorId: string, targetId: string): GuardResult {
  if (actorId && targetId && actorId === targetId) {
    return { ok: false, error: 'You cannot change your own role.' };
  }
  return { ok: true };
}

export function assertNotSelfDelete(actorId: string, targetId: string): GuardResult {
  if (actorId && targetId && actorId === targetId) {
    return { ok: false, error: 'You cannot delete your own account.' };
  }
  return { ok: true };
}

/** Count console users whose authoritative role is `admin`. */
export function countAdmins(users: Array<RoleCarrier | null | undefined>): number {
  return users.filter((u) => resolveUserRole(u) === 'admin').length;
}

export function assertAnotherAdminRemains(
  users: Array<(RoleCarrier & { id?: string }) | null | undefined>,
  targetId: string,
  target: RoleCarrier | null | undefined,
): GuardResult {
  if (resolveUserRole(target) !== 'admin') return { ok: true };
  const others = users.filter((u) => (u as { id?: string } | null | undefined)?.id !== targetId);
  if (countAdmins(others) === 0) {
    return { ok: false, error: 'At least one admin must remain.' };
  }
  return { ok: true };
}
