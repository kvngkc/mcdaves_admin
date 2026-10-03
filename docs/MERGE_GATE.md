# Merge Gate — Platform-Enforced Branch Protection

> **Status: platform-enforced.** Branch protection is live on `main`.
> Applies to: `kvngkc/mcdaves_website` and `kvngkc/mcdaves_admin`, default branch `main`.
> Supersedes the convention-only policy in `docs/REQUIRED_CHECKS.md` §2.

## 1. What changed

Both repositories are now **public**, so GitHub branch protection and required
status checks are available on the Free plan (they were previously unavailable
on Free **private** repos). Branch protection is **enabled and API-verified** on
`main` in both repositories. The regression gate is no longer enforced by
convention alone: GitHub now **mechanically blocks** a merge into `main` when a
required check is red or missing.

## 2. Required status checks (exact names)

| Repository | Required check(s) on `main` |
| --- | --- |
| `mcdaves_website` | `Required Regression Gate` · `Required Cross-Repo Gate` |
| `mcdaves_admin` | `Required Regression Gate` |

These are the exact `name:` values of the aggregator jobs in
`.github/workflows/regression-gate.yml` (and `.github/workflows/cross-repo-gate.yml`
in `mcdaves_website`). Each aggregator runs `if: always()` and fails unless every
upstream job succeeded, so requiring **only the aggregator** keeps the required
set stable while still blocking on any red leg (`Type Check`, `Lint`, `Vitest`,
`Playwright E2E`, `Build`).

## 3. Protection settings applied to `main` (per repo)

| Setting | Value |
| --- | --- |
| Require status checks to pass before merging | on |
| Required checks | see §2 |
| Require branches to be up to date before merging (`strict`) | on |
| Require a pull request before merging | on (approvals required: 0) |
| Allow force pushes | **off** |
| Allow deletions | **off** |
| Enforce for administrators | **on** |
| Require linear history | off (merge commits allowed) |
| Required conversation resolution | off |
| Required signatures | off |

`strict` is on, so a merge is blocked until the head branch is up to date with
`main` **and** the required checks are green on the resulting tree. Enforcing for
administrators means the gate cannot be side-stepped with an admin merge.

## 4. Remaining baseline blocker — the gate is RED on `main`

**No PR can land until the baseline is fixed.** The required gate already fails
on the current `main` tip in both repositories:

| Repository | `main` tip | `Required Regression Gate` |
| --- | --- | --- |
| `mcdaves_website` | `2fa0b6d44e7c1d965def8e621928335e2338ce7d` | **failure** |
| `mcdaves_admin` | `8d48bd59fc7b579875333ee0f2a622b1d84bda4d` | **failure** |

Failing legs at the baseline:

- **website** — `Lint`, `Vitest (unit + integration)` and `Playwright E2E` red;
  `Type Check` green. Aggregator check run `110795779839`; `Required Cross-Repo
  Gate` check run `110794768826`.
- **admin** — `Lint` red; `Type Check`, `Build`, `Vitest` green.
  Aggregator check run `110795014163`.

Because `strict` is on and the required check is red on `main`, every pull
request into `main` is blocked by the platform until the baseline failures are
fixed **on `main`**. This is the intended fail-closed behaviour.

## 5. Verification

- `GET /repos/kvngkc/mcdaves_website/branches/main` → `"protected": true`,
  `enforcement_level: "everyone"`.
- `GET /repos/kvngkc/mcdaves_admin/branches/main` → `"protected": true`,
  `enforcement_level: "everyone"`.
- A direct push to `main` is rejected with *"Changes must be made through a pull
  request. Required status check `Required Regression Gate` is expected."* — the
  platform is enforcing.

## 6. Never weaken the gate

No test may be skipped, deleted, or marked `continue-on-error`; no required
check may be removed — to make a merge pass. Fix the failure on the branch (or
the baseline) instead.
