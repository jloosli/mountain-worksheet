import { buildSkyvectorUrl, latLonToDmsWaypoint } from "@/utils/skyvector";

describe("latLonToDmsWaypoint", () => {
  it("formats positive lat / negative lon", () => {
    expect(latLonToDmsWaypoint(40.5023, -110.7456)).toBe("403008N1104444W");
  });

  it("formats negative lat / positive lon", () => {
    expect(latLonToDmsWaypoint(-33.8688, 151.2093)).toBe("335208S1511233E");
  });

  it("formats exact integer degrees", () => {
    expect(latLonToDmsWaypoint(40, -110)).toBe("400000N1100000W");
  });

  it("formats zero coordinates with N/E suffix and correct widths", () => {
    expect(latLonToDmsWaypoint(0, 0)).toBe("000000N0000000E");
  });

  it("treats negative zero as positive (N/E)", () => {
    expect(latLonToDmsWaypoint(-0, -0)).toBe("000000N0000000E");
  });

  it("rolls seconds 60 over into minutes", () => {
    // minutes total ≈ 59.993, leaving seconds ≈ 59.6, which rounds to 60
    // (carries into minutes, then minutes 60 carries into degrees).
    const lat = 40 + 59 / 60 + 59.6 / 3600;
    expect(latLonToDmsWaypoint(lat, 0)).toBe("410000N0000000E");
  });

  it("clamps poles and anti-meridian", () => {
    expect(latLonToDmsWaypoint(89.9999, 179.9999)).toBe("900000N1800000E");
    expect(latLonToDmsWaypoint(-89.9999, -179.9999)).toBe("900000S1800000W");
    // Inputs strictly above ±90 / ±180 should hit the explicit clamp branch.
    expect(latLonToDmsWaypoint(91, 181)).toBe("900000N1800000E");
    expect(latLonToDmsWaypoint(-91, -181)).toBe("900000S1800000W");
  });
});

describe("buildSkyvectorUrl", () => {
  it("builds a three-waypoint URL when all fields are set", () => {
    expect(
      buildSkyvectorUrl({
        departure: "KPVU",
        arrival: "KSGU",
        operating: [40.5023, -110.7456],
      })
    ).toBe(
      "https://skyvector.com/?fpl=KPVU%20403008N1104444W%20KSGU"
    );
  });

  it("omits operating waypoint when operating is null", () => {
    expect(
      buildSkyvectorUrl({ departure: "KPVU", arrival: "KSGU", operating: null })
    ).toBe("https://skyvector.com/?fpl=KPVU%20KSGU");
  });

  it("omits operating waypoint when one coordinate is null", () => {
    expect(
      buildSkyvectorUrl({
        departure: "KPVU",
        arrival: "KSGU",
        operating: [40.5, null],
      })
    ).toBe("https://skyvector.com/?fpl=KPVU%20KSGU");
  });

  it("returns null when departure is empty", () => {
    expect(
      buildSkyvectorUrl({ departure: "", arrival: "KSGU", operating: null })
    ).toBeNull();
  });

  it("returns null when arrival is whitespace-only", () => {
    expect(
      buildSkyvectorUrl({ departure: "KPVU", arrival: "   ", operating: null })
    ).toBeNull();
  });

  it("uppercases and trims airport identifiers", () => {
    expect(
      buildSkyvectorUrl({
        departure: " kpvu ",
        arrival: "kSgU",
        operating: null,
      })
    ).toBe("https://skyvector.com/?fpl=KPVU%20KSGU");
  });

  it("treats exact-zero operating coordinates as valid", () => {
    expect(
      buildSkyvectorUrl({
        departure: "KPVU",
        arrival: "KSGU",
        operating: [0, 0],
      })
    ).toBe("https://skyvector.com/?fpl=KPVU%20000000N0000000E%20KSGU");
  });
});
