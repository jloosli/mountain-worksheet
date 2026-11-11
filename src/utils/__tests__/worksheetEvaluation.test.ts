import { fieldSubject, type Notification, type WeatherFetchResult } from "../notifications";
import { briefingNotes } from "../briefingNotes";
import { substitutionsFor } from "../provenance";
import { windEntryKey } from "../rejectedEntries";
import type { WorksheetData } from "../types";
import {
  EMPTY_SESSION,
  evaluateWorksheet,
  type WorksheetSession,
} from "../worksheetEvaluation";
import type { LimitCheck } from "../limitChecks";

const emptyState = (): WorksheetData => ({
  pilot: "",
  date: "2026-01-01",
  time: "10:00",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  wind: [
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
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
});

/** A C182T sortie with everything the performance checks need. */
const sortie = (overrides: Partial<WorksheetData> = {}): WorksheetData => ({
  ...emptyState(),
  acType: "C182T", // max gross 3,100 lbs
  weight: 2700,
  airport: ["KABC", "KXYZ"],
  altitude: [1000, 8000, 1000],
  altimeter: [29.92, 29.92, 29.92],
  temp: [20, 10, 20],
  rwy: [3000, 3000],
  ...overrides,
});

/** Weather fetched this session, so nothing is Unverified weather. */
const fetchedSession = (overrides: Partial<WorksheetSession> = {}): WorksheetSession => ({
  ...EMPTY_SESSION,
  lastUpdated: new Date("2026-01-01T09:00:00Z"),
  ...overrides,
});

const check = (checks: LimitCheck[], id: LimitCheck["id"]) => {
  const found = checks.find((c) => c.id === id);
  if (!found) throw new Error(`no ${id} check`);
  return found;
};

const onField = (notifications: Notification[], field: string, index?: number) =>
  notifications.filter(
    (n) => n.subject.kind === "field" && n.subject.field === field && n.subject.index === index,
  );

describe("evaluateWorksheet — performance notifications", () => {
  it("raises the over-maximum-gross Warning once, on the weight field, and marks Sortie Details", () => {
    const e = evaluateWorksheet(sortie({ weight: 3200 }), fetchedSession());
    const warnings = onField(e.notifications, "weight").filter((n) => n.level === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/Weight 3,200 lbs exceeds the C182T maximum gross weight/);
    expect(e.stepStatuses.sortie).toBe("warning");
    expect(e.stepStatuses.counts.sortie.warning).toBe(1);
  });

  it("clears the Warning and step mark once the weight is within maximum gross", () => {
    const e = evaluateWorksheet(sortie({ weight: 2976 }), fetchedSession());
    expect(onField(e.notifications, "weight")).toEqual([]);
    expect(e.stepStatuses.sortie).toBe("complete");
  });

  it("withholds values that depend on a Warned input, using the Warnings it raised itself", () => {
    const e = evaluateWorksheet(sortie({ weight: 3255 }), fetchedSession());
    expect(e.told.departure.values.takeoffGroundRoll.status).toBe("withheld");
    expect(e.climb.rateOfClimbActual[1].status).toBe("withheld");
  });

  it("computes the same values the pilot's own inputs allow when nothing is Warned", () => {
    const e = evaluateWorksheet(sortie(), fetchedSession());
    expect(e.told.departure.values.takeoffGroundRoll.status).toBe("computed");
    expect(e.climb.rateOfClimbActual[1].status).toBe("computed");
    expect(e.pressure.PAs.every((pa) => typeof pa === "number")).toBe(true);
    expect(e.pressure.DAs.every((da) => typeof da === "number")).toBe(true);
  });
});

describe("evaluateWorksheet — maneuvering", () => {
  it("computes speeds and canyon-turn entry ranges for a known aircraft", () => {
    const { maneuvering } = evaluateWorksheet(sortie(), fetchedSession());
    expect(maneuvering.speeds).not.toBeNull();
    expect(maneuvering.entryRanges.length).toBeGreaterThan(0);
    expect(maneuvering.notifications).toEqual([]);
  });

  it("has no speeds without an aircraft type", () => {
    const { maneuvering } = evaluateWorksheet(emptyState(), EMPTY_SESSION);
    expect(maneuvering).toEqual({ speeds: null, entryRanges: [], notifications: [] });
  });
});

describe("evaluateWorksheet — Weight limit check", () => {
  it("is Not checked until there's an aircraft type and weight", () => {
    const weight = check(evaluateWorksheet(emptyState(), EMPTY_SESSION).limitChecks, "weight");
    expect(weight.state).toBe("not-checked");
    expect(weight.points[0].waitingFor).toBe("needs aircraft type and weight");
  });

  it("is Within limit at 89.9% and Exceeded at 90.0%", () => {
    const under = check(evaluateWorksheet(sortie({ weight: 2787 }), fetchedSession()).limitChecks, "weight");
    expect(under.state).toBe("within");
    expect(under.points[0].value).toBe("2,787 / 3,100 lbs (89.9%)");
    const at = check(evaluateWorksheet(sortie({ weight: 2790 }), fetchedSession()).limitChecks, "weight");
    expect(at.state).toBe("exceeded");
    expect(at.points[0].value).toBe("2,790 / 3,100 lbs (90%)");
  });

  it("is Exceeded above maximum gross while the Warning stays on the weight field", () => {
    const e = evaluateWorksheet(sortie({ weight: 3255 }), fetchedSession());
    expect(check(e.limitChecks, "weight").state).toBe("exceeded");
    expect(onField(e.notifications, "weight")[0].level).toBe("warning");
  });

  it("doesn't change step statuses or counts (ADR 0002)", () => {
    const within = evaluateWorksheet(sortie({ weight: 2789 }), fetchedSession());
    const exceeded = evaluateWorksheet(sortie({ weight: 2790 }), fetchedSession());
    expect(check(exceeded.limitChecks, "weight").state).toBe("exceeded");
    expect(exceeded.stepStatuses).toEqual(within.stepStatuses);
  });
});

describe("evaluateWorksheet — Winds aloft limit check", () => {
  const withSpeeds = (speeds: (number | null)[]) =>
    sortie({ wind: [[null, null, null, null, null], speeds, [null, null, null, null, null]] });

  it("is Near limit at 22 kt and Exceeded at 30 kt", () => {
    const near = evaluateWorksheet(withSpeeds([0, null, 22, null, null]), fetchedSession());
    expect(check(near.limitChecks, "winds").state).toBe("near");
    const exceeded = evaluateWorksheet(withSpeeds([0, null, 22, 30, null]), fetchedSession());
    expect(check(exceeded.limitChecks, "winds").state).toBe("exceeded");
  });

  it("is Not checked when a typed speed was rejected, even though another altitude passes", () => {
    const state = withSpeeds([10, null, null, null, null]);
    const e = evaluateWorksheet(
      state,
      fetchedSession({
        rejected: {
          [windEntryKey(1, 1)]: {
            raw: "500",
            storedValue: null,
            notification: {
              level: "warning" as const,
              subject: fieldSubject("wind", 1),
              message: "Wind velocity 500 at 6,000 ft is not valid; enter 0–200. Not applied.",
            },
          },
        },
      }),
    );
    const winds = check(e.limitChecks, "winds");
    expect(winds.state).toBe("not-checked");
    expect(winds.points.find((p) => p.label.startsWith("6,000"))?.waitingFor).toBe(
      "needs speed (Warning)",
    );
    expect(e.stepStatuses.counts.weather.warning).toBe(1);
  });
});

describe("evaluateWorksheet — Unverified weather", () => {
  it("marks the climb, runway and ceiling/visibility checks when weather wasn't fetched this session", () => {
    const e = evaluateWorksheet(sortie({ cielVis: true }), EMPTY_SESSION);
    expect(e.stepStatuses.counts.weather.caution).toBe(1);
    for (const id of ["climb", "runway", "ceilVis"] as const) {
      const substitutions = check(e.limitChecks, id).points.flatMap((p) => p.substitutions);
      expect(substitutions.some((n) => /came from a shared link/.test(n.message))).toBe(true);
    }
  });

  it("marks a rate of climb with Unverified weather on screen and on the Briefing, as its Limit check point is", () => {
    const e = evaluateWorksheet(sortie(), EMPTY_SESSION);
    const roc = e.climb.rateOfClimbActual[0];
    const unverified = e.notifications.filter((n) => /came from a shared link/.test(n.message));
    expect(unverified).toHaveLength(1);
    // Screen markers and Limit check points both read this one rule.
    expect(substitutionsFor(roc, e.notifications)).toEqual(unverified);
    expect(check(e.limitChecks, "climb").points[0].substitutions).toEqual(unverified);
    // The Briefing prints the same note's reference next to the value.
    const b = briefingNotes(e.notifications);
    expect(b.markersOn(roc)).toEqual(b.refsFor(unverified));
    expect(b.markersOn(roc)).toHaveLength(1);
  });

  it("drops the Caution and the markers once weather is fetched this session", () => {
    const e = evaluateWorksheet(sortie({ cielVis: true }), fetchedSession());
    expect(e.notifications.some((n) => /came from a shared link/.test(n.message))).toBe(false);
    for (const id of ["climb", "runway", "ceilVis"] as const) {
      expect(check(e.limitChecks, id).points.flatMap((p) => p.substitutions)).toEqual([]);
    }
  });
});

describe("evaluateWorksheet — Rate of climb and Runway limit checks", () => {
  it("is Within limit with a climb over 300 fpm and runway to spare", () => {
    const e = evaluateWorksheet(sortie(), fetchedSession());
    expect(check(e.limitChecks, "climb").state).toBe("within");
    expect(check(e.limitChecks, "runway").state).toBe("within");
  });

  it("is Exceeded at only the points that fail", () => {
    const e = evaluateWorksheet(
      sortie({ rwy: [3000, 600], altitude: [1000, 16000, 1000] }),
      fetchedSession(),
    );
    const climb = check(e.limitChecks, "climb");
    expect(climb.state).toBe("exceeded");
    // Points run departure, operating altitude, arrival.
    expect(climb.points.map((p) => p.state)).toEqual(["within", "exceeded", "within"]);
    const runway = check(e.limitChecks, "runway");
    expect(runway.state).toBe("exceeded");
    // Points run departure, arrival.
    expect(runway.points.map((p) => p.state)).toEqual(["within", "exceeded"]);
  });

  it("is Not checked above maximum gross, saying why", () => {
    const e = evaluateWorksheet(sortie({ weight: 3255 }), fetchedSession());
    for (const id of ["climb", "runway"] as const) {
      const c = check(e.limitChecks, id);
      expect(c.state).toBe("not-checked");
      expect(c.points.map((p) => p.waitingFor)).toContain("needs weight at or below maximum gross");
    }
  });
});

describe("evaluateWorksheet — session", () => {
  const fetchFor = (state: WorksheetData): WeatherFetchResult => ({
    fetchedFor: {
      airport: [state.airport[0], state.airport[1]],
      date: state.date,
      time: state.time,
      duration: state.duration,
      position: state.position,
    },
    applied: { temp: state.temp, altimeter: state.altimeter, rwy: state.rwy },
    notifications: [],
  });

  it("withholds departure results and leaves the runway check Not checked once the departure airport changes after a fetch", () => {
    const fetchedState = sortie();
    const fetch = fetchFor(fetchedState);
    const session = fetchedSession({ lastFetch: fetch, lastApplied: fetch });
    expect(evaluateWorksheet(fetchedState, session).told.departure.values.takeoffGroundRoll.status).toBe(
      "computed",
    );

    const moved = { ...fetchedState, airport: ["KSLC", "KXYZ"] as [string, string] };
    const e = evaluateWorksheet(moved, session);
    expect(e.told.departure.values.takeoffGroundRoll.status).toBe("withheld");
    expect(e.told.arrival.values.takeoffGroundRoll.status).toBe("computed");
    const runway = check(e.limitChecks, "runway");
    expect(runway.points.map((p) => p.state)).toEqual(["not-checked", "within"]);
    expect(e.stepStatuses.weather).toBe("warning");
  });

  it("counts runway-lookup notifications on the weather step", () => {
    const e = evaluateWorksheet(
      sortie(),
      fetchedSession({
        runwayNotifications: [
          { level: "warning", subject: fieldSubject("rwy", 0), message: "Runway lookup failed." },
        ],
      }),
    );
    expect(e.notifications.map((n) => n.message)).toContain("Runway lookup failed.");
    expect(e.stepStatuses.weather).toBe("warning");
    expect(e.told.departure.values.takeoffGroundRoll.status).toBe("computed");
    expect(e.told.departure.values.runwayRemainingGroundRoll.status).toBe("withheld");
  });

  it("evaluates an empty worksheet without notifications", () => {
    const e = evaluateWorksheet(emptyState(), EMPTY_SESSION);
    expect(e.notifications).toEqual([]);
    expect(e.stepStatuses).toMatchObject({ sortie: "active", weather: "pending", decision: "pending" });
  });
});

describe("evaluateWorksheet — weather status (#285)", () => {
  const fetchFor = (state: WorksheetData): WeatherFetchResult => ({
    fetchedFor: {
      airport: [state.airport[0], state.airport[1]],
      date: state.date,
      time: state.time,
      duration: state.duration,
      position: state.position,
    },
    applied: { temp: state.temp, altimeter: state.altimeter },
    notifications: [],
  });

  it("is none for an empty worksheet, leaving the weather step pending", () => {
    expect(evaluateWorksheet(emptyState(), EMPTY_SESSION).weatherStatus).toBe("none");
  });

  it("drives the action bar: ready before weather once it can be fetched, fetched with weather", () => {
    const ready = { ...emptyState(), airport: ["KABC", "KXYZ"] as [string, string] };
    expect(evaluateWorksheet(emptyState(), EMPTY_SESSION).actionBar).toBe("incomplete");
    expect(evaluateWorksheet(ready, EMPTY_SESSION).actionBar).toBe("ready");
    expect(evaluateWorksheet({ ...ready, cielVis: true }, EMPTY_SESSION).actionBar).toBe("ready");
    expect(evaluateWorksheet(sortie(), EMPTY_SESSION).actionBar).toBe("fetched");
  });

  it("is unverified for weather values not fetched this session, with the Caution and a complete weather step", () => {
    const e = evaluateWorksheet(sortie(), EMPTY_SESSION);
    expect(e.weatherStatus).toBe("unverified");
    expect(e.stepStatuses.weather).toBe("complete");
    expect(e.notifications.filter((n) => /came from a shared link/.test(n.message))).toHaveLength(1);
  });

  it("is stale once a fetch input changes, without an Unverified weather Caution", () => {
    const fetchedState = sortie();
    const fetch = fetchFor(fetchedState);
    const session = fetchedSession({ lastFetch: fetch, lastApplied: fetch });
    expect(evaluateWorksheet(fetchedState, session).weatherStatus).toBe("fetched");
    const e = evaluateWorksheet({ ...fetchedState, time: "12:00" }, session);
    expect(e.weatherStatus).toBe("stale");
    expect(e.notifications.some((n) => /came from a shared link/.test(n.message))).toBe(false);
    expect(e.stepStatuses.weather).toBe("warning");
  });
});
