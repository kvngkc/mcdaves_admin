#!/usr/bin/env node
/**
 * Phase 2 / step 2.1 — one-off role backfill (EXPAND half of the RBAC change).
 *
 * Copies every role stranded in `user_metadata.role` into `app_metadata.role`
 * for all console users, then reports any mismatch. Idempotent: re-running only
 * fills users whose app_metadata.role is still missing.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-admin-roles.mjs
 *   DRY_RUN=1 NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-admin-roles.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const VALID_ROLES = new Set(['admin', 'manager', 'staff']);

if (!url || !key) {
  console.error('[migrate-admin-roles] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  let migrated = 0, already = 0, skipped = 0, mismatched = 0;
  for (const user of data.users) {
    const legacy = user.user_metadata?.role;
    const current = user.app_metadata?.role;

    if (current && legacy && current !== legacy) {
      mismatched += 1;
      console.warn(`[mismatch] ${user.id} app=${current} legacy=${legacy} (app_metadata kept as authoritative)`);
    }
    if (current) { already += 1; continue; }
    if (!legacy || !VALID_ROLES.has(legacy)) { skipped += 1; continue; }

    if (dryRun) { console.log(`[dry-run] would copy ${user.id} role=${legacy} -> app_metadata.role`); migrated += 1; continue; }

    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: { role: legacy } });
    if (updErr) { console.error(`[error] ${user.id}: ${updErr.message}`); skipped += 1; continue; }
    migrated += 1;
    console.log(`[ok] ${user.id} app_metadata.role=${legacy}`);
  }

  console.log(`[migrate-admin-roles] done — migrated=${migrated} already=${already} skipped=${skipped} mismatched=${mismatched} dryRun=${dryRun}`);
}

main().catch((err) => { console.error('[migrate-admin-roles] fatal:', err); process.exit(1); });
