import {
  compassPoint,
  geodesicDestination,
  greatCircleDistanceNm,
  initialBearingDeg,
} from "../positionMath";

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

describe("greatCircleDistanceNm / initialBearingDeg / compassPoint", () => {
  it("measures one degree of latitude as about 60 nm, due north", () => {
    expect(greatCircleDistanceNm([44, -115], [45, -115])).toBeCloseTo(60.04, 1);
    expect(initialBearingDeg([44, -115], [45, -115])).toBeCloseTo(0, 6);
  });

  it("gives KSLC to KOGD as about 24.5 nm, a little west of north", () => {
    // KSLC 40.7884, -111.9778; KOGD 41.1961, -112.0122
    const from: [number, number] = [40.7884, -111.9778];
    const to: [number, number] = [41.1961, -112.0122];
    expect(greatCircleDistanceNm(from, to)).toBeCloseTo(24.5, 0);
    expect(initialBearingDeg(from, to)).toBeCloseTo(356, 0);
    expect(compassPoint(initialBearingDeg(from, to))).toBe("N");
  });

  it("measures zero between the same point", () => {
    expect(greatCircleDistanceNm([44, -115], [44, -115])).toBe(0);
  });

  it("rounds bearings to the nearest of eight compass points", () => {
    expect([0, 22, 23, 90, 157, 203, 270, 337, 338, 359].map(compassPoint)).toEqual([
      "N",
      "N",
      "NE",
      "E",
      "SE",
      "SW",
      "W",
      "NW",
      "N",
      "N",
    ]);
  });
});
