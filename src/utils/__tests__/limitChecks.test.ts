import {
  climbSubject,
  computeClimbViewModel,
  computePressureColumns,
  computeTOLDViewModel,
  derivePerformanceNotifications,
  toldSubject,
  type AirportSlot,
  type ComputedValue,
  type TOLDValueKey,
} from "../derived";
import {
  deriveLimitChecks,
  limitCheckDetail,
  limitCheckSummary,
  bySeverity,
  worstState,
  windSpeedStates,
  pointStates,
  type LimitCheck,
} from "../limitChecks";
import {
  fieldSubject,
  stepSubject,
  type Notification,
  type WeatherFetchResult,
} from "../notifications";
import type { WorksheetData } from "../types";
import { unverifiedWeatherNotifications } from "../unverifiedWeather";
import { staleFetchNotifications } from "../weatherSession";

const baseState = (): WorksheetData => ({
  pilot: "",
  date: "2026-01-01",
  time: "10:00",
  duration: null,
  acType: "C182T", // max gross 3,100 lbs, empty 2,300 lbs
  tailN: "",
  airport: ["KABC", "KXYZ"],
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
  temp: [20, 10, 20],
  altimeter: [29.92, 29.92, 29.92],
  altitude: [1000, 8000, 1000],
  rwy: [3000, 3000],
  weight: 2700,
  mtnEndorse: false,
  mtnCert: false,
});

/**
 * The checks for `state`, with the notifications AppContainer would derive
 * for it (performance notifications plus any `extra`).
 */
function checksFor(state: WorksheetData, extra: Notification[] = []): LimitCheck[] {
  const notifications = [...derivePerformanceNotifications(state), ...extra];
  const { PAs } = computePressureColumns(state.altitude, state.altimeter, state.temp);
  return deriveLimitChecks({
    state,
    notifications,
    climb: computeClimbViewModel(state, notifications),
    told: computeTOLDViewModel(state, PAs, notifications),
  });
}

const weightCheck = (state: WorksheetData, extra: Notification[] = []) => {
  const check = checksFor(state, extra).find((c) => c.id === "weight");
  if (!check) throw new Error("no weight check");
  return check;
};

describe("worstState", () => {
  it("orders Exceeded > Not checked > Near limit > Within limit", () => {
    expect(worstState(["within", "near"])).toBe("near");
    expect(worstState(["near", "not-checked", "within"])).toBe("not-checked");
    expect(worstState(["not-checked", "exceeded"])).toBe("exceeded");
    expect(worstState(["within"])).toBe("within");
  });

  it("is Within limit with no points", () => {
    expect(worstState([])).toBe("within");
  });
});

