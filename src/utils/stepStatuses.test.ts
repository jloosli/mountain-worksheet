// src/utils/stepStatuses.test.ts
import { deriveStepStatuses, formatStepBadge } from "./stepStatuses";
import {
  fieldSubject,
  stepSubject,
  type Notification,
} from "@/utils/notifications";
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
    expect(deriveStepStatuses(empty, null)).toMatchObject({
      sortie: "active",
      weather: "pending",
      decision: "pending",
    });
  });

  it("returns complete / active / pending when sortie is ready to fetch but weather hasn't been fetched", () => {
    expect(deriveStepStatuses(readyForWeather, null)).toMatchObject({
      sortie: "complete",
      weather: "active",
      decision: "pending",
    });
  });

  it("returns complete / complete / active when weather has been fetched", () => {
    expect(deriveStepStatuses(readyForWeather, new Date())).toMatchObject({
      sortie: "complete",
      weather: "complete",
      decision: "active",
    });
  });

  it("never marks Decision complete, even with every field filled and weather fetched", () => {
    // The worksheet informs the Go/No-Go decision but never states it
    // (GLOSSARY.md), so the Decision step has no "done" status.
    const filled: WorksheetData = {
      ...readyForWeather,
      pilot: "Pilot",
      duration: 2,
      acType: "C182T",
      tailN: "N123AB",
      route: "Area",
      position: [40.5, -111.5],
      wind: [
        [270, 270, 270, 270, 270],
        [10, 10, 10, 10, 10],
        [10, 5, 0, -5, -10],
      ],
      temp: [15, 5, 15],
      altimeter: [30.0, 30.0, 30.0],
      altitude: [4500, 10500, 4500],
      rwy: [8000, 8000],
      weight: 2600,
      mtnEndorse: true,
      mtnCert: true,
    };
    expect(deriveStepStatuses(filled, new Date()).decision).toBe("active");
  });

  it("treats sortie as complete based on canFetchWeather, not weather-fetched", () => {
    // Edge: weather fetched but airports later cleared — sortie reflects
    // current state (incomplete), but weather/decision reflect fetched
    // history.
    const wiped = { ...readyForWeather, airport: ["", ""] as [string, string] };
    expect(deriveStepStatuses(wiped, new Date())).toMatchObject({
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
    expect(deriveStepStatuses(withWind, null)).toMatchObject({
      sortie: "complete",
      weather: "complete",
      decision: "active",
    });
  });

  it("counts no notifications on any step by default", () => {
    expect(deriveStepStatuses(readyForWeather, new Date()).counts).toEqual({
      sortie: { warning: 0, caution: 0, advisory: 0 },
      weather: { warning: 0, caution: 0, advisory: 0 },
      decision: { warning: 0, caution: 0, advisory: 0 },
    });
  });

  it("marks a step `warning` when any of its Subjects has a Warning, and counts per step", () => {
    const notifications: Notification[] = [
      { level: "warning", subject: fieldSubject("temp", 2), message: "a" },
      { level: "caution", subject: stepSubject("weather"), message: "b" },
      { level: "advisory", subject: fieldSubject("temp", 0), message: "c" },
      { level: "caution", subject: fieldSubject("position"), message: "d" },
    ];
    const result = deriveStepStatuses(readyForWeather, new Date(), notifications);
    expect(result).toMatchObject({
      sortie: "complete",
      weather: "warning",
      decision: "active",
    });
    expect(result.counts.weather).toEqual({ warning: 1, caution: 1, advisory: 1 });
    expect(result.counts.sortie).toEqual({ warning: 0, caution: 1, advisory: 0 });
  });

  it("does not change status for Cautions or Advisories alone", () => {
    const notifications: Notification[] = [
      { level: "caution", subject: stepSubject("weather"), message: "b" },
    ];
    expect(
      deriveStepStatuses(readyForWeather, new Date(), notifications).weather
    ).toBe("complete");
  });

  it("marks the weather step `warning` after a total fetch failure, before any weather is applied", () => {
    const notifications: Notification[] = [
      { level: "warning", subject: stepSubject("weather"), message: "fetch failed" },
    ];
    const result = deriveStepStatuses(readyForWeather, null, notifications);
    expect(result.weather).toBe("warning");
    // Warnings never block the other steps.
    expect(result.sortie).toBe("complete");
  });
});

describe("formatStepBadge", () => {
  it("is empty when the step has no Warnings or Cautions", () => {
    expect(formatStepBadge({ warning: 0, caution: 0, advisory: 3 })).toBeUndefined();
  });

  it("counts Warnings and Cautions", () => {
    expect(formatStepBadge({ warning: 1, caution: 0, advisory: 0 })).toBe("1 warning");
    expect(formatStepBadge({ warning: 2, caution: 1, advisory: 5 })).toBe(
      "2 warnings · 1 caution"
    );
    expect(formatStepBadge({ warning: 0, caution: 3, advisory: 0 })).toBe("3 cautions");
  });
});
