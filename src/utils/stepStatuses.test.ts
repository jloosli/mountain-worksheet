// src/utils/stepStatuses.test.ts
import { deriveStepStatuses } from "./stepStatuses";
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

const readyForWeather: WorksheetData = {
  ...empty,
  airport: ["KOGD", "KLGU"] as [string, string],
  date: "2026-05-12",
  time: "18:00",
};

describe("deriveStepStatuses", () => {
  it("returns active / pending / pending when nothing is filled and weather not fetched", () => {
    expect(deriveStepStatuses(empty, null)).toEqual({
      sortie: "active",
      weather: "pending",
      decision: "pending",
    });
  });

  it("returns complete / active / pending when sortie is ready to fetch but weather hasn't been fetched", () => {
    expect(deriveStepStatuses(readyForWeather, null)).toEqual({
      sortie: "complete",
      weather: "active",
      decision: "pending",
    });
  });

  it("returns complete / complete / active when weather has been fetched", () => {
    expect(deriveStepStatuses(readyForWeather, new Date())).toEqual({
      sortie: "complete",
      weather: "complete",
      decision: "active",
    });
  });

  it("treats sortie as complete based on canFetchWeather, not weather-fetched", () => {
    // Edge: weather fetched but airports later cleared — sortie reflects
    // current state (incomplete), but weather/decision reflect fetched
    // history.
    const wiped = { ...readyForWeather, airport: ["", ""] as [string, string] };
    expect(deriveStepStatuses(wiped, new Date())).toEqual({
      sortie: "active",
      weather: "complete",
      decision: "active",
    });
  });

  it("treats weather as complete when the worksheet carries weather data (e.g. shared URL) even with no timestamp", () => {
    const withWind: WorksheetData = {
      ...readyForWeather,
      wind: [
        [280, null, null, null, null] as (number | null)[],
        Array(5).fill(null) as (number | null)[],
        Array(5).fill(null) as (number | null)[],
      ] as [(number | null)[], (number | null)[], (number | null)[]],
    };
    expect(deriveStepStatuses(withWind, null)).toEqual({
      sortie: "complete",
      weather: "complete",
      decision: "active",
    });
  });
});