describe("Weight limit check", () => {
  it("describes the worksheet limit and belongs to Sortie Details", () => {
    const check = weightCheck(baseState());
    expect(check).toMatchObject({
      id: "weight",
      name: "Weight",
      limit: "under 90% of maximum gross weight",
      caveat: null,
      step: "sortie",
    });
  });

  it("is Within limit at 89.9% of maximum gross", () => {
    const check = weightCheck({ ...baseState(), weight: 2787 }); // 89.90%
    expect(check.state).toBe("within");
    expect(check.points).toEqual([
      {
        label: "Weight",
        state: "within",
        value: "2,787 / 3,100 lbs (89.9%)",
        substitutions: [],
      },
    ]);
  });

  it("is Exceeded at exactly 90.0% of maximum gross", () => {
    const check = weightCheck({ ...baseState(), weight: 2790 });
    expect(check.state).toBe("exceeded");
    expect(check.points[0]).toMatchObject({
      state: "exceeded",
      value: "2,790 / 3,100 lbs (90%)",
    });
  });

  it("never rounds a percentage just under 90% up to 90%", () => {
    const check = weightCheck({ ...baseState(), weight: 2789 }); // 89.97%
    expect(check.state).toBe("within");
    expect(check.points[0].value).toBe("2,789 / 3,100 lbs (89.9%)");
  });

  it("is still Exceeded above maximum gross despite the over-max-gross Warning", () => {
    const state = { ...baseState(), weight: 3255 }; // 105%
    expect(derivePerformanceNotifications(state)).toContainEqual(
      expect.objectContaining({ level: "warning", subject: fieldSubject("weight") }),
    );
    const check = weightCheck(state);
    expect(check.state).toBe("exceeded");
    expect(check.points[0]).toMatchObject({
      state: "exceeded",
      value: "3,255 / 3,100 lbs (105%)",
    });
  });

  it("is Not checked when the weight is blank, naming it", () => {
    const check = weightCheck({ ...baseState(), weight: null });
    expect(check.state).toBe("not-checked");
    expect(check.points).toEqual([
      { label: "Weight", state: "not-checked", waitingFor: "needs weight", substitutions: [] },
    ]);
  });

  it("is Not checked when the aircraft is blank, naming it", () => {
    const check = weightCheck({ ...baseState(), acType: "" });
    expect(check.state).toBe("not-checked");
    expect(check.points[0].waitingFor).toBe("needs aircraft type");
  });

  it("names both when the aircraft and weight are blank", () => {
    const check = weightCheck({ ...baseState(), acType: "", weight: null });
    expect(check.points[0].waitingFor).toBe("needs aircraft type and weight");
  });

  it("is Not checked for an aircraft without POH data", () => {
    const check = weightCheck({ ...baseState(), acType: "XYZ" });
    expect(check.state).toBe("not-checked");
    expect(check.points[0].waitingFor).toBe("needs a supported aircraft type");
  });

  it("is Not checked when the weight is below empty weight (withheld)", () => {
    const check = weightCheck({ ...baseState(), weight: 2000 });
    expect(check.state).toBe("not-checked");
    expect(check.points[0].waitingFor).toBe("needs valid weight");
  });

  it("is Not checked when another Warning makes the weight untrusted", () => {
    const linkWarning: Notification = {
      level: "warning",
      subject: fieldSubject("weight"),
      message: "The shared link's weight could not be read.",
    };
    expect(weightCheck({ ...baseState(), weight: 2900 }, [linkWarning]).state).toBe("not-checked");
    // Above max gross the extra Warning still makes it untrusted.
    const over = weightCheck({ ...baseState(), weight: 3255 }, [linkWarning]);
    expect(over.state).toBe("not-checked");
    expect(over.points[0].waitingFor).toBe("needs weight checked (Warning)");
  });

  it("carries the Caution of a substituted input as a marker and still evaluates", () => {
    const caution: Notification = {
      level: "caution",
      subject: fieldSubject("weight"),
      message: "Weight came from a shared link.",
    };
    const check = weightCheck({ ...baseState(), weight: 2900 }, [caution]);
    expect(check.state).toBe("exceeded");
    expect(check.points[0].substitutions).toEqual([caution]);
  });

  it("no longer raises an Advisory near maximum gross weight", () => {
    const notifications = derivePerformanceNotifications({ ...baseState(), weight: 3000 });
    expect(notifications.filter((n) => n.level === "advisory")).toEqual([]);
  });
});

const ceilVisCheck = (state: WorksheetData, extra: Notification[] = []) => {
  const check = checksFor(state, extra).find((c) => c.id === "ceilVis");
  if (!check) throw new Error("no ceiling/visibility check");
  return check;
};

