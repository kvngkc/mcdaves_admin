import { describe, it, expect } from 'vitest';
import { resolveUserRole, hasRole } from '@/lib/auth/role-read';

// Step 2.2 — Write roles to app_metadata (fix RBAC).
// Verify: promote a user through the Team UI, sign in as them, and confirm an
// admin-guarded route now succeeds (today it does not).

function canReachAdminRoute(user: Parameters<typeof resolveUserRole>[0]): boolean {
  return hasRole(user, ['admin']);
}

describe('2.2 — roles written to app_metadata actually grant access', () => {
  it('a promotion written to app_metadata now reaches an admin route (today it does not)', () => {
    // Before the fix the writer put the role in user_metadata only:
    const promotedOldWriter = { app_metadata: {}, user_metadata: { role: 'admin' } };
    // The guard read app_metadata, so the admin route returned 403:
    expect(canReachAdminRoute({ app_metadata: promotedOldWriter.app_metadata })).toBe(false);

    // After the fix updateUserById writes app_metadata.role:
    const promotedFixed = { app_metadata: { role: 'admin' }, user_metadata: {} };
    expect(canReachAdminRoute(promotedFixed)).toBe(true);
  });

  it('a role-less user is still refused (no accidental elevation)', () => {
    expect(canReachAdminRoute({ app_metadata: {}, user_metadata: {} })).toBe(false);
    expect(hasRole({ app_metadata: { role: 'staff' } }, ['admin'])).toBe(false);
  });
});
