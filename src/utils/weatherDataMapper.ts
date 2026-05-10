/**
 * Weather Data Mapping and Validation
 *
 * This module provides functions to convert AviationWeather.gov API responses
 * to WorksheetData format, with proper validation and data transformation.
 */

import type { WorksheetData } from "./types";
import type {
  METARResponse,
  TAFResponse,
  AirportResponse,
} from "./aviationWeatherApi";
import { selectAirportWeather } from "./airportTimeWeather";
import type { AreaOfOpsWeather } from "./areaOfOpsWeather";
import { TARGET_ALTITUDES_FT } from "./areaOfOpsWeather";

// Validation ranges
export const VALIDATION_RANGES = {
  windDirection: { min: 0, max: 359 },
  windSpeed: { min: 0, max: 150 },
  temperature: { min: -50, max: 50 },
  altimeter: { min: 28.0, max: 31.0 },
  runwayLength: { min: 1000, max: 20000 }, // Increased to accommodate major airports like KDEN (16000 ft)
  pressure: { min: 20.0, max: 35.0 },
};

export interface WeatherMappingResult {
  success: boolean;
  data: Partial<WorksheetData>;
  errors: string[];
  warnings: string[];
}

export interface WeatherMappingOptions {
  flightDate?: string; // ISO date string
  flightTime?: string; // HH:MM format
  durationHours?: number | null;
  departureAirport?: string;
  arrivalAirport?: string;
  position?: [number | null, number | null];
  opAltitudeFt?: number | null;
  validateData?: boolean;
}

/**
 * Map airport-specific temperature and pressure data for departure and arrival airports
 * using per-airport requested time. Operating values are not updated (manual entry only).
 */
export function mapAirportSpecificWeatherData(
  metarData: METARResponse[],
  tafData: TAFResponse[],
  options: WeatherMappingOptions = {}
): { data: Partial<WorksheetData>; warnings: string[] } {
  const result: Partial<WorksheetData> = {};
  const warnings: string[] = [];

  const safeMetar = Array.isArray(metarData) ? metarData : [];
  const safeTaf = Array.isArray(tafData) ? tafData : [];

  if (!options.flightDate || !options.flightTime) {
    return { data: result, warnings };
  }

  const depTime = new Date(`${options.flightDate}T${options.flightTime}:00Z`);
  if (Number.isNaN(depTime.getTime())) {
    return { data: result, warnings };
  }
  const durationHours =
    typeof options.durationHours === "number" &&
    Number.isFinite(options.durationHours) &&
    options.durationHours > 0
      ? options.durationHours
      : 0;
  const arrTime = new Date(depTime.getTime() + durationHours * 3600 * 1000);

  const applyAirportWeather = (
    airportCode: string | undefined,
    requestedTime: Date,
    index: 0 | 2
  ): void => {
    if (!airportCode) return;
    const code = airportCode.toUpperCase();
    const metar = safeMetar.find((m) => m.icaoId?.toUpperCase() === code);
    const taf = safeTaf.find((t) => t.icaoId?.toUpperCase() === code);
    const sel = selectAirportWeather(metar, taf, requestedTime);
    warnings.push(...sel.warnings);
    if (sel.temp !== null) {
      const temp = sel.temp;
      if (!options.validateData || isValidTemperature(temp)) {
        if (!result.temp) result.temp = [-1, -1, -1];
        result.temp[index] = temp;
      }
    }
    if (sel.altimeter !== null) {
      if (!options.validateData || isValidAltimeter(sel.altimeter)) {
        if (!result.altimeter) result.altimeter = [-1, -1, -1];
        result.altimeter[index] = sel.altimeter;
      }
    }
  };

  applyAirportWeather(options.departureAirport, depTime, 0);
  applyAirportWeather(options.arrivalAirport, arrTime, 2);

  return { data: result, warnings };
}

/**
 * Extract runway data from airport information
 */
export function mapRunwayData(
  airportData: AirportResponse[],
  options: WeatherMappingOptions = {}
): Partial<WorksheetData> {
  const result: Partial<WorksheetData> = {
    rwy: [null, null],
  };

  if (airportData.length === 0) {
    return result;
  }

  // Process departure airport
  if (options.departureAirport) {
    const departureAirportCode = options.departureAirport.toUpperCase();
    const departureAirport = airportData.find(
      (airport) => airport.icaoId?.toUpperCase() === departureAirportCode
    );

    if (departureAirport?.runway) {
      const shortestRunway = findShortestRunway(departureAirport.runway);
      if (
        shortestRunway &&
        (!options.validateData || isValidRunwayLength(shortestRunway.length))
      ) {
        result.rwy![0] = shortestRunway.length;
      }
    }
  }

  // Process arrival airport
  if (options.arrivalAirport) {
    const arrivalAirportCode = options.arrivalAirport.toUpperCase();
    const arrivalAirport = airportData.find(
      (airport) => airport.icaoId?.toUpperCase() === arrivalAirportCode
    );

    if (arrivalAirport?.runway) {
      const shortestRunway = findShortestRunway(arrivalAirport.runway);
      if (
        shortestRunway &&
        (!options.validateData || isValidRunwayLength(shortestRunway.length))
      ) {
        result.rwy![1] = shortestRunway.length;
      }
    }
  }

  return result;
}

