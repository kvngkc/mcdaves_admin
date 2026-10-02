#!/usr/bin/env bash
#
# verify-merge-gate.sh — MANUAL CI verification gate for merges into `main`.
#
# WHY THIS EXISTS
#   Server-side branch protection / required status checks are NOT available on
#   GitHub Free private repositories: the API returns 403 ("Upgrade to GitHub
#   Pro or make public"). Until the account is upgraded (or the repos are made
#   public), this gate is a REVIEWER / CI CONVENTION, not a platform-enforced
#   rule. A reviewer MUST run it and MUST NOT merge unless it exits 0.
#
# WHAT IT DOES (the five gate steps)
#   1. Identify the PR's current HEAD commit SHA.
#   2. Retrieve ALL GitHub Actions workflow runs for that exact SHA.
#   3. Confirm the actual CI/build/test results for that HEAD and gate strictly
#      on their outcome (every run completed AND successful; the required
#      aggregator check present and green).
#   4. Record the verification result (append-only log).
#   5. Exit 0 = merge allowed; non-zero = HALT, do not merge.
#
# USAGE
#   ./scripts/verify-merge-gate.sh <pr-number>
#   ./scripts/verify-merge-gate.sh --sha <commit-sha>
#
# PREREQUISITES
#   - `gh` (GitHub CLI) authenticated with read access to this private repo, OR
#     `curl` + a GITHUB_TOKEN with `repo` scope.
#   - `jq`.
#
# ENV OVERRIDES
#   GATE_REPO            default: kvngkc/mcdaves_admin
#   GATE_REQUIRED_CHECK  default: "Required Regression Gate"
#   GATE_LOG_FILE        default: docs/gate-verification-log.md
#
set -euo pipefail

REPO="${GATE_REPO:-kvngkc/mcdaves_admin}"
REQUIRED_CHECK="${GATE_REQUIRED_CHECK:-Required Regression Gate}"
LOG_FILE="${GATE_LOG_FILE:-docs/gate-verification-log.md}"

die() { echo "GATE: HALT — $*" >&2; exit 1; }

command -v jq >/dev/null 2>&1 || die "jq is required but not installed"

api() {
  if command -v gh >/dev/null 2>&1; then
    gh api "$1"
  else
    : "${GITHUB_TOKEN:?GITHUB_TOKEN is required when gh is not installed}"
    curl -fsSL \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/$1"
  fi
}

# ---------------------------------------------------------------------------
# Step 1 — identify the PR's current HEAD commit SHA
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--sha" ]; then
  SHA="${2:?--sha requires a commit SHA}"
  PR="(direct SHA)"
else
  PR="${1:?usage: verify-merge-gate.sh <pr-number> | --sha <commit-sha>}"
  echo "==> Step 1/5: resolving current HEAD SHA for PR #${PR} in ${REPO}"
  SHA="$(api "repos/${REPO}/pulls/${PR}" | jq -r '.head.sha')"
fi
[ -n "${SHA}" ] && [ "${SHA}" != "null" ] || die "could not resolve HEAD SHA"
echo "    HEAD SHA = ${SHA}"

# ---------------------------------------------------------------------------
# Step 2 — retrieve ALL workflow runs for that exact SHA
# ---------------------------------------------------------------------------
echo "==> Step 2/5: retrieving ALL workflow runs for ${SHA}"
RUNS_JSON="$(api "repos/${REPO}/actions/runs?head_sha=${SHA}&per_page=100")"
TOTAL="$(jq -r '.total_count' <<<"${RUNS_JSON}")"
echo "    workflow runs found: ${TOTAL}"
[ "${TOTAL}" -gt 0 ] || die "no workflow runs exist for ${SHA} — absence is NOT a pass"

# ---------------------------------------------------------------------------
# Step 3 — confirm the actual CI/build/test results and gate strictly
# ---------------------------------------------------------------------------
echo "==> Step 3/5: evaluating CI/build/test results for ${SHA}"
FAILED=0
while IFS=$'\t' read -r name status conclusion; do
  printf '    %-42s %-11s %s\n' "${name}" "${status}" "${conclusion}"
  if [ "${status}" != "completed" ] || [ "${conclusion}" != "success" ]; then
    FAILED=1
  fi
done < <(jq -r '.workflow_runs[] | [.name, .status, (.conclusion // "null")] | @tsv' <<<"${RUNS_JSON}")

# The required aggregator check must be present AND green.
CHECKS_JSON="$(api "repos/${REPO}/commits/${SHA}/check-runs?per_page=100")"
REQ_CONCLUSION="$(jq -r --arg n "${REQUIRED_CHECK}" \
  '[.check_runs[] | select(.name == $n)] | (.[0].conclusion // "MISSING")' <<<"${CHECKS_JSON}")"
echo "    required check \"${REQUIRED_CHECK}\" = ${REQ_CONCLUSION}"
if [ "${REQ_CONCLUSION}" != "success" ]; then
  FAILED=1
fi

# ---------------------------------------------------------------------------
# Step 4 — record the verification result (append-only)
# ---------------------------------------------------------------------------
RESULT="PASS"
[ "${FAILED}" -eq 0 ] || RESULT="FAIL"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mkdir -p "$(dirname "${LOG_FILE}")"
{
  echo ""
  echo "| ${STAMP} | ${REPO} | ${PR} | \`${SHA}\` | ${RESULT} | ${TOTAL} run(s); required check = ${REQ_CONCLUSION} |"
} >> "${LOG_FILE}"
echo "==> Step 4/5: recorded result (${RESULT}) in ${LOG_FILE}"

# ---------------------------------------------------------------------------
# Step 5 — allow or halt
# ---------------------------------------------------------------------------
if [ "${FAILED}" -ne 0 ]; then
  echo "==> Step 5/5: GATE FAILED — DO NOT MERGE ${SHA}" >&2
  exit 1
fi
echo "==> Step 5/5: GATE PASSED — merge of ${SHA} is allowed"
exit 0
