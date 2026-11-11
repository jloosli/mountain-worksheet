import { hasWeather, hasWeatherData } from "../weatherStatus";
import type { WorksheetData } from "../types";

const empty = {
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)],
  temp: [null, null, null],
  altimeter: [null, null, null],
  turb: false,
  cielVis: false,
  mtnObsc: false,
} as unknown as WorksheetData;

describe("hasWeatherData", () => {
  it("returns false when no weather fields are populated", () => {
    expect(hasWeatherData(empty)).toBe(false);
  });

  it("returns true when wind has any value, including a calm 0", () => {
    const wind = [[0, null, null, null, null], Array(5).fill(null), Array(5).fill(null)];
    expect(hasWeatherData({ ...empty, wind } as WorksheetData)).toBe(true);
  });

  it("returns true when temp has any value", () => {
    expect(hasWeatherData({ ...empty, temp: [null, 20, null] })).toBe(true);
  });

  it("returns true when altimeter has any value", () => {
    expect(hasWeatherData({ ...empty, altimeter: [29.92, null, null] })).toBe(true);
  });

  it.each(["turb", "cielVis", "mtnObsc"] as const)(
    "doesn't count a ticked %s box alone as weather data (#277)",
    (box) => {
      expect(hasWeatherData({ ...empty, [box]: true })).toBe(false);
    },
  );
});

describe("hasWeather", () => {
  it("is false only for none", () => {
    expect(hasWeather("none")).toBe(false);
    expect(hasWeather("unverified")).toBe(true);
    expect(hasWeather("fetched")).toBe(true);
    expect(hasWeather("stale")).toBe(true);
  });
});
