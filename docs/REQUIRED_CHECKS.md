# Required-Check Policy — Regression Gate (Phase 0.1)

> Status: **adopted by convention** (see *Limitation* below).
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

## 2. Required-check policy (enforced by convention)

Because branch protection / required status checks are **not available** on this
plan (see §3), the gate is enforced by the following team convention. It is
binding on every PR, including the Phase 1–7 remediation PRs.

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

### One-time setup for the cross-repo gate

`cross-repo-gate.yml` (in `mcdaves_website`) checks out the *other* private repo,
which the default `GITHUB_TOKEN` cannot read. A repo admin must create a
fine-grained PAT with read access to both private repos and store it as the
secret **`CROSS_REPO_TOKEN`** in `mcdaves_website`. Until that secret exists the
admin-suite job fails closed (the gate does not silently pass).

## 3. Limitation — branch protection unavailable

The access check found that **branch protection and required status checks are
unavailable on GitHub Free private repositories**. Both `mcdaves_website` and
`mcdaves_admin` are private repos on a Free plan, so:

- `GET /repos/{owner}/{repo}/branches/main/protection` returns **403** for both
  default branches.
- The gate therefore **cannot be marked Required in branch protection** at this
  time, and GitHub will not mechanically block a merge on a red check.

**Consequence:** the gate is enforced by the documented convention in §2 rather
than by the platform. This is a real, acknowledged gap — a determined actor can
still merge around a red check.

**Remediation path (when available):** upgrade the account to GitHub Pro/Team
(or make the repos public), then mark the check Required on both default
branches:

```
Settings → Branches → Add branch protection rule → branch: main
  ☑ Require status checks to pass before merging
      → add required check: "Required Regression Gate"
  ☑ Require branches to be up to date before merging
```

Repeat in both repositories. Once branch protection is available, §2 becomes
platform-enforced and this section is updated to record the change.

## 4. Verification

- A PR that deliberately breaks one test in either repo shows the gate **red**
  and is not merged (convention §2).
- The gate's aggregator job name is stable: `Required Regression Gate`
  (per-repo) and `Required Cross-Repo Gate` (cross-repo).
- This document records the branch-protection limitation and the exact
  remediation steps.
