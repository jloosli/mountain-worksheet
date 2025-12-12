// Import types for interpolation
import {
  type InterpolationTable,
  type InterpolationOptions,
  bilinearInterpolate,
} from "./interpolation";
import { type Aircraft } from "./types";

const farenheitToCelcius = (f: number) => ((f - 32) * 5) / 9;
const celciusToFarenheit = (c: number) => (c * 9) / 5 + 32;

const altitudeToPressureAltitude = (altitude: number, altimeter: number) => {
  return altitude + (29.92 - altimeter) * 1000;
};

const pressureAltitudeToDensityAltitude = (
  pressureAltitude: number,
  temperatureC: number
) => {
  const standardTempC = 15 - (pressureAltitude / 1000) * 2;
  const densityAltitude =
    pressureAltitude + 120 * (temperatureC - standardTempC);
  return densityAltitude;
};

// Convenience function for rate of climb
function getRateOfClimb(
  table: InterpolationTable,
  pressureAltitude: number,
  outsideAirTemp: number,
  options: InterpolationOptions = {}
): number {
  return Math.round(
    bilinearInterpolate(table, pressureAltitude, outsideAirTemp, options)
  );
}

/**
 * Calculates Vra (Rough Air Speed) for an aircraft
 * Vra is calculated as 1.7 times the 0° flap Vso (stall speed in flaps up configuration)
 *
 * @param aircraft - The aircraft object containing stall speed data
 * @returns The calculated Vra speed in knots, rounded to nearest whole number, or null if Vso data is missing
 */
function calculateVra(aircraft: Aircraft | null): number | null {
  if (
    !aircraft ||
    !aircraft.stallSpeeds ||
    !aircraft.stallSpeeds.Vso ||
    aircraft.stallSpeeds.Vso.length === 0
  ) {
    return null;
  }

  const vso0Flap = aircraft.stallSpeeds.Vso[0];
  if (vso0Flap === undefined || vso0Flap === null || vso0Flap <= 0) {
    return null;
  }

  return Math.round(vso0Flap * 1.7);
}

/**
 * Calculates Vx (Best Angle of Climb Speed) for an aircraft at a given altitude
 * Performs linear interpolation between altitude points if multiple values are provided.
 * If only a single value is provided, returns that speed for all altitudes.
 * Extrapolates linearly for altitudes outside the provided range.
 *
 * @param aircraft - The aircraft object containing Vx data
 * @param altitude - The pressure altitude in feet
 * @returns The calculated Vx speed in knots, rounded to nearest whole number, or null if Vx data is missing
 */
function calculateVx(
  aircraft: Aircraft | null,
  altitude: number
): number | null {
  if (!aircraft || !aircraft.Vx) {
    return null;
  }

  const { speeds, altitudes } = aircraft.Vx;

  // Validate that arrays exist and have the same length
  if (!speeds || !altitudes || speeds.length === 0 || altitudes.length === 0) {
    return null;
  }

  if (speeds.length !== altitudes.length) {
    return null;
  }

  // Single value case: return the speed regardless of altitude
  if (speeds.length === 1) {
    return Math.round(speeds[0]);
  }

  // Find the two surrounding altitude points
  let lowerIndex = 0;
  let upperIndex = speeds.length - 1;

  // Find the index where altitude falls between two points
  for (let i = 0; i < altitudes.length - 1; i++) {
    if (altitude >= altitudes[i] && altitude <= altitudes[i + 1]) {
      lowerIndex = i;
      upperIndex = i + 1;
      break;
    }
  }

  // Handle extrapolation below minimum altitude
  if (altitude < altitudes[0]) {
    lowerIndex = 0;
    upperIndex = 1;
  }

  // Handle extrapolation above maximum altitude
  if (altitude > altitudes[altitudes.length - 1]) {
    lowerIndex = altitudes.length - 2;
    upperIndex = altitudes.length - 1;
  }

  const alt1 = altitudes[lowerIndex];
  const alt2 = altitudes[upperIndex];
  const speed1 = speeds[lowerIndex];
  const speed2 = speeds[upperIndex];

  // Linear interpolation/extrapolation
  // If altitudes are the same (shouldn't happen, but handle gracefully)
  if (alt2 === alt1) {
    return Math.round(speed1);
  }

  const speed =
    speed1 + ((speed2 - speed1) * (altitude - alt1)) / (alt2 - alt1);
  return Math.round(speed);
}

export {
  farenheitToCelcius,
  celciusToFarenheit,
  pressureAltitudeToDensityAltitude,
  altitudeToPressureAltitude,
  getRateOfClimb,
  calculateVra,
  calculateVx,
};
