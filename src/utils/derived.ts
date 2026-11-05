import {
  altitudeToPressureAltitude,
  pressureAltitudeToDensityAltitude,
} from "./formulas";
import type { Aircraft, WorksheetData } from "./types";
import { fieldSubject, valueSubject, type Notification } from "./notifications";
import type { Extrapolation } from "./interpolation";
import aircraftData from "@/data/aircraft.json";

export function findAircraft(acType: string): Aircraft | undefined {
  return (aircraftData as Aircraft[]).find((a) => a.id === acType);
}
import {
  calculateAvailableRunwayRemaining,
  calculateLandingDistances,
  calculateTakeoffDistances,
  type PhaseDistances,
} from "./toldCalculations";

export type Triple = [number | null, number | null, number | null];

// -1 is the legacy "no value" sentinel used by the weather mapper. For
// temp/altimeter the mapper writes -1 directly into freshly-created arrays;
// for altitude it doubles as a "don't update" marker for the operating slot
// inside mergeWeatherData. Treated as missing uniformly here so any -1 that
// does reach state (e.g. from a fresh weather fetch when no altitude is set
// yet) is rendered as missing rather than as a real altitude of -1 ft.
export function isReal(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && v !== -1;
}

export function computePressureColumns(
  altitudes: Triple,
  altimeters: Triple,
  temperatures: Triple,
): { PAs: Triple; DAs: Triple } {
  const PAs: Triple = [null, null, null];
  const DAs: Triple = [null, null, null];
  for (let i = 0; i < 3; i++) {
    const alt = altitudes[i];
    const altim = altimeters[i];
    const temp = temperatures[i];
    if (isReal(alt) && isReal(altim) && isReal(temp)) {
      const pa = altitudeToPressureAltitude(alt, altim);
      PAs[i] = pa;
      DAs[i] = pressureAltitudeToDensityAltitude(pa, temp);
    }
  }
  return { PAs, DAs };
}

export type AirportSlot = "departure" | "arrival";

export const TOLD_VALUE_KEYS = [
  "takeoffGroundRoll",
  "takeoff50ftObstacle",
  "landingGroundRoll",
  "landing50ftObstacle",
  "runwayRemainingGroundRoll",
  "runwayRemaining50ft",
] as const;
export type TOLDValueKey = (typeof TOLD_VALUE_KEYS)[number];

/**
 * A computed value as displayed. `withheld` means one of the value's own
 * inputs needs input or has a Warning; `reason` says what it is waiting for
 * ("needs arrival temperature"). `unavailable` means it could not be
 * computed; a Warning on the value explains why.
 */
export type ComputedValue =
  | { status: "computed"; value: number }
  | { status: "withheld"; reason: string }
  | { status: "unavailable" };

export interface AirportTOLD {
  slot: AirportSlot;
  values: Record<TOLDValueKey, ComputedValue>;
  /** Notifications about this airport's values and inputs. */
  notifications: Notification[];
}

export interface TOLDViewModel {
  departure: AirportTOLD;
  arrival: AirportTOLD;
  /** Every TOLD notification once: shared (weight, aircraft) plus both airports. */
  notifications: Notification[];
}

/** Hard limits beyond which a temperature is treated as invalid input. */
export const TEMP_LIMITS_C = { min: -50, max: 60 } as const;
/** Pressure altitude above which an Advisory is shown. */
export const PA_ADVISORY_FT = 15000;

const TRIPLE_INDEX: Record<AirportSlot, 0 | 2> = { departure: 0, arrival: 2 };
const RWY_INDEX: Record<AirportSlot, 0 | 1> = { departure: 0, arrival: 1 };

/** Subject for a TOLD phase's distances at one airport. */
export const toldSubject = (slot: AirportSlot, phase: "takeoff" | "landing") =>
  valueSubject(`told.${slot}.${phase}`, "decision");

const SLOT_NAME: Record<AirportSlot, string> = { departure: "Departure", arrival: "Arrival" };

/** "Departure (KABC)", or "Departure" when no airport is entered. */
export function airportLabel(state: WorksheetData, slot: AirportSlot): string {
  const code = state.airport[slot === "departure" ? 0 : 1]?.trim();
  return code ? `${SLOT_NAME[slot]} (${code.toUpperCase()})` : SLOT_NAME[slot];
}

