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
# A request we made that the timeline still shows idle after this long was
# removed or dropped: request again.
REARM_SEC="${AWAIT_REVIEW_REARM_SEC:-120}"

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
deadline=$((start + ${AWAIT_REVIEW_TIMEOUT_SEC:-$((timeout_min * 60))}))

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
  # --paginate follows pageInfo via $endCursor; --slurp hands jq every page.
  # shellcheck disable=SC2016 # $owner etc. are GraphQL variables
  gh api graphql --paginate --slurp -F owner="$owner" -F name="$name" -F number="$pr" -f query='
    query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $endCursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              isResolved isOutdated path line originalLine
              first: comments(first: 1) { nodes { databaseId author { login } body } }
              latest: comments(last: 1) { nodes { author { login } } }
            }
          }
        }
      }
    }' | jq -r -f "$LIB/review-threads.jq"
}

report() {
  # The full SHA: land-pr merges with --match-head-commit <it>.
  echo "== PR #$pr ($repo) head $head =="
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
  # Best effort: the outage behind a timeout can fail the report's own gh
  # calls, and that must not turn exit 2 into exit 1.
  report || log "Report incomplete: a gh call failed."
  exit 2
}

# Set $now_head, retrying failed lookups until the deadline. It sets a
# variable rather than printing so give_up's report isn't captured by $(...).
current_head() {
  until now_head="$(head_sha)"; do
    log "gh call failed; will retry."
    timed_out && give_up "the head commit"
    sleep "$POLL_SEC"
  done
}

head=""
requested_for=""
requested_at=0
while true; do
  # 1. Copilot's review of the current head.
  if [ -n "$ci_only" ]; then
    current_head
    head="$now_head"
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
    # An unknown request state is never a reason to request: wait a poll.
    if ! pending="$(copilot_pending)"; then
      log "gh call failed; will retry."
    elif [ "$pending" = "pending" ]; then
      log "Copilot review pending for ${head:0:7}."
    elif [ $(($(date +%s) - start)) -ge "$GRACE_SEC" ] &&
      { [ "$requested_for" != "$head" ] || [ $(($(date +%s) - requested_at)) -ge "$REARM_SEC" ]; }; then
      log "No Copilot review pending for ${head:0:7}; requesting one."
      if gh pr edit "$pr" --add-reviewer @copilot >/dev/null; then
        requested_for="$head"
        requested_at="$(date +%s)"
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

  # 3. A push during the wait makes both answers stale: go round again. A
  # failed lookup proves nothing about the head, so it is retried.
  current_head
  [ "$now_head" = "$head" ] && break
  log "Head moved during the wait; waiting on the new head."
done

report
