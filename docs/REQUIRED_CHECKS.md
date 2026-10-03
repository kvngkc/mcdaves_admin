# Required-Check Policy — Regression Gate (Phase 0.1)

> Status: **platform-enforced** (see *Enforcement* below).
> Applies to: `kvngkc/mcdaves_website` and `kvngkc/mcdaves_admin`, default branch `main`.

## 1. The gate

One consolidated regression/CI gate runs the **full suite across both repositories**:

| Repository | Checks run by the gate |
| --- | --- |
| `mcdaves_website` | `type-check` · `lint` · Vitest (unit + integration) · Playwright E2E |
| `mcdaves_admin` | `type-check` · `lint` · `build` · Vitest |

Two workflow files implement it:

- `.github/workflows/regression-gate.yml` — per-repo gate. Exposes the stable
  status check **`Required Regression Gate`** (the aggregator job).
- `.github/workflows/cross-repo-gate.yml` (in `mcdaves_website`) — the
  consolidated cross-repo gate. Exposes the stable status check
  **`Required Cross-Repo Gate`**, which runs *both* suites in one workflow.

The aggregator job exists so the required check has **one stable name** that does
not change when individual jobs are added, renamed or split.

## 2. Required-check policy

1. **No PR merges to `main` in either repo unless `Required Regression Gate` is
   green** on the PR head commit. For cross-repo / contract PRs, the
   `Required Cross-Repo Gate` must be green instead.
2. **A red gate is a hard stop.** Do not merge, do not "merge and fix forward",
   do not bypass with an admin merge. Fix the failure on the branch.
3. **The gate must be green on the exact commit being merged.** If new commits
   land after the green run, re-run the gate.
4. **Never weaken the gate to make it pass.** Deleting/skipping a test, adding
   `--passWithNoTests`, or marking a job `continue-on-error` to get a green
   check is prohibited; it is treated as a policy violation, not a fix.
5. **The gate is the merge gate for every phase.** Phase 0.1 is the first thing
   to land; Phases 1–7 inherit it.
6. **Reviewers verify the check.** The approving reviewer confirms the gate is
   green on the head commit before approving.

This policy is now **enforced by the platform**, not by convention alone — see §3.

## 3. Enforcement — branch protection is now LIVE

Both repositories were made **public**, so branch protection and required status
checks are available on the Free plan. As recorded in `docs/MERGE_GATE.md`,
branch protection is **enabled and API-verified** on `main` in both repositories:

- `mcdaves_website` — required checks: `Required Regression Gate` **and**
  `Required Cross-Repo Gate`; `strict` on; force-push blocked; deletion blocked;
  enforced for administrators; pull request required.
- `mcdaves_admin` — required check: `Required Regression Gate`; `strict` on;
  force-push blocked; deletion blocked; enforced for administrators; pull
  request required.

`GET /repos/kvngkc/mcdaves_{website,admin}/branches/main` now returns
`"protected": true` with `enforcement_level: "everyone"` (it previously returned
**403**). §2 is therefore **platform-enforced**.

**Remaining baseline blocker (fail-closed):** the required gate is **RED** on
both current `main` tips — website `2fa0b6d4…` and admin `8d48bd59…`. With
`strict` on, **no PR can land until the baseline failures are fixed on `main`**.
See `docs/MERGE_GATE.md` §4 for the failing legs.

## 4. Verification

- A PR that deliberately breaks one test in either repo shows the gate **red**
  and is mechanically blocked from merging into `main` (branch protection).
- The gate's aggregator job name is stable: `Required Regression Gate`
  (per-repo) and `Required Cross-Repo Gate` (cross-repo).
- `GET /repos/kvngkc/mcdaves_website/branches/main` and
  `GET /repos/kvngkc/mcdaves_admin/branches/main` both report
  `"protected": true`.
