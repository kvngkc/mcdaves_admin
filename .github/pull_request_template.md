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

## Regression gate

<!-- PLATFORM-ENFORCED: branch protection on `main` requires the checks below.
     A red or MISSING required check blocks the merge button — the gate is no
     longer enforced by convention alone. See docs/MERGE_GATE.md. -->

- Required check(s) on `main`: `Required Regression Gate` (this repo);
  `Required Cross-Repo Gate` additionally in `mcdaves_website`
- [ ] The required check is green on the head commit
- [ ] Branch is up to date with `main` (`strict` is on)
- [ ] No test was skipped, weakened, or marked `continue-on-error` to pass
- [ ] No required check was removed from branch protection to pass

## Checklist

- [ ] Conventional commit message (`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`)
- [ ] No secrets, no generated artifacts committed
- [ ] Rollback statement above is complete
