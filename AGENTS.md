<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# McDaves Admin — AI Agent Instructions

## Merge gate — manual CI verification (TEMPORARY)

**No PR may merge into `main` unless the manual CI verification gate passes on
the PR's current HEAD commit.** Server-side branch protection is unavailable on
this plan (GitHub Free private repo → 403), so this gate is a **reviewer/CI
convention**, not a platform-enforced rule. `main` is **not** protected.

Before merging, run:

```bash
./scripts/verify-merge-gate.sh <pr-number>
```

The gate (1) resolves the PR's current HEAD SHA, (2) retrieves **all** GitHub
Actions workflow runs for that exact SHA, (3) confirms the actual CI/build/test
results and gates strictly on their outcome, (4) records the result in
`docs/gate-verification-log.md`, and (5) exits `0` to allow the merge or
non-zero to **halt**.

**HALT (do not merge) if:** no workflow run exists for the HEAD SHA · any run is
not `completed`/`success` · the required check `Required Regression Gate` is
missing or not `success` · new commits landed after the green run · the baseline
gate is red on `main`.

**Never weaken the gate to make it pass** (no skipped tests, no
`--passWithNoTests`, no `continue-on-error`). Full details: `docs/MERGE_GATE.md`.
