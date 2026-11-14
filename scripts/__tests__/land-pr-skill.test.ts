/**
 * @jest-environment node
 */
// The land-pr skill's frontmatter must stay valid YAML, or the skill won't
// load. A plain scalar can't hold ": ", so a value with one must be quoted or
// a block scalar.
import { readFileSync } from "fs";
import path from "path";

const SKILL = path.join(__dirname, "..", "..", ".claude", "skills", "land-pr", "SKILL.md");

describe("land-pr SKILL.md frontmatter", () => {
  const frontmatter = readFileSync(SKILL, "utf8").split(/^---$/m)[1];

  it("names the skill and has a description", () => {
    expect(frontmatter).toMatch(/^name: land-pr$/m);
    expect(frontmatter).toMatch(/^description: /m);
  });

  it("has no plain scalar containing ': '", () => {
    const plain = frontmatter
      .split("\n")
      .map((line) => line.match(/^[a-z-]+: (.*)$/)?.[1])
      .filter((v): v is string => v !== undefined)
      .filter((v) => !/^(["'>|])/.test(v));
    for (const value of plain) expect(value).not.toContain(": ");
  });
});
