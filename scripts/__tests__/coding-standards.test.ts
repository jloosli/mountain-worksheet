/**
 * @jest-environment node
 */
// The review rules live in .github/copilot-instructions.md so Copilot's
// automatic review applies them; CODING_STANDARDS.md is a symlink to it so
// local reviewers find them by the conventional name. Copilot code review
// reads only the first 4,000 characters of the file and follows no links, so
// anything past that is silently dropped.
import { lstatSync, readFileSync, readlinkSync } from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const INSTRUCTIONS = path.join(ROOT, ".github", "copilot-instructions.md");
const STANDARDS = path.join(ROOT, "CODING_STANDARDS.md");

describe("coding standards", () => {
  it("fit in the 4,000 characters Copilot code review reads", () => {
    expect([...readFileSync(INSTRUCTIONS, "utf8")].length).toBeLessThanOrEqual(4000);
  });

  it("are one file: CODING_STANDARDS.md links to the Copilot instructions", () => {
    expect(lstatSync(STANDARDS).isSymbolicLink()).toBe(true);
    expect(readlinkSync(STANDARDS)).toBe(".github/copilot-instructions.md");
  });
});
