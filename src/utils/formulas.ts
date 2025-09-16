// Import types for interpolation
import { type InterpolationTable, type InterpolationOptions, bilinearInterpolate } from './interpolation';

const farenheitToCelcius = (f: number) => ((f - 32) * 5) / 9;
const celciusToFarenheit = (c: number) => (c * 9) / 5 + 32;

const altitudeToPressureAltitude = (altitude: number, altimeter: number) => {
  return altitude + (29.92 - altimeter) * 1000;
}

const pressureAltitudeToDensityAltitude = (
  pressureAltitude: number,
  temperatureC: number
) => {
  const standardTempC = 15 - pressureAltitude / 1000 * 2;
  const densityAltitude =
    pressureAltitude + (120 * (temperatureC - standardTempC));
  return densityAltitude;
}

// Convenience function for rate of climb
function getRateOfClimb(
  table: InterpolationTable,
  pressureAltitude: number,
  outsideAirTemp: number,
  options: InterpolationOptions = {}
): number {
  return Math.round(bilinearInterpolate(table, pressureAltitude, outsideAirTemp, options));
}

export { farenheitToCelcius, celciusToFarenheit, pressureAltitudeToDensityAltitude, altitudeToPressureAltitude };