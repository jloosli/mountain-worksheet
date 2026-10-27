import { normalizeAirportCode } from "../airportCode";

describe("normalizeAirportCode", () => {
  it("trims surrounding whitespace and uppercases", () => {
    expect(normalizeAirportCode(" kogd ")).toBe("KOGD");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeAirportCode("   ")).toBe("");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeAirportCode(null)).toBe("");
    expect(normalizeAirportCode(undefined)).toBe("");
  });
});
