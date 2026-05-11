import {
  altitudeToPressureAltitude,
  pressureAltitudeToDensityAltitude,
} from "./formulas";
import type { WorksheetData, TOLDError } from "./types";
import { calculateTOLDForMultipleAirports } from "./toldCalculations";

export type Triple = [number | null, number | null, number | null];

// -1 is the legacy "no value" sentinel used by the weather mapper for
// optional fields. Treated as missing uniformly across altitude, altimeter,
// and temperature (the mapper strips it from altitude before commit).
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

export interface TOLDViewModel {
  results: {
    takeoffGroundRoll: { departure: number | null; arrival: number | null };
    takeoff50ftObstacle: { departure: number | null; arrival: number | null };
    landingGroundRoll: { departure: number | null; arrival: number | null };
    landing50ftObstacle: { departure: number | null; arrival: number | null };
    availableRunwayRemainingTakeoffGroundRoll: {
      departure: number | null;
      arrival: number | null;
    };
    availableRunwayRemainingTakeoff50ft: {
      departure: number | null;
      arrival: number | null;
    };
  } | null;
  status: "success" | "invalid_inputs" | "error";
  errors: TOLDError[];
  warnings: TOLDError[];
  extrapolationWarnings: TOLDError[];
  errorSummary:
    | { count: number; critical: number; warnings: number; messages: string[] }
    | null;
  warningSummary:
    | {
        count: number;
        validation: number;
        extrapolation: number;
        messages: string[];
      }
    | null;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export function computeTOLDViewModel(
  state: WorksheetData,
  PAs: Triple,
): TOLDViewModel {
  const empty: TOLDViewModel = {
    results: null,
    status: "invalid_inputs",
    errors: [],
    warnings: [],
    extrapolationWarnings: [],
    errorSummary: null,
    warningSummary: null,
    hasErrors: false,
    hasWarnings: false,
  };

  if (!state.acType || state.weight === null || state.weight === undefined) {
    return empty;
  }

  const deptPA = PAs[0];
  const arrPA = PAs[2];
  const deptValid = deptPA !== null && state.temp[0] !== null && state.temp[0] !== undefined;
  const arrValid = arrPA !== null && state.temp[2] !== null && state.temp[2] !== undefined;
  if (!deptValid && !arrValid) {
    return empty;
  }

  let result;
  try {
    result = calculateTOLDForMultipleAirports(state.acType, {
      weight: state.weight,
      pressureAltitudes: [deptPA, arrPA] as [number | null, number | null],
      temperatures: [state.temp[0] ?? null, state.temp[2] ?? null] as [
        number | null,
        number | null,
      ],
      runwayLengths: state.rwy,
    });
  } catch (error) {
    return {
      ...empty,
      status: "error",
      errors: [
        {
          type: "calculation_failed",
          message: `TOLD calculation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          severity: "error",
        },
      ],
      hasErrors: true,
    };
  }

  const errors = result.errors;
  const warnings = result.validationWarnings;
  const extrap = result.extrapolationWarnings;
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0 || extrap.length > 0;

  return {
    results: result.success && result.results ? result.results : null,
    status: hasErrors ? "error" : result.success ? "success" : "invalid_inputs",
    errors,
    warnings,
    extrapolationWarnings: extrap,
    errorSummary:
      errors.length === 0
        ? null
        : {
            count: errors.length,
            critical: errors.filter((e) => e.severity === "error").length,
            warnings: errors.filter((e) => e.severity === "warning").length,
            messages: errors.map((e) => e.message),
          },
    warningSummary:
      warnings.length + extrap.length === 0
        ? null
        : {
            count: warnings.length + extrap.length,
            validation: warnings.length,
            extrapolation: extrap.length,
            messages: [...warnings, ...extrap].map((w) => w.message),
          },
    hasErrors,
    hasWarnings,
  };
}
