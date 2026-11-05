import { TOLDCalculationParams } from "@/utils/types";
import {
  trilinearInterpolate,
  bilinearInterpolateDetailed,
  findExtrapolations,
  trilinearTableGaps,
  type Extrapolation,
  type TrilinearInterpolationTable,
} from "@/utils/interpolation";
import aircraftData from "@/data/aircraft.json";

/** Ground roll and 50 ft obstacle distances for one phase (takeoff or landing). */
export interface PhaseDistances {
  /** Feet, or null if the POH table has no data for these conditions. */
  groundRoll: number | null;
  obstacle50ft: number | null;
  /** POH table axes the lookup went beyond (reported, never logged). */
  extrapolated: Extrapolation[];
  /** Blank POH table entries filled with the average of their neighbours (a Substitution). */
  tableGaps: number;
}

const round = (v: number | null): number | null =>
  v === null ? null : Math.round(v);

function mergeExtrapolations(...lists: Extrapolation[][]): Extrapolation[] {
  const out: Extrapolation[] = [];
  for (const e of lists.flat()) {
    if (!out.some((o) => o.axis === e.axis)) out.push(e);
  }
  return out;
}

/**
 * Short-field takeoff distances from the POH table (weight × pressure
 * altitude × temperature). Returns null if the aircraft has no takeoff table.
 */
export function calculateTakeoffDistances(
  aircraftModel: string,
  weight: number,
  pressureAltitude: number,
  temperature: number
): PhaseDistances | null {
  const aircraft = aircraftData.find((a) => a.id === aircraftModel);
  if (!aircraft || !aircraft.shortFieldTakeoff) return null;

  const { weights, pressureAltitudes, temperatures, data } =
    aircraft.shortFieldTakeoff;
  const weightIndex = findWeightIndex(weights, weight);
  if (weightIndex === -1) return null;

  const lookup = (column: "groundRoll" | "groundRoll50ft") => {
    const table: TrilinearInterpolationTable = {
      weights: [weights[weightIndex], weights[weightIndex + 1] || weights[weightIndex]],
      pressureAltitudes,
      temperatures,
      data: [
        data[weightIndex][column],
        data[weightIndex + 1]?.[column] || data[weightIndex][column],
      ],
    };
    try {
      return {
        value: trilinearInterpolate(table, weight, pressureAltitude, temperature),
        gaps: trilinearTableGaps(table, weight, pressureAltitude, temperature),
      };
    } catch {
      return { value: null, gaps: 0 };
    }
  };
  const ground = lookup("groundRoll");
  const obstacle = lookup("groundRoll50ft");
  return {
    groundRoll: round(ground.value),
    obstacle50ft: round(obstacle.value),
    tableGaps: Math.max(ground.gaps, obstacle.gaps),
    // Against the full table, not the two-weight bracket used for lookup.
    extrapolated: findExtrapolations([
      { axis: "weight", values: weights, value: weight },
      { axis: "pressureAltitude", values: pressureAltitudes, value: pressureAltitude },
      { axis: "temperature", values: temperatures, value: temperature },
    ]),
  };
}

/**
 * Short-field landing distances from the POH table (pressure altitude ×
 * temperature; the table is for a single weight). Returns null if the
 * aircraft has no landing table.
 */
export function calculateLandingDistances(
  aircraftModel: string,
  pressureAltitude: number,
  temperature: number
): PhaseDistances | null {
  const aircraft = aircraftData.find((a) => a.id === aircraftModel);
  if (!aircraft || !aircraft.shortFieldLanding) return null;

  const { pressureAltitudes, temperatures, data } = aircraft.shortFieldLanding;
  const lookup = (column: "groundRoll" | "groundRoll50ft") => {
    try {
      return bilinearInterpolateDetailed(
        { xAxis: pressureAltitudes, yAxis: temperatures, data: data[0][column] as number[][] },
        pressureAltitude,
        temperature,
        { xAxisName: "pressureAltitude", yAxisName: "temperature" }
      );
    } catch {
      return { value: null, extrapolated: [] };
    }
  };
  const ground = lookup("groundRoll");
  const obstacle = lookup("groundRoll50ft");
  return {
    groundRoll: round(ground.value),
    obstacle50ft: round(obstacle.value),
    extrapolated: mergeExtrapolations(ground.extrapolated, obstacle.extrapolated),
    // Landing uses bilinear lookup, which refuses blank corners rather than averaging.
    tableGaps: 0,
  };
}