const AXIS_TEXT: Record<string, (v: number) => string> = {
  weight: (v) => `weight ${fmt(v)} lbs`,
  pressureAltitude: (v) => `pressure altitude ${fmt(v)} ft`,
  temperature: (v) => `temperature ${fmt(v)}°C`,
};
const AXIS_UNIT: Record<string, (lo: number, hi: number) => string> = {
  weight: (lo, hi) => `${fmt(lo)}–${fmt(hi)} lbs`,
  pressureAltitude: (lo, hi) => `${fmt(lo)}–${fmt(hi)} ft`,
  temperature: (lo, hi) => `${fmt(lo)}–${fmt(hi)}°C`,
};

export function describeExtrapolations(list: Extrapolation[]): string {
  return list
    .map((e) => {
      const what = AXIS_TEXT[e.axis]?.(e.value) ?? `${e.axis} ${fmt(e.value)}`;
      const range = AXIS_UNIT[e.axis]?.(e.min, e.max) ?? `${fmt(e.min)}–${fmt(e.max)}`;
      return `${what} is outside ${range}`;
    })
    .join("; ");
}

const computed = (value: number | null): ComputedValue =>
  value === null ? { status: "unavailable" } : { status: "computed", value };

const withheld = (reason: string): ComputedValue => ({ status: "withheld", reason });

