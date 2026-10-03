'use client';

import React, { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, UserPlus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

interface TeamMember {
  id: string;
  email: string;
  app_metadata: { role?: string };
  last_sign_in_at?: string;
  created_at: string;
}

export default function TeamPage() {
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch('/api/users');
      if (response.status === 403) {
        // True permission error — only admins can access this page
        setError('permission_denied');
        return;
      }
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error || `Server error (${response.status})`);
        return;
      }
      const res = await response.json();
      setUsers(res.users || []);
    } catch (err: any) {
      // TypeError: Failed to fetch = network outage, not an auth problem
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('network_error');
      } else {
        setError(err.message || 'Unexpected error loading team.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setTempPassword(null);
    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const res = await response.json();
      setTempPassword(res.tempPassword);
      setInviteEmail('');
      fetchUsers();
    } catch (err: any) {
      alert(`Error inviting user: ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    try {
      await apiFetch(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      fetchUsers();
    } catch (err: any) {
      alert(`Error updating role: ${err.message}`);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`DANGER: Are you sure you want to permanently delete the account for ${email}?`)) return;
    try {
      await apiFetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      fetchUsers();
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-neutral-400">Loading team...</div>;
  }

  if (error) {
    const isNetworkError = error === 'network_error';
    const isPermissionError = error === 'permission_denied';
    return (
      <div className="p-8 text-center">
        <ShieldAlert className={`w-12 h-12 mx-auto mb-4 ${isPermissionError ? 'text-red-500' : 'text-amber-500'}`} />
        <h2 className="text-xl font-bold text-white mb-2">
          {isPermissionError ? 'Access Denied' : isNetworkError ? 'Connection Error' : 'Error Loading Team'}
        </h2>
        <p className="text-neutral-400 mb-5">
          {isPermissionError
            ? 'Only admins can view and manage team members.'
            : isNetworkError
            ? 'Could not connect to the server. Check your network and try again.'
            : error}
        </p>
        {!isPermissionError && (
          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-h3 font-bold text-white">Team Management</h1>
          <p className="text-neutral-400 mt-1">Manage admin console access and roles.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-950/50 text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {users.map((u) => {
                  const role = u.app_metadata?.role || 'user';
                  return (
                    <tr key={u.id} className="hover:bg-neutral-800/20">
                      <td className="px-4 py-3 font-medium text-white">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          className="bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded px-2 py-1 focus:ring-brand-500 focus:border-brand-500"
                          value={role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="staff">Staff</option>
                          <option value="user">User (No Access)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(u.id, u.email)}
                          className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                          title="Revoke Access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                      No team members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 sticky top-6">
            <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
              <UserPlus className="w-5 h-5 text-brand-400" />
              <h2 className="text-lg font-bold text-white">Invite Member</h2>
            </div>
            
            {tempPassword && (
              <div className="mb-6 p-4 bg-brand-500/10 border border-brand-500/30 rounded-lg">
                <p className="text-xs text-brand-200 mb-2 font-medium">User Created! Share this temporary password securely. They must use it to log in.</p>
                <div className="bg-neutral-950 px-3 py-2 rounded font-mono text-brand-400 text-sm select-all">
                  {tempPassword}
                </div>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label htmlFor="inviteEmail" className="block text-xs font-medium text-neutral-400 mb-1">Email Address</label>
                <input
                  id="inviteEmail"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  placeholder="colleague@mcdaves.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Role Assignment</label>
                <div className="space-y-2">
                  <label htmlFor="roleAdmin" className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${inviteRole === 'admin' ? 'bg-brand-500/10 border-brand-500/50' : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'}`}>
                    <input id="roleAdmin" type="radio" name="role" value="admin" checked={inviteRole === 'admin'} onChange={() => setInviteRole('admin')} className="mt-0.5 text-brand-500 focus:ring-brand-500" />
                    <div>
                      <p className={`text-sm font-medium ${inviteRole === 'admin' ? 'text-brand-400' : 'text-neutral-300'}`}>Admin</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Full access to Users, Orders, Products, and Config.</p>
                    </div>
                  </label>

                  <label htmlFor="roleManager" className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${inviteRole === 'manager' ? 'bg-brand-500/10 border-brand-500/50' : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'}`}>
                    <input id="roleManager" type="radio" name="role" value="manager" checked={inviteRole === 'manager'} onChange={() => setInviteRole('manager')} className="mt-0.5 text-brand-500 focus:ring-brand-500" />
                    <div>
                      <p className={`text-sm font-medium ${inviteRole === 'manager' ? 'text-brand-400' : 'text-neutral-300'}`}>Manager</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Manage Products, VTO Assets, and Orders.</p>
                    </div>
                  </label>

                  <label htmlFor="roleStaff" className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${inviteRole === 'staff' ? 'bg-brand-500/10 border-brand-500/50' : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'}`}>
                    <input id="roleStaff" type="radio" name="role" value="staff" checked={inviteRole === 'staff'} onChange={() => setInviteRole('staff')} className="mt-0.5 text-brand-500 focus:ring-brand-500" />
                    <div>
                      <p className={`text-sm font-medium ${inviteRole === 'staff' ? 'text-brand-400' : 'text-neutral-300'}`}>Staff</p>
                      <p className="text-xs text-neutral-500 mt-0.5">View and fulfill Orders only. No product access.</p>
                    </div>
                  </label>
                </div>
              </div>

              <button type="submit" disabled={inviteLoading} className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center">
                {inviteLoading ? 'Creating...' : 'Create Team Member'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
