/**
 * @jest-environment node
 */
// scripts/worktree.sh against a throwaway origin + clone in a temp directory.
import { execFileSync, spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";

const SCRIPT = path.join(__dirname, "..", "worktree.sh");
// A stub npm on PATH logs "<cwd> <args>" instead of installing.
let npmLog: string;
let ENV: NodeJS.ProcessEnv;
const GIT_ENV = {
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.test",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.test",
};

let root: string;
let main: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: ENV, encoding: "utf8" }).trim();

function worktreeSh(cwd: string, ...args: string[]) {
  const r = spawnSync(SCRIPT, args, { cwd, env: ENV, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout.trim(), stderr: r.stderr };
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "worktree-sh-")));
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  npmLog = path.join(root, "npm.log");
  writeFileSync(path.join(bin, "npm"), `#!/bin/sh\necho "$PWD $*" >> "${npmLog}"\n`, {
    mode: 0o755,
  });
  ENV = { ...process.env, ...GIT_ENV, PATH: `${bin}:${process.env.PATH}` };
  const seed = path.join(root, "seed");
  git(root, "init", "-q", "-b", "main", seed);
  writeFileSync(path.join(seed, "README"), "seed\n");
  git(seed, "add", ".");
  git(seed, "commit", "-q", "-m", "seed");
  git(root, "clone", "-q", "--bare", seed, path.join(root, "origin.git"));
  main = path.join(root, "app");
  git(root, "clone", "-q", path.join(root, "origin.git"), main);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("worktree.sh", () => {
  it("creates <main>-<branch> off origin/main, installs, prints only the path", () => {
    const { status, stdout } = worktreeSh(main, "new", "feat/x");
    const wt = path.join(root, "app-feat-x");
    expect(status).toBe(0);
    expect(stdout).toBe(wt);
    expect(git(wt, "rev-parse", "--abbrev-ref", "HEAD")).toBe("feat/x");
    expect(git(wt, "rev-parse", "HEAD")).toBe(git(main, "rev-parse", "origin/main"));
    expect(readFileSync(npmLog, "utf8")).toMatch(new RegExp(`^${wt} ci `));
    // No upstream: `git push` must not default to main.
    expect(() => git(wt, "config", "branch.feat/x.merge")).toThrow();
  });

  it("refuses to create over an existing path", () => {
    worktreeSh(main, "new", "dup");
    expect(worktreeSh(main, "new", "dup").status).toBe(1);
  });

  it("removes the worktree and branch from inside the worktree", () => {
    const wt = worktreeSh(main, "new", "done").stdout;
    const { status } = worktreeSh(wt, "rm", "done");
    expect(status).toBe(0);
    expect(existsSync(wt)).toBe(false);
    expect(git(main, "branch", "--list", "done")).toBe("");
    expect(git(main, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
  });

  it("deletes an unmerged branch, as a squash merge leaves it", () => {
    const wt = worktreeSh(main, "new", "squashed").stdout;
    writeFileSync(path.join(wt, "change.txt"), "x");
    git(wt, "add", "change.txt");
    git(wt, "commit", "-q", "-m", "change");
    expect(worktreeSh(main, "rm", "squashed").status).toBe(0);
    expect(git(main, "branch", "--list", "squashed")).toBe("");
  });

  it("succeeds when the worktree and branch are already gone", () => {
    const wt = worktreeSh(main, "new", "gone").stdout;
    git(main, "worktree", "remove", wt);
    git(main, "branch", "-D", "gone");
    expect(worktreeSh(main, "rm", "gone").status).toBe(0);
  });

  it("leaves a colliding worktree that has another branch checked out", () => {
    // feature/a and feature-a both map to app-feature-a.
    const wt = worktreeSh(main, "new", "feature/a").stdout;
    const { status, stderr } = worktreeSh(main, "rm", "feature-a");
    expect(status).toBe(1);
    expect(stderr).toContain("feature/a checked out");
    expect(existsSync(wt)).toBe(true);
    expect(git(main, "branch", "--list", "feature/a")).not.toBe("");
  });

  it("keeps a worktree with uncommitted work", () => {
    const wt = worktreeSh(main, "new", "wip").stdout;
    writeFileSync(path.join(wt, "stray.txt"), "x");
    const { status, stderr } = worktreeSh(main, "rm", "wip");
    expect(status).toBe(1);
    expect(stderr).toContain("stray.txt");
    expect(existsSync(path.join(wt, "stray.txt"))).toBe(true);
  });

  it("leaves a dirty main checkout's branch, files and commit alone", () => {
    git(main, "switch", "-q", "-c", "in-progress");
    writeFileSync(path.join(main, "README"), "someone's edit\n");
    const before = git(main, "rev-parse", "HEAD");

    worktreeSh(main, "new", "c");
    const { status, stderr } = worktreeSh(main, "rm", "c");
    expect(status).toBe(0);
    expect(stderr).toContain("uncommitted changes");
    expect(git(main, "rev-parse", "--abbrev-ref", "HEAD")).toBe("in-progress");
    expect(git(main, "rev-parse", "HEAD")).toBe(before);
    expect(readFileSync(path.join(main, "README"), "utf8")).toBe("someone's edit\n");
    expect(git(main, "branch", "--list", "c")).toBe("");
  });

  it("brings the main checkout back to an up-to-date main", () => {
    git(main, "switch", "-q", "-c", "elsewhere");
    const other = path.join(root, "other");
    git(root, "clone", "-q", path.join(root, "origin.git"), other);
    writeFileSync(path.join(other, "new.txt"), "x");
    git(other, "add", "new.txt");
    git(other, "commit", "-q", "-m", "upstream change");
    git(other, "push", "-q", "origin", "main");

    worktreeSh(main, "new", "b");
    expect(worktreeSh(main, "rm", "b").status).toBe(0);
    expect(git(main, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
    expect(git(main, "rev-parse", "HEAD")).toBe(git(other, "rev-parse", "HEAD"));
  });
});