function takeoffFor(aircraftModel: string, params: TOLDCalculationParams) {
  const { weight, pressureAltitude, temperature } = params;
  if (weight == null || pressureAltitude == null || temperature == null) return null;
  return calculateTakeoffDistances(aircraftModel, weight, pressureAltitude, temperature);
}

function landingFor(aircraftModel: string, params: TOLDCalculationParams) {
  const { pressureAltitude, temperature } = params;
  if (pressureAltitude == null || temperature == null) return null;
  return calculateLandingDistances(aircraftModel, pressureAltitude, temperature);
}

/** Takeoff ground roll in feet, or null if it can't be computed. */
export function calculateTakeoffGroundRoll(
  aircraftModel: string,
  params: TOLDCalculationParams
): number | null {
  return takeoffFor(aircraftModel, params)?.groundRoll ?? null;
}

/** Takeoff distance over a 50 ft obstacle in feet, or null. */
export function calculateTakeoff50ftObstacle(
  aircraftModel: string,
  params: TOLDCalculationParams
): number | null {
  return takeoffFor(aircraftModel, params)?.obstacle50ft ?? null;
}

/** Landing ground roll in feet, or null. */
export function calculateLandingGroundRoll(
  aircraftModel: string,
  params: TOLDCalculationParams
): number | null {
  return landingFor(aircraftModel, params)?.groundRoll ?? null;
}

/** Landing distance over a 50 ft obstacle in feet, or null. */
export function calculateLanding50ftObstacle(
  aircraftModel: string,
  params: TOLDCalculationParams
): number | null {
  return landingFor(aircraftModel, params)?.obstacle50ft ?? null;
}

/**
 * Calculate available runway remaining after required distance
 * @param runwayLength The total runway length in feet (can be null)
 * @param takeoffDistance The required distance for takeoff in feet (can be null)
 * @param landingDistance The required distance for landing in feet (can be null)
 * @returns The available runway remaining in feet, or null if calculation fails
 */
export function calculateAvailableRunwayRemaining(
  runwayLength: number | null,
  takeoffDistance: number | null,
  landingDistance: number | null
): number | null {
  try {
    // If runway length is not specified, return null
    if (runwayLength === null || runwayLength === undefined) {
      return null;
    }

    if (runwayLength <= 0) {
      return null;
    }

    // Both takeoff and landing distances are required
    if (takeoffDistance === null || landingDistance === null) {
      return null;
    }

    // Calculate total required distance (takeoff + landing)
    const totalRequiredDistance = takeoffDistance + landingDistance;

    const remaining = runwayLength - totalRequiredDistance;

    // Return the remaining distance (can be negative if runway is too short)
    return Math.round(remaining);
  } catch (error) {
    console.error("Error calculating available runway remaining:", error);
    return null;
  }
}

/**
 * Helper function to find the appropriate weight index for interpolation
 * @param weights Array of weight values
 * @param targetWeight The target weight to find
 * @returns The index of the weight bracket, or -1 if not found
 */
function findWeightIndex(weights: number[], targetWeight: number): number {
  // Handle single weight case
  if (weights.length === 1) {
    return 0;
  }

  for (let i = 0; i < weights.length - 1; i++) {
    if (targetWeight >= weights[i] && targetWeight <= weights[i + 1]) {
      return i;
    }
  }

  // Handle extrapolation cases
  if (targetWeight < weights[0]) {
    return 0;
  } else if (targetWeight > weights[weights.length - 1]) {
    return weights.length - 2;
  }

  return -1;
}

