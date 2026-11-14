/**
 * @jest-environment node
 */
// scripts/await-review.sh end to end, with a stub `gh` on PATH. The stub logs
// each call and answers from files in $GH_STATE, so a test can script a PR:
//   head            the PR's head SHA
//   reviewed        SHAs Copilot has reviewed, one per line
//   checks          the `gh pr checks --json` answer
//   fail_pr_view    if present, the next N `gh pr view` calls fail
//   push_on_checks  if present, the first `gh pr checks` moves head to it
//   fail_all        if present, every call but `repo view` fails
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

const SCRIPT = path.join(__dirname, "..", "await-review.sh");

const STUB = `#!/bin/sh
S="$GH_STATE"
echo "$*" >> "$S/log"
case "$*" in "repo view"*) echo owner/repo; exit 0 ;; esac
[ -e "$S/fail_all" ] && exit 1
case "$*" in
  "pr view"*)
    if [ -s "$S/fail_pr_view" ]; then
      n=$(cat "$S/fail_pr_view")
      if [ "$n" -gt 0 ]; then echo $((n - 1)) > "$S/fail_pr_view"; exit 1; fi
    fi
    cat "$S/head" ;;
  "pr edit"*) ;;
  "pr checks"*)
    if [ -e "$S/push_on_checks" ]; then mv "$S/push_on_checks" "$S/head"; fi
    cat "$S/checks" ;;
  *"/reviews")
    printf '[['
    sep=""
    while read -r sha; do
      [ -n "$sha" ] || continue
      printf '%s{"user":{"login":"copilot-pull-request-reviewer[bot]"},"commit_id":"%s","state":"COMMENTED","submitted_at":"2026-11-14T00:00:00Z","body":"Reviewed %s"}' "$sep" "$sha" "$sha"
      sep=","
    done < "$S/reviewed"
    echo ']]' ;;
  *"/timeline") echo '[[]]' ;;
  "api graphql"*) echo '[]' ;;
  *) exit 1 ;;
esac
`;

const SHA1 = "1111111111111111111111111111111111111111";
const SHA2 = "2222222222222222222222222222222222222222";
const GREEN = JSON.stringify([{ name: "test", bucket: "pass", link: "x" }]);

let root: string;
let state: string;

const put = (file: string, content: string) => writeFileSync(path.join(state, file), content);

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "await-review-"));
  const bin = path.join(root, "bin");
  state = path.join(root, "state");
  mkdirSync(bin);
  mkdirSync(state);
  writeFileSync(path.join(bin, "gh"), STUB, { mode: 0o755 });
  put("log", "");
  put("head", SHA1);
  put("reviewed", "");
  put("checks", "[]");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

function run(env: Record<string, string>, args: string[] = []) {
  const result = spawnSync(SCRIPT, ["307", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
      GH_STATE: state,
      AWAIT_REVIEW_POLL_SEC: "1",
      AWAIT_REVIEW_GRACE_SEC: "0",
      ...env,
    },
  });
  const requests = readFileSync(path.join(state, "log"), "utf8")
    .split("\n")
    .filter((call) => call.startsWith("pr edit 307 --add-reviewer @copilot"));
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    requests,
  };
}

describe("await-review.sh", () => {
  it("exits 0 with the report once the head is reviewed and green", () => {
    put("reviewed", `${SHA1}\n`);
    put("checks", GREEN);
    const { status, stdout, requests } = run({ AWAIT_REVIEW_TIMEOUT_SEC: "10" });
    expect(status).toBe(0);
    // The full head SHA, for gh pr merge --match-head-commit.
    expect(stdout).toContain(`== PR #307 (owner/repo) head ${SHA1} ==`);
    expect(stdout).toContain("== Checks: pass ==");
    expect(stdout).toContain(`Reviewed ${SHA1}`);
    expect(requests).toHaveLength(0);
  });

  it("won't accept the old head's review after a push during the CI wait", () => {
    put("reviewed", `${SHA1}\n`);
    put("checks", GREEN);
    put("push_on_checks", SHA2);
    const { status, stdout, stderr, requests } = run({
      AWAIT_REVIEW_TIMEOUT_SEC: "4",
    });
    expect(status).toBe(2);
    expect(stderr).toContain("Head moved during the wait");
    expect(stdout).toContain(`head ${SHA2} ==`);
    expect(stdout).toContain("No Copilot review of 2222222 yet.");
    expect(requests).toHaveLength(1);
  });

  it("completes on the new head once it too is reviewed and green", () => {
    put("reviewed", `${SHA1}\n${SHA2}\n`);
    put("checks", GREEN);
    put("push_on_checks", SHA2);
    const { status, stdout, stderr } = run({ AWAIT_REVIEW_TIMEOUT_SEC: "10" });
    expect(status).toBe(0);
    expect(stderr).toContain("Head moved during the wait");
    expect(stdout).toContain(`head ${SHA2} ==`);
    expect(stdout).toContain(`Reviewed ${SHA2}`);
  });

  it("retries a failed head lookup in --ci-only mode", () => {
    put("checks", GREEN);
    put("fail_pr_view", "1");
    const { status, stderr } = run({ AWAIT_REVIEW_TIMEOUT_SEC: "10" }, ["--ci-only"]);
    expect(status).toBe(0);
    expect(stderr).toContain("gh call failed; will retry.");
  });

  it("exits 2 on timeout even when the outage also fails the report", () => {
    put("fail_all", "");
    const { status, stdout, stderr } = run({ AWAIT_REVIEW_TIMEOUT_SEC: "0" });
    expect(status).toBe(2);
    expect(stderr).toContain("Report incomplete");
    expect(stdout).toContain("== PR #307");
  });

  it("exits 2 when --ci-only never learns the head before the timeout", () => {
    put("fail_all", "");
    const { status, stderr } = run({ AWAIT_REVIEW_TIMEOUT_SEC: "0" }, ["--ci-only"]);
    expect(status).toBe(2);
    expect(stderr).toContain("Timed out");
  });

  it("requests Copilot once while its request may still be propagating", () => {
    const { status, requests } = run({ AWAIT_REVIEW_TIMEOUT_SEC: "3" });
    expect(status).toBe(2);
    expect(requests).toHaveLength(1);
  });

  it("requests again when its request ends without a review", () => {
    // The timeline stays idle: the request was removed or dropped.
    const { status, requests } = run({
      AWAIT_REVIEW_TIMEOUT_SEC: "4",
      AWAIT_REVIEW_REARM_SEC: "1",
    });
    expect(status).toBe(2);
    expect(requests.length).toBeGreaterThanOrEqual(2);
  });
});
