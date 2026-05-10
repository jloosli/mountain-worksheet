import { geodesicDestination } from "../positionMath";

describe("geodesicDestination", () => {
  it("travels east 60nm from (0, 0) ≈ (0, 1°)", () => {
    const { lat, lon } = geodesicDestination(0, 0, 90, 60);
    expect(lat).toBeCloseTo(0, 4);
    expect(lon).toBeCloseTo(1.0, 2);
  });

  it("travels north 60nm from (0, 0) ≈ (1°, 0)", () => {
    const { lat, lon } = geodesicDestination(0, 0, 0, 60);
    expect(lat).toBeCloseTo(1.0, 2);
    expect(lon).toBeCloseTo(0, 4);
  });

  it("zero distance returns starting point", () => {
    const { lat, lon } = geodesicDestination(41.5, -112.5, 285, 0);
    expect(lat).toBeCloseTo(41.5, 6);
    expect(lon).toBeCloseTo(-112.5, 6);
  });

  it("normalizes longitude across antimeridian", () => {
    // From near +180, traveling east, lon should wrap to negative.
    const { lon } = geodesicDestination(0, 179, 90, 120);
    expect(lon).toBeLessThan(0);
    expect(lon).toBeGreaterThan(-180);
  });

  it("KOGD-like reference: (41.20, -112.01) + true bearing 297° + 34nm", () => {
    // Hand-computed reference point — within 0.05° tolerance.
    const { lat, lon } = geodesicDestination(41.2, -112.01, 297, 34);
    expect(lat).toBeCloseTo(41.46, 1);
    expect(lon).toBeCloseTo(-112.69, 1);
  });

  it("returns finite latitude even when sinLat2 would round outside [-1, 1]", () => {
    // Travelling 0° (due north) from (89.99, 0) for 90nm crosses the pole.
    // Spherical formula puts sinLat2 right at +1 and floating-point error
    // can push it past 1, which would make Math.asin return NaN without
    // the clamp.
    const { lat, lon } = geodesicDestination(89.99, 0, 0, 90);
    expect(Number.isFinite(lat)).toBe(true);
    expect(Number.isFinite(lon)).toBe(true);
    expect(lat).toBeLessThanOrEqual(90);
    expect(lat).toBeGreaterThanOrEqual(-90);
  });
});
