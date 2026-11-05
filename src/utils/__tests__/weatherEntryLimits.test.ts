import { isValidAltimeterEntry, isValidWindEntry } from "../weatherEntryLimits";

describe("weather entry limits (shared by the editors and shared links)", () => {
  it("accepts altimeters from 28.00 to 31.00 inHg", () => {
    expect(isValidAltimeterEntry(28)).toBe(true);
    expect(isValidAltimeterEntry(31)).toBe(true);
    expect(isValidAltimeterEntry(27.99)).toBe(false);
    expect(isValidAltimeterEntry(35)).toBe(false);
  });

  it("checks each winds-aloft row against its own limits", () => {
    expect(isValidWindEntry(0, 359)).toBe(true);
    expect(isValidWindEntry(0, 360)).toBe(false);
    expect(isValidWindEntry(0, 90.5)).toBe(false);
    expect(isValidWindEntry(1, 150)).toBe(true);
    expect(isValidWindEntry(1, 151)).toBe(false);
    expect(isValidWindEntry(2, -50)).toBe(true);
    expect(isValidWindEntry(2, 50.5)).toBe(false);
  });
});
