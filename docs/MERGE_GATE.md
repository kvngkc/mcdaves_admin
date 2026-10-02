# Manual CI Verification Gate for Merges into `main`

> **Status: TEMPORARY required regression gate — enforced by reviewer/CI convention.**
> Applies to: `kvngkc/mcdaves_admin`, default branch `main`.
> This is **not** server-side branch protection. See [Why this is a convention](#why-this-is-a-convention-not-branch-protection).

## 1. Purpose

Before **any** PR merges into `main`, a reviewer must verify that the PR's
**current HEAD commit** passed the full CI/build/test suite. Because GitHub will
not mechanically block a merge on a red check for this repository (see §5), the
gate is a documented, mandatory reviewer step.

## 2. The gate — concrete steps

Run the gate script against the PR number (or a raw SHA):

```bash
./scripts/verify-merge-gate.sh <pr-number>
# or, to verify a specific commit:
./scripts/verify-merge-gate.sh --sha <commit-sha>
```

The script performs exactly these five steps:

| # | Step | What it does |
| --- | --- | --- |
| 1 | **Identify HEAD** | Resolves the PR's **current HEAD commit SHA** (`GET /repos/{owner}/{repo}/pulls/{n}` → `head.sha`). |
| 2 | **Retrieve runs** | Fetches **ALL** GitHub Actions workflow runs for that exact SHA (`GET /repos/{owner}/{repo}/actions/runs?head_sha={sha}`). |
| 3 | **Confirm results** | Reads the **actual CI/build/test results** for that HEAD and gates strictly on their outcome: every workflow run must be `completed` **and** `success`, and the required aggregator check **`Required Regression Gate`** must be present and green. |
| 4 | **Record** | Appends the result to `docs/gate-verification-log.md` (append-only). |
| 5 | **Allow / halt** | Exits `0` → merge allowed. Exits non-zero → **HALT, do not merge**. |

### Manual equivalent (no script)

```bash
SHA=$(gh api repos/kvngkc/mcdaves_admin/pulls/<PR> --jq .head.sha)
gh api "repos/kvngkc/mcdaves_admin/actions/runs?head_sha=$SHA" \
  --jq '.workflow_runs[] | "\(.name)\t\(.status)\t\(.conclusion)"'
gh api "repos/kvngkc/mcdaves_admin/commits/$SHA/check-runs" \
  --jq '.check_runs[] | select(.name=="Required Regression Gate") | .conclusion'
```

## 3. Stop conditions (HALT — do not merge)

The gate **halts** if **any** of the following is true:

1. **No workflow run exists** for the HEAD SHA. *Absence is not a pass.*
2. Any workflow run for the HEAD SHA is **not `completed`** (queued / in progress).
3. Any workflow run for the HEAD SHA has a conclusion other than **`success`**
   (`failure`, `cancelled`, `timed_out`, `action_required`, `skipped`, `neutral`).
4. The required aggregator check **`Required Regression Gate`** is **missing** or
   its conclusion is **not `success`**.
5. New commits landed on the PR **after** the green run (the SHA changed) — re-run
   the gate on the new HEAD.
6. The gate is red on `main`'s current tip (baseline red) — no PR can land on a
   green tree; fix the baseline first.

## 4. Rules

1. **No PR merges to `main` unless the gate is green on the exact HEAD commit.**
2. **A red gate is a hard stop.** Do not merge, do not "merge and fix forward",
   do not bypass with an admin merge. Fix the failure on the branch.
3. **Never weaken the gate to make it pass.** Deleting/skipping a test, adding
   `--passWithNoTests`, or marking a job `continue-on-error` is prohibited.
4. **The approving reviewer runs the gate** and records the result before approving.
5. **The gate is the merge gate for every phase.** Phases 1–7 inherit it.

## 5. Why this is a convention, not branch protection

Branch protection and required status checks are **unavailable on GitHub Free
private repositories**. Both `mcdaves_website` and `mcdaves_admin` are private
repos on a Free plan, so:

- `GET /repos/{owner}/{repo}/branches/main/protection` returns **403**
  ("Upgrade to GitHub Pro or make public").
- The gate **cannot be marked Required in branch protection**, and GitHub will
  **not** mechanically block a merge on a red check.

**Consequence:** the gate is enforced by the documented convention in §4 rather
than by the platform. This is a real, acknowledged gap — a determined actor can
still merge around a red check. `main` is **not** protected.

**Remediation path (when available):** upgrade to GitHub Pro/Team (or make the
repos public), then mark the check Required:

```
Settings → Branches → Add branch protection rule → branch: main
  ☑ Require status checks to pass before merging
      → add required check: "Required Regression Gate"
  ☑ Require branches to be up to date before merging
```

Once branch protection is available, §4 becomes platform-enforced and this
section is updated to record the change.

## 6. Current baseline status

The gate is currently **RED** on both `main` tips (recorded 2026-10-02):

| Repo | `main` tip SHA | Gate result |
| --- | --- | --- |
| `mcdaves_website` | `2fa0b6d44e7c1d965def8e621928335e2338ce7d` | **RED** — `Required Regression Gate` = failure |
| `mcdaves_admin` | `8d48bd59fc7b579875333ee0f2a622b1d84bda4d` | **RED** — `Required Regression Gate` = failure |

Because the baseline is red, **no PR can currently land on a green tree**. The
baseline must be fixed before the gate can pass for any PR.
