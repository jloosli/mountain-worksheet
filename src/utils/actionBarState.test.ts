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
  it("returns 'incomplete' when required fields are missing and weather not yet fetched", () => {
    const result: ActionBarState = deriveActionBarState(empty, null);
    expect(result).toBe("incomplete");
  });

  it("returns 'ready' when canFetchWeather is true but weather not yet fetched", () => {
    const state = {
      ...empty,
      airport: ["KOGD", "KLGU"] as [string, string],
      date: "2026-05-12",
      time: "18:00",
    };
    expect(deriveActionBarState(state, null)).toBe("ready");
  });

  it("returns 'fetched' when weatherLastUpdated is set, regardless of required fields", () => {
    const ts = new Date();
    expect(deriveActionBarState(empty, ts)).toBe("fetched");
    expect(
      deriveActionBarState(
        {
          ...empty,
          airport: ["KOGD", "KLGU"],
          date: "2026-05-12",
          time: "18:00",
        },
        ts
      )
    ).toBe("fetched");
  });
});
