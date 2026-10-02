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

- [ ] `Required Regression Gate` is green on the head commit (or
      `Required Cross-Repo Gate` for a cross-repo/contract PR)
- [ ] No test was skipped, weakened, or marked `continue-on-error` to pass

## Checklist

- [ ] Conventional commit message (`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`)
- [ ] No secrets, no generated artifacts committed
- [ ] Rollback statement above is complete
