import { latLonToDmsWaypoint } from "@/utils/skyvector";

describe("latLonToDmsWaypoint", () => {
  it("formats positive lat / negative lon", () => {
    expect(latLonToDmsWaypoint(40.5023, -110.7456)).toBe("403008N1104444W");
  });

  it("formats negative lat / positive lon", () => {
    expect(latLonToDmsWaypoint(-33.8688, 151.2093)).toBe("335208S1511233E");
  });
});
