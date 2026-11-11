// src/utils/stepStatuses.test.ts
import { deriveStepStatuses, formatStepBadge } from "./stepStatuses";
import {
  fieldSubject,
  stepSubject,
  type Notification,
} from "@/utils/notifications";
import type { WorksheetData } from "@/utils/types";
import { unverifiedWeatherNotifications } from "@/utils/unverifiedWeather";

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
    expect(deriveStepStatuses(empty, "none")).toMatchObject({
      sortie: "active",
      weather: "pending",
      decision: "pending",
    });
  });

  it("returns complete / active / pending when sortie is ready to fetch but weather hasn't been fetched", () => {
    expect(deriveStepStatuses(readyForWeather, "none")).toMatchObject({
      sortie: "complete",
      weather: "active",
      decision: "pending",
    });
  });

  it("returns complete / complete / active when weather has been fetched", () => {
    expect(deriveStepStatuses(readyForWeather, "fetched")).toMatchObject({
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
    expect(deriveStepStatuses(filled, "fetched").decision).toBe("active");
  });

  it("treats sortie as complete based on canFetchWeather, not weather-fetched", () => {
    // Edge: weather fetched but airports later cleared — sortie reflects
    // current state (incomplete), but weather/decision reflect fetched
    // history.
    const wiped = { ...readyForWeather, airport: ["", ""] as [string, string] };
    expect(deriveStepStatuses(wiped, "fetched")).toMatchObject({
      sortie: "active",
      weather: "complete",
      decision: "active",
    });
  });

  it("treats unverified weather (e.g. from a shared URL) as complete", () => {
    const withWind: WorksheetData = {
      ...readyForWeather,
      wind: [
        [280, null, null, null, null] as (number | null)[],
        Array(5).fill(null) as (number | null)[],
        Array(5).fill(null) as (number | null)[],
      ] as [(number | null)[], (number | null)[], (number | null)[]],
    };
    expect(deriveStepStatuses(withWind, "unverified")).toMatchObject({
      sortie: "complete",
      weather: "complete",
      decision: "active",
    });
  });

  it("doesn't treat a ticked advisory box alone as fetched weather, though it raises the Unverified weather Caution (#277)", () => {
    const boxOnly = { ...readyForWeather, cielVis: true };
    const result = deriveStepStatuses(boxOnly, "none", unverifiedWeatherNotifications(boxOnly, "none"));
    expect(result.weather).toBe("active");
    expect(result.decision).toBe("pending");
    expect(result.counts.weather.caution).toBe(1);
  });

  it("treats stale weather as complete; its Warnings mark the step", () => {
    expect(deriveStepStatuses(readyForWeather, "stale")).toMatchObject({
      weather: "complete",
      decision: "active",
    });
  });

  it("counts no notifications on any step by default", () => {
    expect(deriveStepStatuses(readyForWeather, "fetched").counts).toEqual({
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
    const result = deriveStepStatuses(readyForWeather, "fetched", notifications);
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
      deriveStepStatuses(readyForWeather, "fetched", notifications).weather
    ).toBe("complete");
  });

  it("marks the weather step `warning` after a total fetch failure, before any weather is applied", () => {
    const notifications: Notification[] = [
      { level: "warning", subject: stepSubject("weather"), message: "fetch failed" },
    ];
    const result = deriveStepStatuses(readyForWeather, "none", notifications);
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
