import { describe, it, expect } from 'vitest';
import { assertNotSelfRoleChange, assertNotSelfDelete, assertAnotherAdminRemains, countAdmins } from '@/lib/auth/admin-guard';

// Step 2.7 — Guard against self-demotion and last-admin deletion.
// Verify: attempting to demote or delete the sole remaining admin returns an
// error and leaves the account intact.

const admin = (id: string) => ({ id, app_metadata: { role: 'admin' }, user_metadata: {} });
const staff = (id: string) => ({ id, app_metadata: { role: 'staff' }, user_metadata: {} });

describe('2.7 — self-demotion / last-admin guard', () => {
  it('rejects changing your own role', () => {
    expect(assertNotSelfRoleChange('u1', 'u1').ok).toBe(false);
    expect(assertNotSelfRoleChange('u1', 'u2').ok).toBe(true);
  });

  it('rejects deleting yourself', () => {
    expect(assertNotSelfDelete('u1', 'u1').ok).toBe(false);
    expect(assertNotSelfDelete('u1', 'u2').ok).toBe(true);
  });

  it('rejects demoting/deleting the sole remaining admin (account left intact)', () => {
    const users = [admin('u1')];
    expect(countAdmins(users)).toBe(1);
    expect(assertAnotherAdminRemains(users, 'u1', users[0]).ok).toBe(false);
    expect(users[0].app_metadata.role).toBe('admin');
  });

  it('allows demoting an admin when another admin remains', () => {
    const users = [admin('u1'), admin('u2')];
    expect(assertAnotherAdminRemains(users, 'u1', users[0]).ok).toBe(true);
  });

  it('allows removing a non-admin regardless of admin count', () => {
    const users = [admin('u1'), staff('u2')];
    expect(assertAnotherAdminRemains(users, 'u2', users[1]).ok).toBe(true);
  });
});
