---
name: land-pr
description: >-
  Take a pushed branch to a merged, cleaned-up PR in this repo: open it, watch
  for Copilot comments, address the valid ones, merge when Copilot is happy and
  CI is green, remove the worktree. Use when asked to land or merge a PR,
  "merge when Copilot is happy", or to watch for and address Copilot comments.
---

# Land a PR

Two scripts carry the mechanics; this skill carries the judgement between them.

- `scripts/await-review.sh <pr>` is the whole polling loop. It waits for Copilot's review of the PR's **head commit** (requesting one when none is pending), then for CI, then prints the checks, Copilot's review body, and every unresolved thread as `[comment-id] path:line`. Exit 0 done, 2 timed out.
- `scripts/worktree.sh rm <branch>` removes the worktree and local branch and leaves the main checkout on an up-to-date main.

**Scope.** Merge only when the user asked to land or merge. Asked only to open the PR or handle comments: stop after step 4 and report.

## 1. Open

Push with `git push -u origin <branch>`. Write the body with the `mattpocock-skills:pr` skill, then `gh pr create --base main --body-file <file>`. Skip creation when a PR for the branch exists.

Done when: you hold the PR number.

## 2. Await

Run `scripts/await-review.sh <pr>` with `run_in_background: true` and wait for its completion notification. It is the only polling: write no loops, sleeps or status checks of your own. On exit 2, run it once more; a second timeout goes to the user.

Done when: the script exits 0 and you have read its output.

## 3. Triage every finding

Findings come from two places:

- **Threads**: each `[comment-id] path:line` in the output. `(replied by …)` marks one already answered in an earlier round.
- **Body-only findings**: Copilot's review body can raise issues with no thread, e.g. under "previously missed issues". These count too.

Judge each one against the code, `AGENTS.md`, the worksheet and POH references, and decisions the user has made. A deliberate design decision is not a bug: say so and cite it. Valid: fix it, with a regression test (the repo requires one for every code change). Not valid: change nothing and keep the reason.

Reply to every finding:

- Thread: `gh api repos/{owner}/{repo}/pulls/<pr>/comments/<comment-id>/replies -f body="..."`
- Body-only finding: `gh pr comment <pr> --body "..."`

A reply is `Fixed in <sha>: <what changed, and the test that covers it>` or `Not changing: <reason>`. Leave threads unresolved; Copilot resolves the ones it sees fixed on its next review.

Also fix any failing check.

Done when: every finding has a reply and every valid one has a fix.

## 4. Push and go round

Before each commit run `npm run format`, `npm run lint` and `npm test`. Commit, push, and return to step 2: the script requests Copilot's review of the new head itself.

Copilot is **happy** when its review of the current head raises nothing new that is valid and CI is green. Findings you have already answered as not valid don't hold the PR open. After five rounds without getting there, report to the user.

Done when: Copilot is happy.

## 5. Freshen

Parallel sessions merge to main often, and a stale branch can pass its own CI and break main.

```bash
git fetch origin && git merge-base --is-ancestor origin/main HEAD
```

Non-zero means behind: `git rebase origin/main`, `npm test`, `git push --force-with-lease`, then `scripts/await-review.sh <pr> --ci-only` in the background. A conflict resolution that changed behaviour needs a full step 2 instead.

Done when: the branch contains origin/main and CI on its head is green.

## 6. Retarget stacked PRs

```bash
gh pr list --base <branch> --json number -q '.[].number'
```

Retarget each with `gh pr edit <n> --base main` **before** merging. Deleting a base branch auto-closes the PRs on it, and they cannot be reopened.

Retargeting keeps the child PR open but does not fix its ancestry. After the squash merge, the child still carries this branch's original commits, so its diff shows them again. Its repair is `git rebase --onto origin/main <sha> <child branch>`, where `<sha>` is this PR's merged head, followed by a force push and CI. That rewrites another branch, so do it only if the user asked; otherwise list the command for each child in your report.

Done when: the list is empty, and each retargeted child has been rebased or is named in the report with its repair command.

## 7. Merge and clean up

From the main checkout (`cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"`):

```bash
gh pr merge <pr> --squash --delete-branch --match-head-commit <sha> &&
  [ "$(gh pr view <pr> --json state -q .state)" = MERGED ] &&
  scripts/worktree.sh rm <branch>
```

`<sha>` is the full head SHA in the header of the last `await-review.sh` output, so a push that lands after review and CI makes the merge fail instead of merging unreviewed code. Cleanup runs only once the PR shows MERGED. A failed merge (a required check, a branch that fell behind) keeps the branch and worktree: go back to step 5.

Squash only; the user's history is one commit per PR. `gh` often removes the worktree and local branch itself; `worktree.sh rm` is safe either way, and it updates main itself. If it refuses because the worktree has changes, show them to the user rather than forcing. If it leaves the main checkout alone because that checkout has uncommitted changes (another session's work), say so in the report.

Done when: the PR shows MERGED, the remote and local branch and the worktree are gone, and the main checkout is on an up-to-date main (or was left alone with uncommitted changes). Report the merge commit.
