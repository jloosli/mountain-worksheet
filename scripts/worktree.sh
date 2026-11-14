#!/usr/bin/env bash
# Create or remove a branch worktree beside the main checkout.
#
# Usage:
#   scripts/worktree.sh new <branch>   worktree off a fresh origin/main, npm ci,
#                                      print its path (the only stdout line)
#   scripts/worktree.sh rm <branch>    remove the worktree and local branch,
#                                      then switch a clean main checkout to
#                                      an up-to-date main
#
# The worktree lives at <main checkout parent>/<main checkout name>-<branch>,
# with any "/" in the branch name turned into "-". Works from the main
# checkout or from inside any worktree.

set -euo pipefail

usage() { sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
log() { echo "$*" >&2; }

[ $# -eq 2 ] || { usage >&2; exit 1; }
cmd="$1"
branch="$2"

common="$(git rev-parse --path-format=absolute --git-common-dir)"
main="$(dirname "$common")"
wt="$(dirname "$main")/$(basename "$main")-${branch//\//-}"

# Parallel sessions share one .git; a git command that writes .git/config can
# lose the race for its lock. Retry those a few times.
retry() {
  local n
  for n in 1 2 3 4 5; do
    "$@" && return 0
    [ "$n" -lt 5 ] || return 1
    log "git busy (attempt $n); retrying..."
    sleep 2
  done
}

is_worktree() {
  git -C "$main" worktree list --porcelain | grep -qxF "worktree $1"
}

# A lost lock race can leave the branch created but no worktree, so each
# attempt checks again whether the branch exists.
add_worktree() {
  if git -C "$main" show-ref --verify --quiet "refs/heads/$branch"; then
    log "Checking out existing branch $branch."
    git -C "$main" worktree add --quiet "$wt" "$branch"
  else
    # --no-track: tracking origin/main would write .git/config (lock races)
    # and point `git push` at main. Push with `git push -u origin <branch>`.
    git -C "$main" worktree add --quiet --no-track -b "$branch" "$wt" origin/main
  fi
}

# A shell that lazy-loads nvm gives this script no npm on PATH; load nvm and
# select the version in .nvmrc.
ensure_npm() {
  command -v npm >/dev/null && return 0
  local nvm_sh="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [ -s "$nvm_sh" ]; then
    # shellcheck disable=SC1090 # nvm's location varies by machine
    . "$nvm_sh" --no-use
    nvm use --silent >/dev/null || nvm use --silent default >/dev/null
  fi
  command -v npm >/dev/null || { log "npm not found; install Node or nvm."; exit 1; }
}

new() {
  if [ -e "$wt" ]; then
    log "$wt already exists."
    exit 1
  fi
  git -C "$main" fetch --quiet origin
  retry add_worktree >&2
  cd "$wt"
  ensure_npm
  (npm ci --no-audit --no-fund --loglevel=error >&2)
  echo "$wt"
}

# feature/a and feature-a share a worktree path; only remove the one that has
# our branch checked out.
worktree_branch() {
  git -C "$main" worktree list --porcelain |
    awk -v wt="worktree $1" '$0 == wt { found = 1; next }
      found && /^branch / { sub("^branch refs/heads/", ""); print; exit }
      found && /^$/ { exit }'
}

rm_worktree() {
  if is_worktree "$wt"; then
    on="$(worktree_branch "$wt")"
    if [ "$on" != "$branch" ]; then
      log "Not removed: $wt has ${on:-a detached HEAD} checked out, not $branch."
      exit 1
    fi
    # Refuses on uncommitted or untracked changes rather than discarding work.
    if ! git -C "$main" worktree remove "$wt"; then
      log "Not removed: $wt has changes:"
      git -C "$wt" status --short >&2
      log "Commit or discard them, or run: git worktree remove --force $wt"
      exit 1
    fi
    log "Removed worktree $wt."
  else
    # `gh pr merge --delete-branch` usually removed it already.
    log "No worktree at $wt."
  fi
  git -C "$main" worktree prune

  if git -C "$main" show-ref --verify --quiet "refs/heads/$branch"; then
    # -D: a squash merge leaves the branch looking unmerged.
    retry git -C "$main" branch --quiet -D "$branch"
    log "Deleted local branch $branch."
  else
    log "No local branch $branch."
  fi

  # The main checkout may hold another session's in-progress work; a switch
  # or pull would carry it along or move files around it.
  if [ -n "$(git -C "$main" status --porcelain)" ]; then
    log "Left the main checkout alone: $main has uncommitted changes."
    return 0
  fi
  if git -C "$main" switch --quiet main && git -C "$main" pull --quiet --ff-only; then
    log "Main checkout on main at $(git -C "$main" log --oneline -1)."
  else
    log "Could not bring the main checkout to an up-to-date main; check $main."
    exit 1
  fi
}

case "$cmd" in
  new) new ;;
  rm) rm_worktree ;;
  *) usage >&2; exit 1 ;;
esac