describe("Ceiling/visibility limit check", () => {
  it("describes the worksheet limit, its caveat, and belongs to Weather", () => {
    expect(ceilVisCheck(baseState())).toMatchObject({
      id: "ceilVis",
      name: "Ceiling/visibility",
      limit: "ceilings and visibility much better than marginal VFR",
      caveat: "Reflects the Ceil/Vis box only (IFR G-AIRMET). Marginal VFR is not checked.",
      step: "weather",
    });
  });

  it("is Exceeded when the Ceil/Vis box is ticked", () => {
    const check = ceilVisCheck({ ...baseState(), cielVis: true });
    expect(check.state).toBe("exceeded");
    expect(check.points).toEqual([
      { label: "Ceil/Vis box", state: "exceeded", value: "Ticked", substitutions: [] },
    ]);
  });

  it("is Within limit when the Ceil/Vis box is unticked, even without a fetch", () => {
    const check = ceilVisCheck({ ...baseState(), cielVis: false });
    expect(check.state).toBe("within");
    expect(check.points).toEqual([
      { label: "Ceil/Vis box", state: "within", value: "Unticked", substitutions: [] },
    ]);
  });

  it("carries the Unverified weather Caution from a shared link as a marker", () => {
    const state = { ...baseState(), cielVis: true };
    const unverified = unverifiedWeatherNotifications(state, "unverified");
    expect(unverified).toHaveLength(1);
    const check = ceilVisCheck(state, unverified);
    expect(check.state).toBe("exceeded");
    expect(check.points[0].substitutions).toEqual(unverified);
  });

  it("carries a Caution on the Ceil/Vis box as a marker", () => {
    const caution: Notification = {
      level: "caution",
      subject: fieldSubject("cielVis"),
      message: "Ceil/Vis came from somewhere else.",
    };
    const check = ceilVisCheck({ ...baseState(), cielVis: false }, [caution]);
    expect(check.state).toBe("within");
    expect(check.points[0].substitutions).toEqual([caution]);
  });

  it("doesn't mark the box with other weather-step Cautions", () => {
    const gairmetFailed: Notification = {
      level: "caution",
      subject: { kind: "step", step: "weather" },
      message: "G-AIRMETs unavailable. Check AIRMETs manually.",
    };
    expect(ceilVisCheck(baseState(), [gairmetFailed]).points[0].substitutions).toEqual([]);
  });

  it("counts in the action-bar summary", () => {
    const checks = checksFor({ ...baseState(), weight: 2700, cielVis: true });
    // Weight, Rate of climb and Runway within limit; Winds aloft Not checked (no speeds).
    expect(limitCheckSummary(checks)).toBe(
      "1 of 5 worksheet limits exceeded · 1 not checked · 3 within limit",
    );
  });

  describe("after the time changes following a fetch", () => {
    const fetchFor = (state: WorksheetData): WeatherFetchResult => ({
      fetchedFor: {
        airport: ["KABC", "KXYZ"],
        date: state.date,
        time: "08:00",
        duration: state.duration,
        position: state.position,
      },
      applied: { cielVis: state.cielVis },
      notifications: [],
    });

    it("is Not checked when unticked, naming the Warning", () => {
      const state = { ...baseState(), cielVis: false };
      const stale = staleFetchNotifications(state, fetchFor(state));
      expect(stale).toContainEqual(
        expect.objectContaining({ level: "warning", subject: fieldSubject("cielVis") }),
      );
      const check = ceilVisCheck(state, stale);
      expect(check.state).toBe("not-checked");
      expect(check.points).toEqual([
        {
          label: "Ceil/Vis box",
          state: "not-checked",
          waitingFor: "needs Ceil/Vis checked (Warning)",
          substitutions: [],
        },
      ]);
    });

    it("is still Exceeded when ticked", () => {
      const state = { ...baseState(), cielVis: true };
      const check = ceilVisCheck(state, staleFetchNotifications(state, fetchFor(state)));
      expect(check.state).toBe("exceeded");
    });
  });
});

/**
 * The checks with chosen values substituted into the derived view models, so
 * boundaries can be tested without hunting for POH conditions that land on them.
 */
function checksWith(
  state: WorksheetData,
  overrides: {
    roc?: [ComputedValue, ComputedValue, ComputedValue];
    runway?: Partial<Record<AirportSlot, Partial<Record<TOLDValueKey, ComputedValue>>>>;
  },
  extra: Notification[] = [],
): LimitCheck[] {
  const notifications = [...derivePerformanceNotifications(state), ...extra];
  const { PAs } = computePressureColumns(state.altitude, state.altimeter, state.temp);
  const climb = computeClimbViewModel(state, notifications);
  const told = computeTOLDViewModel(state, PAs, notifications);
  const airport = (slot: AirportSlot) => ({
    ...told[slot],
    values: { ...told[slot].values, ...overrides.runway?.[slot] },
  });
  return deriveLimitChecks({
    state,
    notifications,
    climb: overrides.roc ? { ...climb, rateOfClimbActual: overrides.roc } : climb,
    told: { ...told, departure: airport("departure"), arrival: airport("arrival") },
  });
}

