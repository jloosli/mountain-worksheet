/**
 * Limit checks: the Mountain Flight Worksheet's own limits, checked against
 * the worksheet's values. See GLOSSARY.md (Limit checks) and
 * docs/adr/0002-limit-checks-separate-from-notifications.md.
 *
 * A Limit check is not a notification: it never withholds a value, and it
 * doesn't count on step badges or change step status. Results are derived
 * during render from state, the derived view models and the notifications in
 * force, so they change exactly when their inputs do.
 */
import { TARGET_ALTITUDES_FT } from "./areaOfOpsWeather";
import {
  airportLabel,
  assessWeight,
  climbSubject,
  COLUMNS,
  columnLabel,
  findAircraft,
  toldValueSubjects,
  type AirportSlot,
  type ClimbViewModel,
  type ComputedValue,
  type TOLDViewModel,
} from "./derived";
import {
  fieldSubject,
  notificationKey,
  subjectKey,
  type Notification,
  type StepId,
  type Subject,
} from "./notifications";
import { substitutionsFor } from "./provenance";
import type { WorksheetData } from "./types";

export type LimitState = "exceeded" | "not-checked" | "near" | "within";

/** Worst first: the state a check takes is the first one among its points. */
export const LIMIT_STATE_ORDER: readonly LimitState[] = [
  "exceeded",
  "not-checked",
  "near",
  "within",
];

/** The glossary names of the states. */
export const LIMIT_STATE_LABEL: Record<LimitState, string> = {
  exceeded: "Exceeded",
  "not-checked": "Not checked",
  near: "Near limit",
  within: "Within limit",
};

export type LimitCheckId = "weight" | "winds" | "ceilVis" | "climb" | "runway";

/** One value a check compares against its limit (an altitude or an airport). */
export interface LimitPoint {
  label: string;
  state: LimitState;
  /** The value as checked, e.g. "2,790 / 3,100 lbs (90%)". Absent when Not checked. */
  value?: string;
  /** What a Not checked point is waiting for, e.g. "needs weight". */
  waitingFor?: string;
  /**
   * Cautions on the inputs this value rests on (substitution markers),
   * including the Unverified weather Caution for values from a shared link.
   */
  substitutions: Notification[];
  /** The column or airport slot this point is about, for styling its table cell. */
  index?: number;
}

export interface LimitCheck {
  id: LimitCheckId;
  name: string;
  /** The worksheet's limit, short: "under 90% of maximum gross weight". */
  limit: string;
  /** A fixed caveat on what the check doesn't cover, or null. */
  caveat: string | null;
  /** Guidance behind the check's current state, e.g. why Near limit starts where it does. */
  note?: string;
  /** The step whose callout shows this check. */
  step: StepId;
  state: LimitState;
  points: LimitPoint[];
}

export interface LimitCheckInputs {
  state: WorksheetData;
  /** All notifications in force. */
  notifications: readonly Notification[];
  climb: ClimbViewModel;
  told: TOLDViewModel;
}

const rank = (s: LimitState) => LIMIT_STATE_ORDER.indexOf(s);

/** The worst of `states` (Within limit when there are none). */
export function worstState(states: readonly LimitState[]): LimitState {
  return states.reduce<LimitState>((worst, s) => (rank(s) < rank(worst) ? s : worst), "within");
}

/** `checks` worst first; checks in the same state keep their order. */
export function bySeverity(checks: readonly LimitCheck[]): LimitCheck[] {
  return [...checks].sort((a, b) => rank(a.state) - rank(b.state));
}

/**
 * The action-bar summary sentence, e.g. "2 of 5 worksheet limits exceeded ·
 * 1 not checked · 2 within limit". Parts with a count of zero are left out.
 * It states no overall result.
 */
export function limitCheckSummary(checks: readonly LimitCheck[]): string {
  const count = (s: LimitState) => checks.filter((c) => c.state === s).length;
  const parts: string[] = [];
  const exceeded = count("exceeded");
  if (exceeded > 0) {
    const noun = checks.length === 1 ? "worksheet limit" : "worksheet limits";
    parts.push(`${exceeded} of ${checks.length} ${noun} exceeded`);
  }
  for (const s of ["not-checked", "near", "within"] as const) {
    const n = count(s);
    if (n > 0) parts.push(`${n} ${LIMIT_STATE_LABEL[s].toLowerCase()}`);
  }
  return parts.join(" · ");
}

