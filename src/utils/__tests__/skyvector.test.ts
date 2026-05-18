import { latLonToDmsWaypoint } from "@/utils/skyvector";

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
    // 40 + 59.9/60 + 59.6/3600 deg places seconds at ~59.6, which rounds to 60
    // and should carry into minutes.
    const lat = 40 + 59 / 60 + 59.6 / 3600;
    expect(latLonToDmsWaypoint(lat, 0)).toBe("410000N0000000E");
  });

  it("clamps poles and anti-meridian", () => {
    expect(latLonToDmsWaypoint(89.9999, 179.9999)).toBe("900000N1800000E");
    expect(latLonToDmsWaypoint(-89.9999, -179.9999)).toBe("900000S1800000W");
  });
});