const byId = (checks: LimitCheck[], id: LimitCheck["id"]) => {
  const found = checks.find((c) => c.id === id);
  if (!found) throw new Error(`no ${id} check`);
  return found;
};

const fpm = (value: number): ComputedValue => ({ status: "computed", value, dependsOn: [] });
const ft = fpm;

describe("Rate of climb limit check", () => {
  const climbCheck = (
    roc?: [ComputedValue, ComputedValue, ComputedValue],
    state = baseState(),
    extra: Notification[] = [],
  ) => byId(checksWith(state, { roc }, extra), "climb");

  it("describes the worksheet limit and belongs to Decision", () => {
    expect(climbCheck()).toMatchObject({
      id: "climb",
      name: "Rate of climb",
      limit: "over 300 fpm all along the route",
      caveat: null,
      step: "decision",
    });
  });

  it("is Within limit at 301 fpm and Exceeded at 300 fpm", () => {
    const check = climbCheck([fpm(900), fpm(301), fpm(300)]);
    expect(check.state).toBe("exceeded");
    expect(check.points).toEqual([
      { label: "Departure (KABC)", state: "within", value: "900 fpm", substitutions: [] },
      { label: "Operating altitude", state: "within", value: "301 fpm", substitutions: [] },
      { label: "Arrival (KXYZ)", state: "exceeded", value: "300 fpm", substitutions: [] },
    ]);
    expect(climbCheck([fpm(301), fpm(1200), fpm(301)]).state).toBe("within");
  });

  it("is Not checked at a withheld column, naming what it needs", () => {
    const check = climbCheck(undefined, { ...baseState(), temp: [20, null, 20] });
    expect(check.state).toBe("not-checked");
    expect(check.points[1]).toEqual({
      label: "Operating altitude",
      state: "not-checked",
      waitingFor: "needs operating temperature",
      substitutions: [],
    });
    expect(check.points[0].state).toBe("within");
  });

  it("is Exceeded when one column is Exceeded and another Not checked", () => {
    const check = climbCheck([
      fpm(250),
      { status: "withheld", reason: "needs operating temperature" },
      fpm(800),
    ]);
    expect(check.state).toBe("exceeded");
    expect(check.points.map((p) => p.state)).toEqual(["exceeded", "not-checked", "within"]);
  });

  it("is Not checked above maximum gross weight, saying why", () => {
    const check = climbCheck(undefined, { ...baseState(), weight: 3255 });
    expect(check.state).toBe("not-checked");
    expect(check.points.map((p) => p.waitingFor)).toEqual([
      "needs weight at or below maximum gross",
      "needs weight at or below maximum gross",
      "needs weight at or below maximum gross",
    ]);
  });

  it("is Not checked when an input holds a Warning (e.g. changed after the fetch)", () => {
    const stale: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 2),
      message: "Arrival temperature changed after the weather fetch.",
    };
    const check = climbCheck(undefined, baseState(), [stale]);
    expect(check.state).toBe("not-checked");
    expect(check.points[2]).toMatchObject({
      state: "not-checked",
      waitingFor: "needs arrival temperature checked (Warning)",
    });
  });

  it("is Not checked where the POH has no data", () => {
    const check = climbCheck([fpm(900), { status: "unavailable" }, fpm(900)]);
    expect(check.state).toBe("not-checked");
    expect(check.points[1]).toMatchObject({
      state: "not-checked",
      waitingFor: "needs POH climb data for these conditions",
    });
  });

  it("carries a substituted input's Caution and an extrapolated POH value's Caution, and still evaluates", () => {
    const tempCaution: Notification = {
      level: "caution",
      subject: fieldSubject("temp", 1),
      message: "Operating temperature is from the nearest forecast.",
    };
    const extrapolated: Notification = {
      level: "caution",
      subject: climbSubject("rateOfClimb", 1),
      message: "Operating altitude rate of climb is extrapolated beyond the POH climb table.",
    };
    const check = climbCheck(undefined, baseState(), [tempCaution, extrapolated]);
    expect(check.points[1].state).not.toBe("not-checked");
    expect(check.points[1].substitutions).toEqual([tempCaution, extrapolated]);
    expect(check.points[0].substitutions).toEqual([]);
  });

  it("carries the Unverified weather Caution for values from a shared link", () => {
    const unverified = unverifiedWeatherNotifications(baseState(), "unverified");
    expect(unverified).toHaveLength(1);
    const check = climbCheck(undefined, baseState(), unverified);
    expect(check.state).not.toBe("not-checked");
    for (const p of check.points) expect(p.substitutions).toEqual(unverified);
  });

  it("is Not checked when the inputs are blank", () => {
    const check = climbCheck(undefined, { ...baseState(), acType: "" });
    expect(check.state).toBe("not-checked");
    expect(check.points[0].waitingFor).toBe("needs aircraft type");
  });
});

