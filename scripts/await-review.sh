#!/usr/bin/env bash
# Wait for Copilot to review a PR's head commit and for CI to finish, then
# print the checks, Copilot's review and every unresolved review thread.
#
# Usage: scripts/await-review.sh [<pr>] [--timeout-min N] [--ci-only]
#
#   <pr>             PR number; defaults to the current branch's PR
#   --timeout-min N  give up after N minutes (default 25)
#   --ci-only        wait for CI only, e.g. after a rebase onto main that
#                    needs no fresh review
#
# Exit status: 0 when the review and CI are both in, 2 on timeout, 1 on error.
# Run it in the background; it polls every 30 s (AWAIT_REVIEW_POLL_SEC).
#
# Copilot has reviewed the head only when one of its reviews carries the head
# commit's SHA: counting reviews races a push that lands mid-wait. When no
# Copilot review is pending, the script requests one (after a short grace
# period, in case a push already triggered it), so it never waits on nothing.

set -euo pipefail

LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib"
POLL_SEC="${AWAIT_REVIEW_POLL_SEC:-30}"
GRACE_SEC="${AWAIT_REVIEW_GRACE_SEC:-30}"

usage() { sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

pr=""
timeout_min=25
ci_only=""
while [ $# -gt 0 ]; do
  case "$1" in
    --timeout-min)
      [ $# -ge 2 ] || { usage >&2; exit 1; }
      timeout_min="$2"
      shift 2
      ;;
    --ci-only)
      ci_only=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      [ -z "$pr" ] || { usage >&2; exit 1; }
      pr="$1"
      shift
      ;;
  esac
done
case "$timeout_min" in '' | *[!0-9]*) echo "--timeout-min must be a whole number" >&2; exit 1 ;; esac
[ -n "$pr" ] || pr="$(gh pr view --json number -q .number)"
case "$pr" in '' | *[!0-9]*) echo "PR must be a number, got '$pr'" >&2; exit 1 ;; esac

repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
owner="${repo%%/*}"
name="${repo#*/}"
start="$(date +%s)"
deadline=$((start + timeout_min * 60))

log() { echo "[$(date +%H:%M:%S)] $*" >&2; }

head_sha() { gh pr view "$pr" --json headRefOid -q .headRefOid; }

# `--paginate --slurp` yields an array of pages; `add` flattens it.
copilot_review() {
  gh api --paginate --slurp "repos/$repo/pulls/$pr/reviews" |
    jq -r 'add // []' | jq -r --arg head "$1" -f "$LIB/copilot-review.jq"
}

copilot_pending() {
  gh api --paginate --slurp "repos/$repo/issues/$pr/timeline" |
    jq -r 'add // []' | jq -r -f "$LIB/copilot-pending.jq"
}

checks_json() {
  # gh exits non-zero while checks are pending or failing, and errors with no
  # output before any check is reported; both are states, not failures here.
  local out
  out="$(gh pr checks "$pr" --json name,bucket,link 2>/dev/null || true)"
  if [ -z "$out" ]; then echo '[]'; else echo "$out"; fi
}

threads() {
  # shellcheck disable=SC2016 # $owner etc. are GraphQL variables
  gh api graphql -F owner="$owner" -F name="$name" -F number="$pr" -f query='
    query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              isResolved isOutdated path line originalLine
              comments(first: 50) { nodes { databaseId author { login } body } }
            }
          }
        }
      }
    }' | jq -r -f "$LIB/review-threads.jq"
}

report() {
  echo "== PR #$pr ($repo) head ${head:0:7} =="
  echo
  echo "== Checks: $(checks_json | jq -r --arg mode state -f "$LIB/checks.jq") =="
  checks_json | jq -r --arg mode render -f "$LIB/checks.jq"
  echo
  echo "== Copilot =="
  if [ -n "${review:-}" ]; then echo "$review"; else echo "No Copilot review of ${head:0:7} yet."; fi
  echo
  echo "== Threads =="
  threads
}

timed_out() { [ "$(date +%s)" -ge "$deadline" ]; }

give_up() {
  log "Timed out after $timeout_min min waiting for $1."
  report
  exit 2
}

requested_for=""
while true; do
  # 1. Copilot's review of the current head.
  if [ -n "$ci_only" ]; then
    head="$(head_sha)"
    review="$(copilot_review "$head" || true)"
  fi
  while [ -z "$ci_only" ]; do
    # A failed gh call (network blip) is just a missed poll.
    if head="$(head_sha)" && review="$(copilot_review "$head")"; then
      [ -z "$review" ] || break
    else
      log "gh call failed; will retry."
      timed_out && give_up "Copilot's review"
      sleep "$POLL_SEC"
      continue
    fi
    if [ "$(copilot_pending)" = "pending" ]; then
      log "Copilot review pending for ${head:0:7}."
    elif [ "$requested_for" != "$head" ] && [ $(($(date +%s) - start)) -ge "$GRACE_SEC" ]; then
      log "No Copilot review pending for ${head:0:7}; requesting one."
      if gh pr edit "$pr" --add-reviewer @copilot >/dev/null; then
        requested_for="$head"
      else
        log "Requesting Copilot failed; will retry."
      fi
    fi
    timed_out && give_up "Copilot's review of ${head:0:7}"
    sleep "$POLL_SEC"
  done
  [ -n "$ci_only" ] || log "Copilot reviewed ${head:0:7}."

  # 2. CI on that same head.
  while true; do
    state="$(checks_json | jq -r --arg mode state -f "$LIB/checks.jq")"
    case "$state" in pass | fail) break ;; esac
    timed_out && give_up "CI ($state)"
    sleep "$POLL_SEC"
  done
  log "CI finished: $state."

  # 3. A push during the wait makes both answers stale: go round again.
  [ "$(head_sha || echo "$head")" = "$head" ] && break
  log "Head moved during the wait; waiting on the new head."
done

report