/**
 * Map airport elevation data to worksheet format
 */
export function mapAirportElevationData(
  airportData: AirportResponse[],
  options: WeatherMappingOptions = {}
): Partial<WorksheetData> {
  const result: Partial<WorksheetData> = {};

  if (airportData.length === 0) {
    return result;
  }

  // Only set altitude values for departure and arrival, leave operating altitude untouched
  const altitudeUpdates: (number | undefined)[] = [];

  // Process departure airport elevation (altitude[0])
  if (options.departureAirport) {
    const departureAirport = airportData.find(
      (airport) => airport.icaoId === options.departureAirport
    );

    if (departureAirport?.elev) {
      // Convert elevation from meters to feet (1 meter = 3.28084 feet)
      altitudeUpdates[0] = Math.round(departureAirport.elev * 3.28084);
    }
  }

  // Process arrival airport elevation (altitude[2])
  if (options.arrivalAirport) {
    const arrivalAirport = airportData.find(
      (airport) => airport.icaoId === options.arrivalAirport
    );

    if (arrivalAirport?.elev) {
      // Convert elevation from meters to feet (1 meter = 3.28084 feet)
      altitudeUpdates[2] = Math.round(arrivalAirport.elev * 3.28084);
    }
  }

  // Only set altitude if we have updates
  if (altitudeUpdates.some((val) => val !== undefined)) {
    // Convert sparse array to fixed 3-element array
    result.altitude = [
      altitudeUpdates[0] ?? null, // departure
      -1, // operating (special value to indicate "don't update")
      altitudeUpdates[2] ?? null, // arrival
    ];
  }

  return result;
}

/**
 * Map all weather data from API responses to WorksheetData format
 */
