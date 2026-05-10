import { magneticVariation } from "../magvar";

describe("magneticVariation", () => {
  it("returns positive (east) declination in northern Utah", () => {
    // Northern Utah magvar is positive ~10-11° east in current epoch.
    const decl = magneticVariation(41.2, -112.0);
    expect(decl).toBeGreaterThan(5);
    expect(decl).toBeLessThan(15);
  });

  it("returns near-zero declination near agonic line (eastern US)", () => {
    // Agonic line passes near 0°W on the eastern seaboard in current epoch.
    const decl = magneticVariation(35, -83);
    expect(Math.abs(decl)).toBeLessThan(8);
  });

  it("accepts an optional date parameter", () => {
    const declNow = magneticVariation(40, -111, new Date());
    expect(typeof declNow).toBe("number");
    expect(Number.isFinite(declNow)).toBe(true);
  });
});
