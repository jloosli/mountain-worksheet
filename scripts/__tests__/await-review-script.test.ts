/**
 * @jest-environment node
 */
// scripts/await-review.sh end to end, with a stub `gh` on PATH that logs each
// call and answers from canned JSON.
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

const SCRIPT = path.join(__dirname, "..", "await-review.sh");

const STUB = `#!/bin/sh
echo "$*" >> "$GH_LOG"
case "$*" in
  "repo view"*) echo owner/repo ;;
  "pr view"*) [ -n "$GH_FAIL" ] && exit 1; echo headsha ;;
  "pr edit"*) ;;
  "pr checks"*) echo '[]' ;;
  *"/reviews") [ -n "$GH_FAIL" ] && exit 1; echo '[[]]' ;;
  *"/timeline") [ -n "$GH_FAIL" ] && exit 1; echo '[[]]' ;;
  "api graphql"*) [ -n "$GH_FAIL" ] && exit 1; echo '[]' ;;
  *) exit 1 ;;
esac
`;

let root: string;
let ghLog: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "await-review-"));
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  writeFileSync(path.join(bin, "gh"), STUB, { mode: 0o755 });
  ghLog = path.join(root, "gh.log");
  writeFileSync(ghLog, "");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

function run(env: Record<string, string>) {
  const result = spawnSync(SCRIPT, ["307"], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
      GH_LOG: ghLog,
      AWAIT_REVIEW_POLL_SEC: "1",
      AWAIT_REVIEW_GRACE_SEC: "0",
      ...env,
    },
  });
  const requests = readFileSync(ghLog, "utf8")
    .split("\n")
    .filter((call) => call.startsWith("pr edit 307 --add-reviewer @copilot"));
  return { status: result.status, stderr: result.stderr, requests };
}

describe("await-review.sh", () => {
  it("exits 2 on timeout even when the outage also fails the report", () => {
    const { status, stderr } = run({
      GH_FAIL: "1",
      AWAIT_REVIEW_TIMEOUT_SEC: "0",
    });
    expect(status).toBe(2);
    expect(stderr).toContain("Report incomplete");
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
