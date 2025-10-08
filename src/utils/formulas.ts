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
  if (!aircraft || !aircraft.stallSpeeds || !aircraft.stallSpeeds.Vso || aircraft.stallSpeeds.Vso.length === 0) {
    return null;
  }
  
  const vso0Flap = aircraft.stallSpeeds.Vso[0];
  if (vso0Flap === undefined || vso0Flap === null || vso0Flap <= 0) {
    return null;
  }
  
  return Math.round(vso0Flap * 1.7);
}

export {
  farenheitToCelcius,
  celciusToFarenheit,
  pressureAltitudeToDensityAltitude,
  altitudeToPressureAltitude,
  getRateOfClimb,
  calculateVra,
};
