// src/lib/auth/audit-log.ts
/**
 * Shared admin audit trail (Step 3.4, v4 plan).
 *
 * Records every admin mutation with the acting user. Best-effort: a logging
 * failure never blocks the mutation.
 */

import { supabase } from '@/lib/supabase/service';

export async function recordAdminAudit(entry: {
  actorId?: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('admin_audit_log').insert({
    actor_id: entry.actorId ?? null,
    actor_email: entry.actorEmail ?? null,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
  });
  if (error) console.error('[admin-audit] failed to record entry:', error.message);
}
