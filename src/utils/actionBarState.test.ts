// src/utils/actionBarState.test.ts
import {
  canFetchWeather,
  deriveActionBarState,
  type ActionBarState,
} from "./actionBarState";
import type { WorksheetData } from "@/utils/types";

const empty: WorksheetData = {
  pilot: "",
  date: "",
  time: "",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)] as [
    (number | null)[],
    (number | null)[],
    (number | null)[],
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [null, null, null],
  altimeter: [null, null, null],
  altitude: [null, null, null],
  rwy: [null, null],
  weight: null,
  mtnEndorse: false,
  mtnCert: false,
};

describe("canFetchWeather", () => {
  it("treats whitespace-only airport codes as missing (#208)", () => {
    expect(
      canFetchWeather({
        ...empty,
        airport: ["KOGD", "   "],
        date: "2026-10-27",
        time: "16:00",
      })
    ).toBe(false);
  });

  it("returns false when nothing is filled in", () => {
    expect(canFetchWeather(empty)).toBe(false);
  });

  it("returns false when only one airport is filled", () => {
    expect(
      canFetchWeather({
        ...empty,
        airport: ["KOGD", ""],
        date: "2026-05-12",
        time: "18:00",
      })
    ).toBe(false);
  });

  it("returns false when date or time is missing", () => {
    expect(
      canFetchWeather({
        ...empty,
        airport: ["KOGD", "KLGU"],
        date: "",
        time: "18:00",
      })
    ).toBe(false);
    expect(
      canFetchWeather({
        ...empty,
        airport: ["KOGD", "KLGU"],
        date: "2026-05-12",
        time: "",
      })
    ).toBe(false);
  });

  it("returns true when both airports, date, and time are all filled in", () => {
    expect(
      canFetchWeather({
        ...empty,
        airport: ["KOGD", "KLGU"],
        date: "2026-05-12",
        time: "18:00",
      })
    ).toBe(true);
  });
});

describe("deriveActionBarState", () => {
  it("returns 'incomplete' with no weather when the fetch inputs are missing", () => {
    const result: ActionBarState = deriveActionBarState("none", false);
    expect(result).toBe("incomplete");
  });

  it("returns 'ready' with no weather when weather can be fetched", () => {
    expect(deriveActionBarState("none", true)).toBe("ready");
  });

  it.each(["fetched", "stale", "unverified"] as const)(
    "returns 'fetched' for %s weather, whether or not weather can be fetched",
    (status) => {
      expect(deriveActionBarState(status, false)).toBe("fetched");
      expect(deriveActionBarState(status, true)).toBe("fetched");
    }
  );
});