function joinNeeds(slot: AirportSlot, needs: string[]): string {
  const list =
    needs.length <= 1
      ? needs.join("")
      : `${needs.slice(0, -1).join(", ")} and ${needs[needs.length - 1]}`;
  return `needs ${slot} ${list}`;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * Checks weight against the aircraft's hard limits. Returns the reason
 * weight-dependent values are withheld (null if weight is usable) and any
 * notification about weight.
 */
export function assessWeight(
  weight: number | null,
  aircraft: Aircraft | undefined,
): { withheldReason: string | null; notifications: Notification[] } {
  if (weight === null || weight === undefined) {
    return { withheldReason: "needs weight", notifications: [] };
  }
  const warn = (message: string) => ({
    withheldReason: "needs valid weight",
    notifications: [{ level: "warning" as const, subject: fieldSubject("weight"), message }],
  });
  if (weight <= 0) return warn("Weight must be greater than 0 lbs.");
  if (!aircraft) return { withheldReason: null, notifications: [] };
  const { id, emptyWeight, maxGrossWeight } = aircraft;
  if (weight < emptyWeight) {
    return warn(
      `Weight ${fmt(weight)} lbs is below the ${id} empty weight (${fmt(emptyWeight)} lbs).`,
    );
  }
  if (weight > maxGrossWeight) {
    return warn(
      `Weight ${fmt(weight)} lbs exceeds the ${id} maximum gross weight (${fmt(maxGrossWeight)} lbs).`,
    );
  }
  if (weight >= maxGrossWeight * 0.95) {
    const percent = Math.round((weight / maxGrossWeight) * 100);
    return {
      withheldReason: null,
      notifications: [
        {
          level: "advisory",
          subject: fieldSubject("weight"),
          message: `Weight ${fmt(weight)} lbs is ${percent}% of the ${id} maximum gross weight (${fmt(maxGrossWeight)} lbs).`,
        },
      ],
    };
  }
  return { withheldReason: null, notifications: [] };
}

function computeAirportTOLD(
  state: WorksheetData,
  slot: AirportSlot,
  pa: number | null,
  weightWithheld: string | null,
  aircraftWithheld: string | null,
): AirportTOLD {
  const i = TRIPLE_INDEX[slot];
  const temp = state.temp[i];
  const label = airportLabel(state, slot);
  const notifications: Notification[] = [];
  const values = {} as Record<TOLDValueKey, ComputedValue>;
  const withholdAll = (reason: string): AirportTOLD => {
    for (const k of TOLD_VALUE_KEYS) values[k] = withheld(reason);
    return { slot, values, notifications };
  };

  const tempInvalid =
    isReal(temp) && (temp < TEMP_LIMITS_C.min || temp > TEMP_LIMITS_C.max);
  if (tempInvalid) {
    notifications.push({
      level: "warning",
      subject: fieldSubject("temp", i),
      message: `${label} temperature ${fmt(temp)}°C is outside the ${TEMP_LIMITS_C.min} to ${TEMP_LIMITS_C.max}°C the worksheet accepts.`,
    });
  }
  const rwyIndex = RWY_INDEX[slot];
  const rwy = state.rwy[rwyIndex];
  const rwyInvalid = rwy !== null && rwy !== undefined && rwy <= 0;
  if (rwyInvalid) {
    notifications.push({
      level: "warning",
      subject: fieldSubject("rwy", rwyIndex),
      message: `${label} runway length must be greater than 0 ft.`,
    });
  }
  if (pa !== null && pa > PA_ADVISORY_FT) {
    notifications.push({
      level: "advisory",
      subject: valueSubject(`told.${slot}`, "decision"),
      message: `${label} pressure altitude ${fmt(pa)} ft is above ${fmt(PA_ADVISORY_FT)} ft.`,
    });
  }

  if (aircraftWithheld) return withholdAll(aircraftWithheld);
  const missing: string[] = [];
  if (!isReal(state.altitude[i])) missing.push("field elevation");
  if (!isReal(state.altimeter[i])) missing.push("altimeter");
  if (!isReal(temp)) missing.push("temperature");
  if (missing.length > 0 || pa === null || !isReal(temp)) {
    return withholdAll(joinNeeds(slot, missing.length ? missing : ["pressure altitude"]));
  }
  if (tempInvalid) {
    return withholdAll(`needs valid ${slot} temperature`);
  }

  const phase = (
    name: "takeoff" | "landing",
    result: PhaseDistances | null,
  ): [ComputedValue, ComputedValue] => {
    const subject = toldSubject(slot, name);
    if (result === null || result.groundRoll === null || result.obstacle50ft === null) {
      notifications.push({
        level: "warning",
        subject,
        message: `${label} ${name} distances could not be computed: the ${state.acType} POH ${name} table has no data for these conditions.`,
      });
    }
    if (result && result.extrapolated.length > 0) {
      notifications.push({
        level: "caution",
        subject,
        message: `${label} ${name} distances are extrapolated beyond the POH table: ${describeExtrapolations(result.extrapolated)}.`,
      });
    }
    return [computed(result?.groundRoll ?? null), computed(result?.obstacle50ft ?? null)];
  };

  if (weightWithheld) {
    const w = withheld(weightWithheld);
    values.takeoffGroundRoll = w;
    values.takeoff50ftObstacle = w;
  } else {
    [values.takeoffGroundRoll, values.takeoff50ftObstacle] = phase(
      "takeoff",
      calculateTakeoffDistances(state.acType, state.weight as number, pa, temp),
    );
  }
  [values.landingGroundRoll, values.landing50ftObstacle] = phase(
    "landing",
    calculateLandingDistances(state.acType, pa, temp),
  );

  const remaining = (to: ComputedValue, ldg: ComputedValue): ComputedValue => {
    if (to.status === "withheld") return to;
    if (ldg.status === "withheld") return ldg;
    if (rwy === null || rwy === undefined) return withheld(`needs ${slot} runway length`);
    if (rwyInvalid) return withheld(`needs valid ${slot} runway length`);
    if (to.status !== "computed" || ldg.status !== "computed") return { status: "unavailable" };
    return computed(calculateAvailableRunwayRemaining(rwy, to.value, ldg.value));
  };
  values.runwayRemainingGroundRoll = remaining(values.takeoffGroundRoll, values.landingGroundRoll);
  values.runwayRemaining50ft = remaining(values.takeoff50ftObstacle, values.landing50ftObstacle);

  return { slot, values, notifications };
}

export function computeTOLDViewModel(
  state: WorksheetData,
  PAs: Triple,
): TOLDViewModel {
  const aircraft = findAircraft(state.acType);
  const aircraftNotifications: Notification[] = [];
  let aircraftWithheld: string | null = null;
  if (!state.acType) {
    aircraftWithheld = "needs aircraft type";
  } else if (!aircraft) {
    aircraftWithheld = "needs a supported aircraft type";
    aircraftNotifications.push({
      level: "warning",
      subject: fieldSubject("acType"),
      message: `Aircraft type ${state.acType} has no POH performance data.`,
    });
  }
  const weight = assessWeight(state.weight, aircraft);
  const departure = computeAirportTOLD(
    state, "departure", PAs[0], weight.withheldReason, aircraftWithheld,
  );
  const arrival = computeAirportTOLD(
    state, "arrival", PAs[2], weight.withheldReason, aircraftWithheld,
  );
  return {
    departure,
    arrival,
    notifications: [
      ...aircraftNotifications,
      ...weight.notifications,
      ...departure.notifications,
      ...arrival.notifications,
    ],
  };
}