describe("Runway limit check", () => {
  const runwayCheck = (
    runway?: Partial<Record<AirportSlot, Partial<Record<TOLDValueKey, ComputedValue>>>>,
    state = baseState(),
    extra: Notification[] = [],
  ) => byId(checksWith(state, { runway }, extra), "runway");
  const remaining = (departure: ComputedValue, arrival: ComputedValue) => ({
    departure: { runwayRemainingGroundRoll: departure },
    arrival: { runwayRemainingGroundRoll: arrival },
  });

  it("describes the worksheet limit and belongs to Decision", () => {
    expect(runwayCheck()).toMatchObject({
      id: "runway",
      name: "Runway",
      limit: "takeoff ground roll + landing ground roll less than runway length",
      caveat: null,
      step: "decision",
    });
  });

  it("is Within limit with 1 ft remaining and Exceeded with 0 ft", () => {
    const check = runwayCheck(remaining(ft(1), ft(0)));
    expect(check.state).toBe("exceeded");
    expect(check.points).toEqual([
      { label: "Departure (KABC)", state: "within", value: "1 ft remaining", substitutions: [] },
      { label: "Arrival (KXYZ)", state: "exceeded", value: "0 ft remaining", substitutions: [] },
    ]);
    expect(runwayCheck(remaining(ft(1), ft(1))).state).toBe("within");
    expect(runwayCheck(remaining(ft(-450), ft(1))).points[0]).toMatchObject({
      state: "exceeded",
      value: "-450 ft remaining",
    });
  });

  it("doesn't check the over-50-ft-obstacle values", () => {
    const check = runwayCheck({
      departure: { runwayRemainingGroundRoll: ft(500), runwayRemaining50ft: ft(-200) },
      arrival: { runwayRemainingGroundRoll: ft(500), runwayRemaining50ft: ft(-200) },
    });
    expect(check.state).toBe("within");
  });

  it("is Not checked when a runway length is blank, naming it", () => {
    const check = runwayCheck(undefined, { ...baseState(), rwy: [3000, null] });
    expect(check.state).toBe("not-checked");
    expect(check.points[1]).toEqual({
      label: "Arrival (KXYZ)",
      state: "not-checked",
      waitingFor: "needs arrival runway length",
      substitutions: [],
    });
  });

  it("is Not checked above maximum gross weight, saying why", () => {
    const check = runwayCheck(undefined, { ...baseState(), weight: 3255 });
    expect(check.state).toBe("not-checked");
    expect(check.points.map((p) => p.waitingFor)).toEqual([
      "needs weight at or below maximum gross",
      "needs weight at or below maximum gross",
    ]);
  });

  it("is Not checked when an input holds a Warning (e.g. changed after the fetch)", () => {
    const stale: Notification = {
      level: "warning",
      subject: fieldSubject("altimeter", 0),
      message: "Departure altimeter changed after the weather fetch.",
    };
    const check = runwayCheck(undefined, baseState(), [stale]);
    expect(check.state).toBe("not-checked");
    expect(check.points[0]).toMatchObject({
      state: "not-checked",
      waitingFor: "needs departure altimeter checked (Warning)",
    });
    expect(check.points[1].state).toBe("within");
  });

  it("is Not checked where the POH has no data", () => {
    const check = runwayCheck(remaining({ status: "unavailable" }, ft(900)));
    expect(check.points[0]).toMatchObject({
      state: "not-checked",
      waitingFor: "needs POH takeoff and landing data for these conditions",
    });
  });

  it("is Exceeded at one airport even when the other is Not checked", () => {
    const check = runwayCheck(
      remaining(ft(-10), { status: "withheld", reason: "needs arrival runway length" }),
    );
    expect(check.state).toBe("exceeded");
  });

  it("carries the Unverified weather Caution for values from a shared link", () => {
    const unverified = unverifiedWeatherNotifications(baseState(), "unverified");
    const check = runwayCheck(undefined, baseState(), unverified);
    expect(check.state).not.toBe("not-checked");
    for (const p of check.points) expect(p.substitutions).toEqual(unverified);
  });

  it("doesn't carry other weather-step Cautions", () => {
    const gairmetFailed: Notification = {
      level: "caution",
      subject: { kind: "step", step: "weather" },
      message: "G-AIRMETs unavailable. Check AIRMETs manually.",
    };
    expect(runwayCheck(undefined, baseState(), [gairmetFailed]).points[0].substitutions).toEqual(
      [],
    );
    expect(
      byId(checksWith(baseState(), {}, [gairmetFailed]), "climb").points[0].substitutions,
    ).toEqual([]);
  });

  it("carries the runway's and the POH's Cautions, and still evaluates", () => {
    const rwyCaution: Notification = {
      level: "caution",
      subject: fieldSubject("rwy", 0),
      message: "Departure runway length is from the airport database.",
    };
    const averaged: Notification = {
      level: "caution",
      subject: toldSubject("departure", "landing"),
      message: "Departure landing distances fill 1 blank POH table entry.",
    };
    const check = runwayCheck(undefined, baseState(), [rwyCaution, averaged]);
    expect(check.points[0].state).not.toBe("not-checked");
    expect(check.points[0].substitutions).toEqual([rwyCaution, averaged]);
    expect(check.points[1].substitutions).toEqual([]);
  });
});

