import {
  altitudeToPressureAltitude,
  calculateVra,
  calculateVx,
  pressureAltitudeToDensityAltitude,
} from "./formulas";
import type { Aircraft, WorksheetData } from "./types";
import {
  fieldSubject,
  subjectKey,
  valueSubject,
  type Notification,
  type Subject,
} from "./notifications";
import {
  bilinearInterpolateDetailed,
  findExtrapolations,
  findInverseXgivenYandZ,
  inverseLookupExtrapolation,
  type Extrapolation,
} from "./interpolation";
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

/**
 * The input Subjects a pressure/density-altitude column is computed from, for
 * markers. Pressure altitude uses altitude and altimeter; density altitude
 * adds temperature.
 */
export function pressureColumnDependsOn(col: 0 | 1 | 2): {
  pressureAltitude: Subject[];
  densityAltitude: Subject[];
} {
  const pressureAltitude = [fieldSubject("altitude", col), fieldSubject("altimeter", col)];
  return {
    pressureAltitude,
    densityAltitude: [...pressureAltitude, fieldSubject("temp", col)],
  };
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
  | {
      status: "computed";
      value: number;
      /** The input fields this value was computed from, for markers that point back to them. */
      dependsOn: Subject[];
    }
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

const computed = (value: number | null, dependsOn: Subject[]): ComputedValue =>
  value === null ? { status: "unavailable" } : { status: "computed", value, dependsOn };

/**
 * The input Subjects a value depends on, in a fixed order: aircraft type,
 * weight, altitude, altimeter, temperature, runway. Indices select the slot.
 */
function inputs(spec: {
  weight?: boolean;
  altitude?: number;
  altimeter?: number;
  temp?: number;
  rwy?: number;
}): Subject[] {
  const out: Subject[] = [fieldSubject("acType")];
  if (spec.weight) out.push(fieldSubject("weight"));
  if (spec.altitude !== undefined) out.push(fieldSubject("altitude", spec.altitude));
  if (spec.altimeter !== undefined) out.push(fieldSubject("altimeter", spec.altimeter));
  if (spec.temp !== undefined) out.push(fieldSubject("temp", spec.temp));
  if (spec.rwy !== undefined) out.push(fieldSubject("rwy", spec.rwy));
  return out;
}

const withheld = (reason: string): ComputedValue => ({ status: "withheld", reason });

function joinNeeds(slot: AirportSlot | "operating", needs: string[]): string {
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
    const dependsOn = inputs({
      weight: name === "takeoff",
      altitude: i,
      altimeter: i,
      temp: i,
    });
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
    if (result && result.tableGaps > 0) {
      const entries = result.tableGaps === 1 ? "entry" : "entries";
      notifications.push({
        level: "caution",
        subject,
        message: `${label} ${name} distances fill ${result.tableGaps} blank POH table ${entries} near these conditions with the average of the neighbouring entries.`,
      });
    }
    return [
      computed(result?.groundRoll ?? null, dependsOn),
      computed(result?.obstacle50ft ?? null, dependsOn),
    ];
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
    return computed(
      calculateAvailableRunwayRemaining(rwy, to.value, ldg.value),
      inputs({ weight: true, altitude: i, altimeter: i, temp: i, rwy: rwyIndex }),
    );
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

// ---------------------------------------------------------------------------
// Climb, V-speeds and ceilings
// ---------------------------------------------------------------------------

export type Column = 0 | 1 | 2;
export const COLUMNS: readonly Column[] = [0, 1, 2];
export const COLUMN_SLOT = ["departure", "operating", "arrival"] as const;
export type ColumnSlot = (typeof COLUMN_SLOT)[number];

type Columns<T> = [T, T, T];

/** A service ceiling: computed, withheld, unavailable, or above the top of the climb table. */
export type ServiceCeiling =
  | ComputedValue
  | { status: "aboveTable"; tableMax: number; dependsOn: Subject[] };

export interface ClimbViewModel {
  rateOfClimb: Columns<ComputedValue>;
  rateOfClimbActual: Columns<ComputedValue>;
  vx: Columns<ComputedValue>;
  vy: Columns<ComputedValue>;
  /** Pressure altitude (ft) at which climb falls to 300 fpm, per column temperature. */
  serviceCeiling: Columns<ServiceCeiling>;
  va: ComputedValue;
  vra: ComputedValue;
  percentMGW: ComputedValue;
  notifications: Notification[];
}

/** Subject for a climb-table value, per column ("climb.vx.operating") or overall ("climb.va"). */
export const climbSubject = (row: string, col?: Column) =>
  valueSubject(col === undefined ? `climb.${row}` : `climb.${row}.${COLUMN_SLOT[col]}`, "decision");

/** "Departure (KABC)", "Operating altitude", or "Arrival (KXYZ)". */
export function columnLabel(state: WorksheetData, col: Column): string {
  if (col === 1) return "Operating altitude";
  return airportLabel(state, col === 0 ? "departure" : "arrival");
}

function columnNeeds(col: Column, missing: string[]): string {
  return joinNeeds(COLUMN_SLOT[col], missing);
}

/** Pressure altitude from altitude and altimeter alone (no temperature needed). */
function columnPressureAltitude(state: WorksheetData, col: Column): number | null {
  const alt = state.altitude[col];
  const altim = state.altimeter[col];
  return isReal(alt) && isReal(altim) ? altitudeToPressureAltitude(alt, altim) : null;
}

function missingPressureInputs(state: WorksheetData, col: Column): string[] {
  const missing: string[] = [];
  if (!isReal(state.altitude[col])) missing.push(col === 1 ? "altitude" : "field elevation");
  if (!isReal(state.altimeter[col])) missing.push("altimeter");
  return missing;
}

export function computeClimbViewModel(state: WorksheetData): ClimbViewModel {
  const aircraft = findAircraft(state.acType);
  const notifications: Notification[] = [];
  const weight = assessWeight(state.weight, aircraft);
  const unknownAircraft = !state.acType ? "needs aircraft type" : "needs a supported aircraft type";
  const all = (v: ComputedValue): Columns<ComputedValue> => [v, v, v];

  if (!aircraft) {
    const w = withheld(unknownAircraft);
    return {
      rateOfClimb: all(w),
      rateOfClimbActual: all(w),
      vx: all(w),
      vy: all(w),
      serviceCeiling: all(w),
      va: w,
      vra: w,
      percentMGW: w,
      notifications,
    };
  }

  // Operating temperature limit (departure/arrival limits are raised by TOLD).
  const opTemp = state.temp[1];
  if (isReal(opTemp) && (opTemp < TEMP_LIMITS_C.min || opTemp > TEMP_LIMITS_C.max)) {
    notifications.push({
      level: "warning",
      subject: fieldSubject("temp", 1),
      message: `${columnLabel(state, 1)} temperature ${fmt(opTemp)}°C is outside the ${TEMP_LIMITS_C.min} to ${TEMP_LIMITS_C.max}°C the worksheet accepts.`,
    });
  }

  /** The column's temperature, or why values needing it are withheld. */
  const tempFor = (col: Column): number | string => {
    const t = state.temp[col];
    if (!isReal(t)) return columnNeeds(col, ["temperature"]);
    if (t < TEMP_LIMITS_C.min || t > TEMP_LIMITS_C.max) {
      return `needs valid ${COLUMN_SLOT[col]} temperature`;
    }
    return t;
  };
  const paFor = (col: Column): number | string =>
    columnPressureAltitude(state, col) ?? columnNeeds(col, missingPressureInputs(state, col));

  const climb = aircraft.climbPerformance;
  const rateOfClimb = COLUMNS.map((col): ComputedValue => {
    const pa = paFor(col);
    const temp = tempFor(col);
    const missing = [
      ...missingPressureInputs(state, col),
      ...(isReal(state.temp[col]) ? [] : ["temperature"]),
    ];
    if (missing.length > 0) return withheld(columnNeeds(col, missing));
    if (typeof pa === "string") return withheld(pa);
    if (typeof temp === "string") return withheld(temp);
    const label = columnLabel(state, col);
    try {
      const r = bilinearInterpolateDetailed(
        { xAxis: climb.pressureAltitudes, yAxis: climb.temperatures, data: climb.data as number[][] },
        pa,
        temp,
        { xAxisName: "pressureAltitude", yAxisName: "temperature" },
      );
      if (r.extrapolated.length > 0) {
        notifications.push({
          level: "caution",
          subject: climbSubject("rateOfClimb", col),
          message: `${label} rate of climb is extrapolated beyond the POH climb table: ${describeExtrapolations(r.extrapolated)}.`,
        });
      }
      return computed(
        Math.round(r.value),
        inputs({ altitude: col, altimeter: col, temp: col }),
      );
    } catch {
      notifications.push({
        level: "warning",
        subject: climbSubject("rateOfClimb", col),
        message: `${label} rate of climb could not be computed: the ${aircraft.id} POH climb table has no data for these conditions.`,
      });
      return { status: "unavailable" };
    }
  }) as Columns<ComputedValue>;

  const percentMGW: ComputedValue = weight.withheldReason
    ? withheld(weight.withheldReason)
    : computed(
        Math.round(((state.weight as number) / aircraft.maxGrossWeight) * 100),
        inputs({ weight: true }),
      );

  const rateOfClimbActual = rateOfClimb.map((roc, col): ComputedValue => {
    if (roc.status === "withheld") return roc;
    if (percentMGW.status !== "computed") return percentMGW;
    if (roc.status !== "computed") return roc;
    return computed(
      Math.round(roc.value * (1 + (1 - percentMGW.value / 100))),
      inputs({ weight: true, altitude: col, altimeter: col, temp: col }),
    );
  }) as Columns<ComputedValue>;

  const vxTable = aircraft.Vx;
  if (!vxTable) {
    notifications.push({
      level: "warning",
      subject: climbSubject("vx"),
      message: `Vx is not available: the ${aircraft.id} POH data has no Vx table.`,
    });
  }
  const vx = COLUMNS.map((col): ComputedValue => {
    const pa = paFor(col);
    if (typeof pa === "string") return withheld(pa);
    if (!vxTable) return { status: "unavailable" };
    const extrapolated = findExtrapolations([
      { axis: "pressureAltitude", values: vxTable.altitudes, value: pa },
    ]);
    if (extrapolated.length > 0) {
      notifications.push({
        level: "caution",
        subject: climbSubject("vx", col),
        message: `${columnLabel(state, col)} Vx is extrapolated beyond the POH Vx table: ${describeExtrapolations(extrapolated)}.`,
      });
    }
    return computed(calculateVx(aircraft, pa), inputs({ altitude: col, altimeter: col }));
  }) as Columns<ComputedValue>;

  const vy = COLUMNS.map((col): ComputedValue => {
    const pa = paFor(col);
    if (typeof pa === "string") return withheld(pa);
    const outside = findExtrapolations([
      { axis: "pressureAltitude", values: climb.pressureAltitudes, value: pa },
    ]);
    if (outside.length > 0) {
      notifications.push({
        level: "caution",
        subject: climbSubject("vy", col),
        message: `${columnLabel(state, col)} Vy is a POH climb-table entry, not a value for this altitude: ${describeExtrapolations(outside)}.`,
      });
    }
    let idx = climb.pressureAltitudes.findIndex((p) => p >= pa);
    if (idx === -1) idx = 0; // Above the table; which entry to show is #228.
    return computed(climb.climbSpeeds[idx] ?? null, inputs({ altitude: col, altimeter: col }));
  }) as Columns<ComputedValue>;

  let va: ComputedValue;
  if (weight.withheldReason) {
    va = withheld(weight.withheldReason);
  } else {
    const w = state.weight as number;
    try {
      const r = bilinearInterpolateDetailed(
        { xAxis: [1], yAxis: aircraft.maneuvering.weights, data: [aircraft.maneuvering.Va] },
        1,
        w,
        { yAxisName: "weight" },
      );
      if (r.extrapolated.length > 0) {
        notifications.push({
          level: "caution",
          subject: climbSubject("va"),
          message: `Va is extrapolated beyond the POH maneuvering-speed table: ${describeExtrapolations(r.extrapolated)}.`,
        });
      }
      va = computed(Math.round(r.value), inputs({ weight: true }));
    } catch {
      notifications.push({
        level: "warning",
        subject: climbSubject("va"),
        message: `Va could not be computed: the ${aircraft.id} POH maneuvering-speed table has no data for ${fmt(w)} lbs.`,
      });
      va = { status: "unavailable" };
    }
  }

  const vraValue = calculateVra(aircraft);
  if (vraValue === null) {
    notifications.push({
      level: "warning",
      subject: climbSubject("vra"),
      message: `Vra is not available: the ${aircraft.id} POH data has no clean stall speed.`,
    });
  }
  const vra = computed(vraValue, inputs({}));

  const alts = climb.pressureAltitudes;
  const serviceCeiling = COLUMNS.map((col): ServiceCeiling => {
    const temp = tempFor(col);
    if (typeof temp === "string") return withheld(temp);
    try {
      const pa = findInverseXgivenYandZ(climb.data, alts, climb.temperatures, 300, temp);
      const tableMax = alts[alts.length - 1];
      // The MSL display also converts with the column's altimeter.
      const dependsOn = inputs({ altimeter: col, temp: col });
      if (pa > tableMax) return { status: "aboveTable", tableMax, dependsOn };
      const outside = inverseLookupExtrapolation(climb.data, alts, climb.temperatures, temp, pa);
      if (outside) {
        const edge = outside === "below" ? "lowest" : "highest";
        notifications.push({
          level: "caution",
          subject: climbSubject("serviceCeiling", col),
          message: `${columnLabel(state, col)} service ceiling is extrapolated ${outside} the ${edge} altitude in the POH climb table at ${fmt(temp)}°C.`,
        });
      }
      return computed(pa, dependsOn);
    } catch {
      notifications.push({
        level: "warning",
        subject: climbSubject("serviceCeiling", col),
        message: `${columnLabel(state, col)} service ceiling could not be computed: the ${aircraft.id} POH climb table has no data at ${fmt(temp)}°C.`,
      });
      return { status: "unavailable" };
    }
  }) as Columns<ServiceCeiling>;

  return {
    rateOfClimb,
    rateOfClimbActual,
    vx,
    vy,
    serviceCeiling,
    va,
    vra,
    percentMGW,
    notifications,
  };
}

// ---------------------------------------------------------------------------
// Maneuvering speeds
// ---------------------------------------------------------------------------

export const MANEUVERING_SUBJECT = valueSubject("maneuvering", "decision");

/**
 * A Warning when the aircraft's stall speeds can't produce maneuvering
 * speeds. An unknown aircraft is left to the aircraft-type Warning.
 */
export function maneuveringNotifications(aircraft: Aircraft | undefined): Notification[] {
  if (!aircraft) return [];
  const { flaps, Vso } = aircraft.stallSpeeds ?? { flaps: [], Vso: [] };
  const usable =
    flaps.length > 0 &&
    Vso.length === flaps.length &&
    Vso.every((v) => typeof v === "number" && v > 0);
  if (usable) return [];
  return [
    {
      level: "warning",
      subject: MANEUVERING_SUBJECT,
      message: `Maneuvering speeds are not available: the ${aircraft.id} POH data has no stall speed for every flap setting.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// All performance notifications
// ---------------------------------------------------------------------------

/**
 * Every notification about performance inputs and computed values (TOLD,
 * climb, maneuvering), once each. Pure; AppContainer concatenates it with the
 * weather-fetch notifications so inputs and step badges show them.
 */
export function derivePerformanceNotifications(state: WorksheetData): Notification[] {
  const { PAs } = computePressureColumns(state.altitude, state.altimeter, state.temp);
  const all = [
    ...computeTOLDViewModel(state, PAs).notifications,
    ...computeClimbViewModel(state).notifications,
    ...maneuveringNotifications(findAircraft(state.acType)),
  ];
  const seen = new Set<string>();
  return all.filter((n) => {
    const key = `${n.level}|${subjectKey(n.subject)}|${n.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
