<!--
McDaves PR template — Phase 0.2 requires every PR to state its rollback path.
Keep the sections; fill them in. A PR without a Rollback statement is not ready
for review.
-->

## What & why

<!-- One paragraph: the finding/step this closes and the change made. -->

- Plan step: <!-- e.g. 3.1 -->
- Repo(s): <!-- mcdaves_website / mcdaves_admin / both -->

## Change

<!-- The concrete edit. One step = one PR = one revertible commit. -->

## Verification

<!-- The observable proof this works. Paste the command and its result. -->

## Rollback

<!-- MANDATORY. Name ONE of: the feature flag to disable / the compensating
     migration to apply / the read-write switch to revert / "N/A — no contract
     or schema change". See docs/ROLLBACK_PROTOCOL.md. -->

- Rollback path:
- Contract/schema change? <!-- yes / no -->

## Manual CI verification gate (TEMPORARY required regression gate)

<!-- MANDATORY. Server-side branch protection is unavailable on this plan, so
     this gate is a reviewer/CI convention. See docs/MERGE_GATE.md. -->

- [ ] I ran `./scripts/verify-merge-gate.sh <this-PR-number>` against the
      **current HEAD commit** and it exited **0** (gate PASSED)
- [ ] The required check `Required Regression Gate` is **green on the exact HEAD
      commit** being merged (not an earlier commit)
- [ ] No test was skipped, weakened, or marked `continue-on-error` to pass
- [ ] The result was recorded in `docs/gate-verification-log.md`

> **HALT conditions:** no workflow run for the HEAD SHA · any run not
> `completed`/`success` · required check missing or not `success` · new commits
> after the green run · baseline red on `main`. If any apply, **do not merge**.

## Checklist

- [ ] Conventional commit message (`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`)
- [ ] No secrets, no generated artifacts committed
- [ ] Rollback statement above is complete