/**
 * A check's worst point or what it's waiting for, in one line: every point
 * in the check's own state (the ones that fail, or the ones it's waiting
 * on), or the first point when all are Within limit. A point's label is left
 * off when it is just the check's name.
 */
export function limitCheckDetail(check: LimitCheck): string {
  const worst = check.points.filter((p) => p.state === check.state);
  const shown = check.state === "within" ? worst.slice(0, 1) : worst;
  return shown
    .map((p) => {
      const text = p.value ?? p.waitingFor ?? "";
      return p.label === check.name ? text : `${p.label} ${text}`;
    })
    .join(" · ");
}

/** The DOM id of a check's callout, for jumping to it. */
export const limitCheckDomId = (id: LimitCheckId) => `limit-check-${id}`;

/** Every Limit check that exists so far. */
export function deriveLimitChecks(inputs: LimitCheckInputs): LimitCheck[] {
  return [
    weightCheck(inputs),
    windsAloftCheck(inputs),
    ceilVisCheck(inputs),
    climbCheck(inputs),
    runwayCheck(inputs),
  ];
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/**
 * `value` as a percentage of `max`, e.g. "89.9%". Truncated to 0.1, not
 * rounded, so a value under a percentage limit never reads as the limit.
 */
export const formatPercentOfMax = (value: number, max: number) =>
  `${fmt(Math.floor((value * 1000) / max) / 10)}%`;

function check(base: Omit<LimitCheck, "state" | "points">, points: LimitPoint[]): LimitCheck {
  return { ...base, state: worstState(points.map((p) => p.state)), points };
}

/**
 * Weight: % of maximum gross weight, Exceeded at 90% or more. Weight above
 * maximum gross is still checked: its Warning is about an aircraft
 * limitation, not about whether the weight can be trusted.
 */
function weightCheck({ state, notifications, climb }: LimitCheckInputs): LimitCheck {
  const base = {
    id: "weight",
    name: "Weight",
    limit: "under 90% of maximum gross weight",
    caveat: null,
    step: "sortie",
  } as const;
  const dependsOn: Subject[] = [fieldSubject("acType"), fieldSubject("weight")];
  const substitutions = substitutionsFor({ status: "computed", dependsOn }, notifications);
  const notChecked = (waitingFor: string) =>
    check(base, [{ label: "Weight", state: "not-checked", waitingFor, substitutions }]);

  const weight = state.weight;
  const missing = [
    ...(state.acType ? [] : ["aircraft type"]),
    ...(weight === null || weight === undefined ? ["weight"] : []),
  ];
  if (missing.length > 0) return notChecked(`needs ${missing.join(" and ")}`);
  const aircraft = findAircraft(state.acType);
  if (!aircraft || weight === null) return notChecked("needs a supported aircraft type");

  const { maxGrossWeight } = aircraft;
  if (weight > maxGrossWeight) {
    // The over-max-gross Warning withholds %MGW but doesn't make the weight
    // untrusted; any other Warning on its inputs does.
    const own = new Set(assessWeight(weight, aircraft).notifications.map(notificationKey));
    const inputs = new Set(dependsOn.map(subjectKey));
    const untrusted = notifications.some(
      (n) =>
        n.level === "warning" && inputs.has(subjectKey(n.subject)) && !own.has(notificationKey(n)),
    );
    if (untrusted) return notChecked("needs weight checked (Warning)");
  } else if (climb.percentMGW.status === "withheld") {
    return notChecked(climb.percentMGW.reason);
  } else if (climb.percentMGW.status === "unavailable") {
    return notChecked("needs weight");
  }

  const exceeded = weight * 10 >= maxGrossWeight * 9;
  return check(base, [
    {
      label: "Weight",
      state: exceeded ? "exceeded" : "within",
      value: `${fmt(weight)} / ${fmt(maxGrossWeight)} lbs (${formatPercentOfMax(weight, maxGrossWeight)})`,
      substitutions,
    },
  ]);
}

/** The winds-aloft column labels, in `state.wind`'s column order: "3,000'". */
const WIND_ALTITUDES = TARGET_ALTITUDES_FT.map((ft) => `${fmt(ft)}'`);

/**
 * The Winds aloft check's state for each winds-aloft column, undefined where
 * it didn't check that column, for styling the speeds in the winds table.
 */
export function windSpeedStates(checks: readonly LimitCheck[]): (LimitState | undefined)[] {
  const states: (LimitState | undefined)[] = WIND_ALTITUDES.map(() => undefined);
  for (const p of checks.find((c) => c.id === "winds")?.points ?? []) {
    if (p.index !== undefined) states[p.index] = p.state;
  }
  return states;
}

/**
 * The state of each of a check's points, in order (empty when there's no such
 * check), for styling the table cells the points evaluate.
 */
export function pointStates(checks: readonly LimitCheck[], id: LimitCheckId): LimitState[] {
  return checks.find((c) => c.id === id)?.points.map((p) => p.state) ?? [];
}

/**
 * Winds aloft: each entered winds-aloft speed, Exceeded at 30 kt or more and
 * Near limit at 20 kt or more. Blank columns are skipped, but a column whose
 * values (or the whole table) hold a Warning is Not checked, blank or not.
 */
function windsAloftCheck({ state, notifications }: LimitCheckInputs): LimitCheck {
  const base = {
    id: "winds",
    name: "Winds aloft",
    limit: "mountain winds under 30 kt at every altitude",
    caveat: "Surface wind and gusts are not checked.",
    step: "weather",
  } as const;
  const warned = new Set(
    notifications.filter((n) => n.level === "warning").map((n) => subjectKey(n.subject)),
  );
  const tableWarned = warned.has(subjectKey(fieldSubject("wind")));

  const points: LimitPoint[] = [];
  WIND_ALTITUDES.forEach((label, index) => {
    // 0 kt is a real speed; only null means no data.
    const speed = state.wind[1]?.[index] ?? null;
    const untrusted = tableWarned || warned.has(subjectKey(fieldSubject("wind", index)));
    const substitutions = substitutionsFor(
      { status: "computed", dependsOn: [fieldSubject("wind"), fieldSubject("wind", index)] },
      notifications,
    );
    if (untrusted) {
      const waitingFor = speed === null ? "needs speed (Warning)" : "needs speed checked (Warning)";
      points.push({ label, state: "not-checked", waitingFor, substitutions, index });
      return;
    }
    if (speed === null) return;
    const pointState: LimitState = speed >= 30 ? "exceeded" : speed >= 20 ? "near" : "within";
    points.push({ label, state: pointState, value: `${fmt(speed)} kt`, substitutions, index });
  });
  if (points.length === 0) {
    return check(base, [
      {
        label: "Winds aloft",
        state: "not-checked",
        waitingFor: "needs winds-aloft speeds",
        substitutions: [],
      },
    ]);
  }
  const result = check(base, points);
  return points.some((p) => p.state === "near") ? { ...result, note: WINDS_NEAR_NOTE } : result;
}

/** CAP Mountain Flying Qualification Course, module 3, Mountain Weather (see issue #247). */
const WINDS_NEAR_NOTE =
  "Near limit from 20 kt: CAP guidance says to proceed with caution when ridgeline winds are 20 kt or more. The app doesn't know ridge height, so every altitude counts.";

/**
 * Ceiling/visibility: the Ceil/Vis (IFR G-AIRMET) box. Exceeded when ticked,
 * by a fetch or by the pilot; Within limit when unticked for any reason,
 * unless a Warning on the box (e.g. a stale fetch) makes it Not checked.
 * Where the flag came from isn't tracked.
 */
function ceilVisCheck({ state, notifications }: LimitCheckInputs): LimitCheck {
  const base = {
    id: "ceilVis",
    name: "Ceiling/visibility",
    limit: "ceilings and visibility much better than marginal VFR",
    caveat: "Reflects the Ceil/Vis box only (IFR G-AIRMET). Marginal VFR is not checked.",
    step: "weather",
  } as const;
  const subject = fieldSubject("cielVis");
  const ticked = state.cielVis;
  const substitutions = substitutionsFor(
    { status: "computed", dependsOn: [subject] },
    notifications,
  );
  // A Warning on the box, such as a stale fetch, means an unticked box can't
  // be trusted. A ticked box is Exceeded however it got there.
  const untrusted = notifications.some(
    (n) => n.level === "warning" && subjectKey(n.subject) === subjectKey(subject),
  );
  if (!ticked && untrusted) {
    return check(base, [
      {
        label: "Ceil/Vis box",
        state: "not-checked",
        waitingFor: "needs Ceil/Vis checked (Warning)",
        substitutions,
      },
    ]);
  }
  return check(base, [
    {
      label: "Ceil/Vis box",
      state: ticked ? "exceeded" : "within",
      value: ticked ? "Ticked" : "Unticked",
      substitutions,
    },
  ]);
}

/**
 * A point whose value wasn't computed: withheld points say what they're
 * waiting for; unavailable ones (no POH data) say `unavailable`. Above
 * maximum gross the values are withheld as "needs valid weight"; the point
 * says the weight is the reason.
 */
function notCheckedPoint(
  label: string,
  value: Exclude<ComputedValue, { status: "computed" }>,
  unavailable: string,
  state: WorksheetData,
): LimitPoint {
  const aircraft = findAircraft(state.acType);
  const overMaxGross =
    aircraft !== undefined && state.weight !== null && state.weight > aircraft.maxGrossWeight;
  const waitingFor =
    value.status === "unavailable"
      ? unavailable
      : overMaxGross && value.reason === "needs valid weight"
        ? "needs weight at or below maximum gross"
        : value.reason;
  return { label, state: "not-checked", waitingFor, substitutions: [] };
}

/** Whether a weight-adjusted rate of climb fails the Rate of climb check. */
const isClimbExceeded = (fpm: number) => fpm <= 300;

/**
 * Rate of climb: the weight-adjusted rate of climb at departure, operating
 * altitude and arrival, Exceeded at 300 fpm or less. The operating-altitude
 * point stands in for the service ceiling, so there's no separate check.
 */
function climbCheck({ state, notifications, climb }: LimitCheckInputs): LimitCheck {
  const base = {
    id: "climb",
    name: "Rate of climb",
    limit: "over 300 fpm all along the route",
    caveat: null,
    step: "decision",
  } as const;
  return check(
    base,
    COLUMNS.map((col): LimitPoint => {
      const roc = climb.rateOfClimbActual[col];
      const label = columnLabel(state, col);
      if (roc.status !== "computed") {
        return notCheckedPoint(label, roc, "needs POH climb data for these conditions", state);
      }
      return {
        label,
        state: isClimbExceeded(roc.value) ? "exceeded" : "within",
        value: `${fmt(roc.value)} fpm`,
        substitutions: substitutionsFor(roc, notifications, [climbSubject("rateOfClimb", col)]),
      };
    }),
  );
}

/** Whether runway remaining after both ground rolls fails the Runway check. */
export const isRunwayExceeded = (remainingFt: number) => remainingFt <= 0;

/**
 * Runway: at each airport, runway length minus takeoff and landing ground
 * roll, Exceeded at 0 ft or less. The over-50-ft-obstacle values stay
 * informational.
 */
function runwayCheck({ state, notifications, told }: LimitCheckInputs): LimitCheck {
  const base = {
    id: "runway",
    name: "Runway",
    limit: "takeoff ground roll + landing ground roll less than runway length",
    caveat: null,
    step: "decision",
  } as const;
  const slots: AirportSlot[] = ["departure", "arrival"];
  return check(
    base,
    slots.map((slot): LimitPoint => {
      const remaining = told[slot].values.runwayRemainingGroundRoll;
      const label = airportLabel(state, slot);
      if (remaining.status !== "computed") {
        return notCheckedPoint(
          label,
          remaining,
          "needs POH takeoff and landing data for these conditions",
          state,
        );
      }
      return {
        label,
        state: isRunwayExceeded(remaining.value) ? "exceeded" : "within",
        value: `${fmt(remaining.value)} ft remaining`,
        substitutions: substitutionsFor(
          remaining,
          notifications,
          toldValueSubjects(slot, "runwayRemainingGroundRoll"),
        ),
      };
    }),
  );
}