export function mapWeatherDataToWorksheet(
  apiData: {
    metar?: METARResponse[];
    taf?: TAFResponse[];
    airport?: AirportResponse[];
  },
  areaOfOps: AreaOfOpsWeather | null,
  airmets: import("./gairmetApi").AirmetClassification | null,
  options: WeatherMappingOptions = {}
): WeatherMappingResult {
  const result: WeatherMappingResult = {
    success: true,
    data: {},
    errors: [],
    warnings: [],
  };

  try {
    // Ensure all data types are arrays before processing
    const metarData = Array.isArray(apiData.metar) ? apiData.metar : [];
    const tafData = Array.isArray(apiData.taf) ? apiData.taf : [];
    const airportData = Array.isArray(apiData.airport) ? apiData.airport : [];

    // Wind/temperature data is now supplied exclusively via areaOfOps (Open-Meteo)
    if (!areaOfOps) {
      result.warnings.push("No wind/temperature data available");
    }

    // Map airport-specific temperature and pressure data
    if (metarData.length > 0 || tafData.length > 0) {
      const { data: airportWeatherData, warnings: airportWarnings } =
        mapAirportSpecificWeatherData(metarData, tafData, options);
      result.data = { ...result.data, ...airportWeatherData };
      result.warnings.push(...airportWarnings);
    } else {
      result.warnings.push(
        "No METAR/TAF data available for airport-specific temperature/pressure"
      );
    }

    // Map runway data
    if (airportData.length > 0) {
      const runwayData = mapRunwayData(airportData, options);
      result.data = { ...result.data, ...runwayData };
    } else {
      result.warnings.push("No airport data available for runway information");
    }

    // Map airport elevation data
    if (airportData.length > 0) {
      const elevationData = mapAirportElevationData(airportData, options);
      result.data = { ...result.data, ...elevationData };
    }

    // Apply area-of-ops weather (Open-Meteo) winds and operating conditions
    if (areaOfOps) {
      if (areaOfOps.windsAloft.direction.some((v) => v !== null)) {
        result.data.wind = [
          areaOfOps.windsAloft.direction,
          areaOfOps.windsAloft.speed,
          areaOfOps.windsAloft.temp,
        ];
      }
      if (areaOfOps.opTemp !== null) {
        if (!options.validateData || isValidTemperature(areaOfOps.opTemp)) {
          if (!result.data.temp) result.data.temp = [-1, -1, -1];
          result.data.temp[1] = areaOfOps.opTemp;
        } else {
          result.warnings.push(
            `Operating temperature ${areaOfOps.opTemp}°C out of valid range; skipped`
          );
        }
      }
      if (areaOfOps.opAltimeter !== null) {
        if (!options.validateData || isValidAltimeter(areaOfOps.opAltimeter)) {
          if (!result.data.altimeter) result.data.altimeter = [-1, -1, -1];
          result.data.altimeter[1] = areaOfOps.opAltimeter;
        } else {
          result.warnings.push(
            `Operating altimeter ${areaOfOps.opAltimeter} inHg out of valid range; skipped`
          );
        }
      }
      result.warnings.push(...areaOfOps.warnings);
    }

    // Apply G-AIRMET classification results
    if (airmets) {
      if (airmets.turb !== null)
        (result.data as Partial<WorksheetData>).turb = airmets.turb;
      if (airmets.cielVis !== null)
        (result.data as Partial<WorksheetData>).cielVis = airmets.cielVis;
      if (airmets.mtnObsc !== null)
        (result.data as Partial<WorksheetData>).mtnObsc = airmets.mtnObsc;
      result.warnings.push(...airmets.warnings);
    }

    // Validate mapped data
    if (options.validateData) {
      const validationResult = validateMappedData(result.data);
      result.errors.push(...validationResult.errors);
      result.warnings.push(...validationResult.warnings);
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      `Mapping error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  return result;
}

/**
 * Find the shortest runway from airport runway data, excluding helipads
 * Helipads have a null alignment value and should be excluded
 */
function findShortestRunway(
  runways: { length: number; alignment: number | null }[]
): { length: number } | null {
  if (!runways || runways.length === 0) return null;

  // Filter out helipads (runways with null alignment)
  const validRunways = runways.filter((runway) => runway.alignment !== null);

  if (validRunways.length === 0) return null;

  return validRunways.reduce<{ length: number } | null>((shortest, current) => {
    if (!shortest || current.length < shortest.length) {
      return current;
    }
    return shortest;
  }, null);
}

/**
 * Validation functions
 */
function isValidWindDirection(direction: number): boolean {
  return (
    Number.isInteger(direction) &&
    direction >= VALIDATION_RANGES.windDirection.min &&
    direction <= VALIDATION_RANGES.windDirection.max
  );
}

function isValidWindSpeed(speed: number): boolean {
  return (
    Number.isInteger(speed) &&
    speed >= VALIDATION_RANGES.windSpeed.min &&
    speed <= VALIDATION_RANGES.windSpeed.max
  );
}

function isValidTemperature(temp: number): boolean {
  return (
    Number.isInteger(temp) &&
    temp >= VALIDATION_RANGES.temperature.min &&
    temp <= VALIDATION_RANGES.temperature.max
  );
}

function isValidAltimeter(altimeter: number): boolean {
  return (
    altimeter >= VALIDATION_RANGES.altimeter.min &&
    altimeter <= VALIDATION_RANGES.altimeter.max
  );
}

function isValidRunwayLength(length: number): boolean {
  return (
    Number.isInteger(length) &&
    length >= VALIDATION_RANGES.runwayLength.min &&
    length <= VALIDATION_RANGES.runwayLength.max
  );
}

/**
 * Validate mapped data against expected ranges
 */
function validateMappedData(data: Partial<WorksheetData>): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate wind data
  if (data.wind) {
    const altLabel = (index: number): string => {
      const ft = TARGET_ALTITUDES_FT[index];
      return ft ? `${ft} ft` : `column ${index}`;
    };

    data.wind[0].forEach((dir, index) => {
      if (dir !== null && dir !== undefined && !isValidWindDirection(dir)) {
        errors.push(
          `Invalid wind direction at ${altLabel(index)}: ${dir}`
        );
      }
    });

    data.wind[1].forEach((speed, index) => {
      if (speed !== null && speed !== undefined && !isValidWindSpeed(speed)) {
        errors.push(
          `Invalid wind speed at ${altLabel(index)}: ${speed}`
        );
      }
    });

    data.wind[2].forEach((temp, index) => {
      if (temp !== null && temp !== undefined && !isValidTemperature(temp)) {
        errors.push(
          `Invalid temperature at ${altLabel(index)}: ${temp}`
        );
      }
    });
  }

  // Validate temperature data
  if (data.temp) {
    data.temp.forEach((temp, index) => {
      if (temp !== null && !isValidTemperature(temp)) {
        errors.push(`Invalid temperature for phase ${index}: ${temp}`);
      }
    });
  }

  // Validate altimeter data
  if (data.altimeter) {
    data.altimeter.forEach((altimeter, index) => {
      if (altimeter !== null && !isValidAltimeter(altimeter)) {
        errors.push(
          `Invalid altimeter setting for phase ${index}: ${altimeter}`
        );
      }
    });
  }

  // Validate runway data
  if (data.rwy) {
    data.rwy.forEach((runway, index) => {
      if (runway !== null && !isValidRunwayLength(runway)) {
        errors.push(`Invalid runway length for phase ${index}: ${runway}ft`);
      }
    });
  }

  return { errors, warnings };
}

/**
 * Utility function to check if data was populated from API
 */
export function isApiPopulatedData(data: Partial<WorksheetData>): {
  wind: boolean;
  temperature: boolean;
  pressure: boolean;
  runway: boolean;
  altitude: boolean;
} {
  return {
    wind: !!(
      data.wind &&
      Array.isArray(data.wind[0]) &&
      data.wind[0].some((val) => val !== null && val !== undefined)
    ),
    temperature: !!(
      data.temp &&
      Array.isArray(data.temp) &&
      ((data.temp[0] !== null && data.temp[0] !== undefined) || // departure
        (data.temp[2] !== null && data.temp[2] !== undefined)) // arrival
    ),
    pressure: !!(
      data.altimeter &&
      Array.isArray(data.altimeter) &&
      ((data.altimeter[0] !== null && data.altimeter[0] !== undefined) ||
        (data.altimeter[2] !== null && data.altimeter[2] !== undefined))
    ),
    runway: !!(
      data.rwy &&
      Array.isArray(data.rwy) &&
      data.rwy.some((val) => val !== null)
    ),
    altitude: !!(
      data.altitude &&
      Array.isArray(data.altitude) &&
      ((data.altitude[0] !== null && data.altitude[0] !== undefined) || // departure
        (data.altitude[2] !== null && data.altitude[2] !== undefined)) // arrival
    ),
  };
}

/**
 * Merge API data with existing worksheet data, preserving user modifications
 */
export function mergeWeatherData(
  existingData: Partial<WorksheetData>,
  apiData: Partial<WorksheetData>,
  preserveUserData: boolean = true
): Partial<WorksheetData> {
  const result = { ...existingData };

  if (!preserveUserData) {
    return { ...result, ...apiData };
  }

  // Always overwrite with API data when available
  if (apiData.wind) {
    result.wind = apiData.wind;
  }

  if (apiData.temp) {
    if (!result.temp) result.temp = [null, null, null];
    apiData.temp.forEach((val, i) => {
      if (val !== undefined && val !== -1) {
        result.temp![i] = val;
      }
    });
  }

  if (apiData.altimeter) {
    if (!result.altimeter) result.altimeter = [null, null, null];
    apiData.altimeter.forEach((val, i) => {
      if (val !== undefined && val !== -1) {
        result.altimeter![i] = val;
      }
    });
  }

  if (apiData.rwy) {
    result.rwy = apiData.rwy;
  }

  if (apiData.altitude) {
    // Only update departure (index 0) and arrival (index 2) altitudes, preserve operating (index 1)
    if (result.altitude && apiData.altitude) {
      // Preserve existing operating altitude
      const existingOperatingAltitude = result.altitude[1];

      // Update only departure and arrival altitudes
      if (apiData.altitude[0] !== undefined) {
        result.altitude[0] = apiData.altitude[0]; // departure
      }
      if (apiData.altitude[2] !== undefined) {
        result.altitude[2] = apiData.altitude[2]; // arrival
      }

      // Don't update operating altitude if it's -1 (special value indicating "don't update")
      if (apiData.altitude[1] !== -1) {
        result.altitude[1] = apiData.altitude[1];
      }

      // Ensure operating altitude is preserved
      result.altitude[1] = existingOperatingAltitude;
    } else {
      result.altitude = apiData.altitude;
    }
  }

  // AIRMET boolean flags: only overwrite when the API supplied an explicit
  // boolean. Anything else (undefined / null sentinel for "data unavailable")
  // leaves the existing value alone.
  if (typeof apiData.turb === "boolean") result.turb = apiData.turb;
  if (typeof apiData.cielVis === "boolean") result.cielVis = apiData.cielVis;
  if (typeof apiData.mtnObsc === "boolean") result.mtnObsc = apiData.mtnObsc;

  return result;
}
