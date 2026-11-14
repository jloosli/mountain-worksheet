/**
 * @jest-environment node
 */
// The jq filters behind scripts/await-review.sh, run against fixture JSON.
// pr-304-reviews.json is PR #304's real review list (Copilot reviewed three
// commits, and replies to review comments show up as the author's reviews).
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const LIB = path.join(__dirname, "..", "lib");
const FIXTURES = path.join(__dirname, "fixtures");

function jq(filter: string, input: unknown, args: Record<string, string> = {}): string {
  const argv = ["-r", "-f", path.join(LIB, filter)];
  for (const [k, v] of Object.entries(args)) argv.push("--arg", k, v);
  return execFileSync("jq", argv, {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
  }).trimEnd();
}

const fixture = (name: string) => readFileSync(path.join(FIXTURES, name), "utf8");

describe("copilot-review.jq", () => {
  const reviews = fixture("pr-304-reviews.json");
  const FIRST = "f9fe848e28688ea4006c18fe94c1248caaa35dd1";
  const SECOND = "b011a64b8886792136e97b21585167fb58c98fba";
  const HEAD = "d3414ea4004ae9c5fe8555d32138840fd347904c";

  it("prints Copilot's review of the head commit only", () => {
    const out = jq("copilot-review.jq", reviews, { head: HEAD });
    expect(out).toMatch(/^Copilot review of d3414ea \(COMMENTED, /);
    expect(out).toContain("### 🟢 Approval recommended");
    expect(out).not.toContain("Changes recommended");
  });

  it("prints nothing when Copilot has not reviewed the head", () => {
    expect(jq("copilot-review.jq", reviews, { head: "0".repeat(40) })).toBe("");
  });

  it("ignores reviews by other users on the same commit", () => {
    // jloosli's two reply-reviews on SECOND are not Copilot's review.
    const out = jq("copilot-review.jq", reviews, { head: SECOND });
    expect(out).toContain("### 🔵 Needs a closer look");
  });

  it("turns badges into alt text and thread links into comment ids", () => {
    const out = jq("copilot-review.jq", reviews, { head: FIRST });
    expect(out).toContain(
      "- [Medium severity] Dateline-crossing search bounds miss stations across ±180° [4559072692] · New",
    );
    expect(out).not.toMatch(/<|githubassets|discussion_r/);
  });

  it("drops the change summary table and review-effort footer", () => {
    const out = jq("copilot-review.jq", reviews, { head: FIRST });
    expect(out).not.toContain("What changed in this PR");
    expect(out).not.toContain("| File |");
    expect(out).not.toContain("Review effort");
  });

  it("keeps body-only findings and strips zero-width spaces from paths", () => {
    const out = jq("copilot-review.jq", reviews, { head: SECOND });
    expect(out).toContain("1 previously missed issue");
    expect(out).toContain("`src/utils/substituteStation.ts:255`");
    expect(out).not.toContain("​");
    expect(out).not.toMatch(/\n{3,}/);
  });
});

describe("copilot-pending.jq", () => {
  const requested = (at: string) => ({
    event: "review_requested",
    created_at: at,
    requested_reviewer: { login: "Copilot" },
  });
  const reviewed = (at: string) => ({
    event: "reviewed",
    submitted_at: at,
    user: { login: "Copilot" },
  });

  it("is idle with no request", () => {
    expect(jq("copilot-pending.jq", [])).toBe("idle");
  });

  it("is pending when the latest request is newer than the latest review", () => {
    const timeline = [
      requested("2026-11-13T02:39:42Z"),
      reviewed("2026-11-13T02:45:31Z"),
      requested("2026-11-13T02:47:21Z"),
    ];
    expect(jq("copilot-pending.jq", timeline)).toBe("pending");
  });

  it("is idle once Copilot has reviewed after the latest request", () => {
    const timeline = [requested("2026-11-13T02:47:21Z"), reviewed("2026-11-13T02:52:09Z")];
    expect(jq("copilot-pending.jq", timeline)).toBe("idle");
  });

  it("is idle when the request was removed", () => {
    const timeline = [
      requested("2026-11-13T02:47:21Z"),
      {
        event: "review_request_removed",
        created_at: "2026-11-13T02:48:00Z",
        requested_reviewer: { login: "Copilot" },
      },
    ];
    expect(jq("copilot-pending.jq", timeline)).toBe("idle");
  });

  it("ignores requests and reviews from other users", () => {
    const timeline = [
      {
        event: "review_requested",
        created_at: "2026-11-13T03:00:00Z",
        requested_reviewer: { login: "jloosli" },
      },
      { event: "committed", sha: "abc" },
    ];
    expect(jq("copilot-pending.jq", timeline)).toBe("idle");
  });
});

describe("review-threads.jq", () => {
  const out = jq("review-threads.jq", fixture("review-threads.json"));

  it("counts and lists only unresolved threads", () => {
    expect(out).toMatch(/^Unresolved review threads: 2\n/);
    expect(out).not.toContain("resolved.ts");
    expect(out).not.toContain("[1001]");
  });

  it("prints a thread awaiting a reply in full under its comment id", () => {
    expect(out).toContain(
      "[4534380993] src/utils/gairmetApi.ts:52\n" +
        "    `TURB-HI` is discarded even for a 20,000-ft sortie.\n" +
        "    Second line of detail.",
    );
  });

  it("marks outdated, replied threads and cuts them to one line", () => {
    expect(out).toContain(
      "[4534346204] src/app/api/aviation-weather/route.ts:59 (outdated) (replied by jloosli)\n" +
        "    This proxy also serves METAR requests.",
    );
    expect(out).not.toContain("More detail that a replied thread hides");
  });
});

describe("checks.jq", () => {
  const state = (checks: unknown[]) => jq("checks.jq", checks, { mode: "state" });
  const check = (name: string, bucket: string) => ({
    name,
    bucket,
    link: `https://example.test/${name}`,
  });

  it("reports none before any check exists", () => {
    expect(state([])).toBe("none");
  });

  it("is pending while any check runs, even next to a failure", () => {
    expect(state([check("test", "pending"), check("lint", "fail")])).toBe("pending");
  });

  it("fails on a failed or cancelled check", () => {
    expect(state([check("test", "fail"), check("Vercel", "pass")])).toBe("fail");
    expect(state([check("test", "cancel")])).toBe("fail");
  });

  it("passes when every check passed or was skipped", () => {
    expect(state([check("test", "pass"), check("review", "skipping")])).toBe("pass");
  });

  it("renders one sorted line per check, with links only on failures", () => {
    const out = jq("checks.jq", [check("test", "fail"), check("Vercel", "pass")], {
      mode: "render",
    });
    expect(out).toBe("pass\tVercel\nfail\ttest\thttps://example.test/test");
  });
});
