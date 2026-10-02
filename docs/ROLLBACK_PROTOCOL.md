# Expand/Contract Rollback Protocol (Phase 0.2)

> Adopted before Phase 1 so every contract-breaking step inherits it.
> Applies to: `kvngkc/mcdaves_website` and `kvngkc/mcdaves_admin`.
> Contract steps that must follow it: **1.4, 2.1, 3.1, 3.3** (and any future
> change to a shared contract).

## 1. Why

A `git revert` of a merged contract change is unsafe: the database has already
moved, other clients may already depend on the new shape, and reverting the code
leaves the schema and the code disagreeing. Contract changes therefore ship as a
sequence of **separate, individually revertible commits** in a fixed order, and
are undone by a **compensating migration**, never by reverting a merge.

## 2. The four phases (fixed order)

Every contract-breaking change ships in this order, as **separate commits**:

1. **Add new + dual-write** — add the new column/field/enum value and write to
   *both* the old and the new shape. Nothing reads the new shape yet. Old
   readers keep working.
2. **Backfill** — a forward-only migration populates the new shape for all
   existing rows. Idempotent and re-runnable.
3. **Switch reads** — readers move to the new shape. Keep the old shape written
   (still dual-write) so a rollback of this step is a one-line read revert.
4. **Remove old** — only after the new shape is proven in production, stop
   writing the old shape and (optionally, in a later migration) drop it. This is
   the only irreversible step, and it is deliberately last.

Each phase is its own commit and its own PR where practical. Never bundle two
phases into one diff.

## 3. Database migrations

- **Forward-only.** Migrations are never edited after they are merged and never
  rolled back by deleting them.
- **One new file per change.** Every schema change is a new migration file; do
  not modify an existing migration.
- **Rollback = a compensating migration.** To undo a migration, add a *new*
  migration that reverses its effect (drop the added column, restore the old
  constraint, remap the values back). Never `git revert` a migration.
- **Concurrent-safe on live tables.** Build indexes `CONCURRENTLY`, attach
  constraints `NOT VALID` then `VALIDATE`, so no long lock is taken.
- **Backfill before constraint.** Dedupe/backfill first, then add the
  constraint (see step 1.3).

## 4. Feature flags for risky steps

Any contract step whose blast radius is not fully understood ships **behind a
feature flag**:

- The new behaviour is off by default; the flag is enabled per environment.
- **Rollback = disable the flag** — no deploy, no migration, no revert.
- The flag is removed only after the step is proven and the old path is retired.

## 5. Per-PR rollback statement (mandatory)

**Every PR description must state its rollback path.** The PR template
(`.github/pull_request_template.md`) carries a mandatory *Rollback* section. A
PR without a rollback statement is not ready for review.

The statement names one of:

- the **feature flag** to disable, or
- the **compensating migration** to apply, or
- the **read/write switch** to revert (for a dual-write step), or
- `N/A — no contract or schema change` for a purely additive, inert change.

## 6. Worked examples (the four contract steps)

| Step | Expand | Contract | Rollback |
| --- | --- | --- | --- |
| **1.4** checkout request shape | accept `items`, recompute server-side | reject bare `amount` | re-enable the `amount` fallback behind a flag for one release; update all checkout call sites in the same release |
| **2.1** roles → `app_metadata` | copy roles, dual-read | — (expand only) | revert the helper to read `user_metadata` only; no data destroyed |
| **3.1** `orders.metadata` | add column + storefront dual-write | admin reads it | switch the admin read back to empty; the added column is inert — no compensating migration needed |
| **3.3** canonical status enum | add canonical values, dual-accept old + new | remove retired values | keep dual-acceptance on; the remap needs no undo because both values stay valid until the final contract step |

## 7. Verification

- Rehearsing each contract step's rollback on a staging branch restores the
  prior contract **without reverting a merge**.
- All four contract steps carry a **Rollback** line naming the flag or the
  compensating migration.
- The PR template enforces the per-PR rollback statement.