const check = (id: string, state: LimitCheck["state"]): LimitCheck => ({
  id: id as LimitCheck["id"],
  name: id,
  limit: "",
  caveat: null,
  step: "sortie",
  state,
  points: [],
});

const windsCheck = (state: WorksheetData, extra: Notification[] = []) => {
  const check = checksFor(state, extra).find((c) => c.id === "winds");
  if (!check) throw new Error("no winds check");
  return check;
};

/** `state` with the winds-aloft speeds (kt) set per column; null leaves a column blank. */
const withSpeeds = (speeds: (number | null)[], state = baseState()): WorksheetData => ({
  ...state,
  wind: [
    speeds.map((v) => (v === null ? null : 270)),
    speeds,
    speeds.map((v) => (v === null ? null : -5)),
  ],
});

describe("Winds aloft limit check", () => {
  it.each([
    [19, "within"],
    [20, "near"],
    [29, "near"],
    [30, "exceeded"],
  ] as const)("is %s kt → %s", (speed, state) => {
    const check = windsCheck(withSpeeds([speed, null, null, null, null]));
    expect(check.state).toBe(state);
    expect(check.points).toEqual([
      expect.objectContaining({ label: "3,000'", state, value: `${speed} kt`, index: 0 }),
    ]);
  });

  it("describes the worksheet limit, the fixed caveat, and belongs to Weather", () => {
    const check = windsCheck(baseState());
    expect(check).toMatchObject({
      name: "Winds aloft",
      step: "weather",
      caveat: "Surface wind and gusts are not checked.",
    });
    expect(check.limit).toMatch(/30 kt/);
  });

  it("skips blank columns and lists only the altitudes it checked", () => {
    const check = windsCheck(withSpeeds([10, null, 15, null, 5]));
    expect(check.state).toBe("within");
    expect(check.points.map((p) => p.label)).toEqual(["3,000'", "9,000'", "15,000'"]);
  });

  it("is Not checked when every column is blank, saying what it needs", () => {
    const check = windsCheck(baseState());
    expect(check.state).toBe("not-checked");
    expect(check.points).toEqual([
      expect.objectContaining({ state: "not-checked", waitingFor: "needs winds-aloft speeds" }),
    ]);
  });

  it("counts a 0 kt speed as a checked value", () => {
    const check = windsCheck(withSpeeds([0, null, null, null, null]));
    expect(check.state).toBe("within");
    expect(check.points).toEqual([
      expect.objectContaining({ label: "3,000'", state: "within", value: "0 kt" }),
    ]);
  });

  const columnWarning = (
    col: number,
    message = "Fetched for KABC at 2026-01-01 10:00; refetch weather.",
  ): Notification => ({
    level: "warning",
    subject: fieldSubject("wind", col),
    message,
  });

  it("is Not checked when a column holds a Warning, even when the other columns pass", () => {
    const check = windsCheck(withSpeeds([10, 12, 15, null, null]), [columnWarning(1)]);
    expect(check.state).toBe("not-checked");
    expect(check.points).toEqual([
      expect.objectContaining({ label: "3,000'", state: "within", value: "10 kt" }),
      expect.objectContaining({
        label: "6,000'",
        state: "not-checked",
        waitingFor: "needs speed checked (Warning)",
        index: 1,
      }),
      expect.objectContaining({ label: "9,000'", state: "within", value: "15 kt" }),
    ]);
    expect(check.points[1].value).toBeUndefined();
  });

  it("does not skip a blank column that holds a Warning", () => {
    const check = windsCheck(withSpeeds([10, null, null, null, null]), [
      columnWarning(3, "Winds aloft at 12,000' couldn't be fetched; enter them manually."),
    ]);
    expect(check.state).toBe("not-checked");
    expect(check.points).toEqual([
      expect.objectContaining({ label: "3,000'", state: "within" }),
      expect.objectContaining({
        label: "12,000'",
        state: "not-checked",
        waitingFor: "needs speed (Warning)",
      }),
    ]);
  });

  it("treats a Warning on the whole winds table as a Warning on every column", () => {
    const check = windsCheck(withSpeeds([10, 40, null, null, null]), [
      {
        level: "warning",
        subject: fieldSubject("wind"),
        message: "The link's winds aloft table is malformed.",
      },
    ]);
    expect(check.state).toBe("not-checked");
    expect(check.points.every((p) => p.state === "not-checked")).toBe(true);
    expect(check.points).toHaveLength(5);
  });

  it("is Exceeded at one column even when another is Not checked", () => {
    const check = windsCheck(withSpeeds([35, 12, null, null, null]), [columnWarning(1)]);
    expect(check.state).toBe("exceeded");
    expect(check.points.map((p) => p.state)).toEqual(["exceeded", "not-checked"]);
  });

  it("ignores Cautions when deciding whether a column is checked", () => {
    const check = windsCheck(withSpeeds([22, null, null, null, null]), [
      { level: "caution", subject: fieldSubject("wind", 0), message: "Forecast time snapped." },
    ]);
    expect(check.state).toBe("near");
  });

  it("evaluates a substituted column normally and carries its Caution as a marker", () => {
    const snapped: Notification = {
      level: "caution",
      subject: fieldSubject("wind", 2),
      message: "Operating area forecast time snapped to 2026-01-01T11:00Z",
    };
    const check = windsCheck(withSpeeds([10, null, 31, null, null]), [snapped]);
    expect(check.state).toBe("exceeded");
    expect(check.points[0].substitutions).toEqual([]);
    expect(check.points[1]).toMatchObject({ state: "exceeded", substitutions: [snapped] });
  });

  it("marks every checked column with Unverified weather, but not with other weather-step Cautions", () => {
    const state = withSpeeds([10, 25, null, null, null]);
    const unverified = unverifiedWeatherNotifications(state, "unverified");
    expect(unverified).toHaveLength(1);
    const gairmet: Notification = {
      level: "caution",
      subject: stepSubject("weather"),
      message: "G-AIRMET unavailable. Check AIRMETs manually.",
    };
    const check = windsCheck(state, [...unverified, gairmet]);
    expect(check.state).toBe("near");
    expect(check.points.map((p) => p.substitutions)).toEqual([unverified, unverified]);
  });

  it("cites the ridge-level guidance only when a column is Near limit", () => {
    expect(windsCheck(withSpeeds([10, null, null, null, null])).note).toBeUndefined();
    expect(windsCheck(withSpeeds([35, null, null, null, null])).note).toBeUndefined();
    const note = windsCheck(withSpeeds([10, 20, 35, null, null])).note;
    expect(note).toMatch(/20 kt/);
    expect(note).toMatch(/ridge/);
    expect(note).toMatch(/doesn't know ridge height/);
  });

  it("gives each column's state for the winds table, undefined where it wasn't checked", () => {
    const checks = checksFor(withSpeeds([10, null, 22, 31, null]), [
      { level: "warning", subject: fieldSubject("wind", 4), message: "Stale; refetch weather." },
    ]);
    expect(windSpeedStates(checks)).toEqual([
      "within",
      undefined,
      "near",
      "exceeded",
      "not-checked",
    ]);
  });
});

describe("pointStates", () => {
  it("gives each point's state in order, and nothing for a missing check", () => {
    const checks = checksFor({ ...baseState(), rwy: [3000, 600] });
    expect(pointStates(checks, "runway")).toEqual(["within", "exceeded"]);
    expect(pointStates([], "runway")).toEqual([]);
  });
});

describe("limitCheckSummary", () => {
  it("counts each state and omits parts with a count of zero", () => {
    const checks = [
      check("a", "exceeded"),
      check("b", "within"),
      check("c", "not-checked"),
      check("d", "exceeded"),
      check("e", "within"),
    ];
    expect(limitCheckSummary(checks)).toBe(
      "2 of 5 worksheet limits exceeded · 1 not checked · 2 within limit",
    );
  });

  it("leaves out the exceeded part when nothing is exceeded", () => {
    expect(limitCheckSummary([check("a", "near"), check("b", "within")])).toBe(
      "1 near limit · 1 within limit",
    );
  });

  it("uses the singular for one worksheet limit", () => {
    expect(limitCheckSummary([check("a", "exceeded")])).toBe("1 of 1 worksheet limit exceeded");
  });
});

describe("bySeverity", () => {
  it("orders checks worst first, keeping the original order within a state", () => {
    const checks = [
      check("a", "within"),
      check("b", "not-checked"),
      check("c", "exceeded"),
      check("d", "near"),
      check("e", "exceeded"),
    ];
    expect(bySeverity(checks).map((c) => c.id)).toEqual(["c", "e", "b", "d", "a"]);
  });
});

describe("limitCheckDetail", () => {
  const pt = (label: string, state: LimitCheck["state"], text: string) =>
    state === "not-checked"
      ? { label, state, waitingFor: text, substitutions: [] }
      : { label, state, value: text, substitutions: [] };
  const winds = (points: ReturnType<typeof pt>[]): LimitCheck => ({
    id: "winds",
    name: "Winds aloft",
    limit: "under 30 kt at every altitude",
    caveat: null,
    step: "weather",
    state: worstState(points.map((p) => p.state)),
    points,
  });

  it("gives just the value when the only point is the check itself", () => {
    const check = weightCheck({ ...baseState(), weight: 2790 });
    expect(limitCheckDetail(check)).toBe("2,790 / 3,100 lbs (90%)");
  });

  it("gives what a Not checked check is waiting for", () => {
    const check = weightCheck({ ...baseState(), weight: null });
    expect(limitCheckDetail(check)).toBe("needs weight");
  });

  it("names every point that fails, with its label", () => {
    const check = winds([
      pt("3,000'", "within", "12 kt"),
      pt("9,000'", "exceeded", "35 kt"),
      pt("12,000'", "exceeded", "40 kt"),
    ]);
    expect(limitCheckDetail(check)).toBe("9,000' 35 kt · 12,000' 40 kt");
  });

  it("names what each Not checked point is waiting for", () => {
    const check = winds([
      pt("3,000'", "within", "12 kt"),
      pt("15,000'", "not-checked", "needs wind"),
    ]);
    expect(limitCheckDetail(check)).toBe("15,000' needs wind");
  });

  it("gives the first point when every point is within limit", () => {
    const check = winds([pt("3,000'", "within", "12 kt"), pt("6,000'", "within", "18 kt")]);
    expect(limitCheckDetail(check)).toBe("3,000' 12 kt");
  });
});
