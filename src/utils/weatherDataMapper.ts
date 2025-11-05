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
  WindTempResponse,
} from "./aviationWeatherApi";

// Target altitudes for wind/temperature data mapping
export const TARGET_ALTITUDES = [3000, 6000, 9000, 12000, 15000]; // feet

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
  departureAirport?: string;
  arrivalAirport?: string;
  validateData?: boolean;
}

/**
 * Convert wind/temperature API data to worksheet format
 */
export function mapWindTempData(
  windTempData: WindTempResponse[],
  options: WeatherMappingOptions = {}
): Partial<WorksheetData> {
  const result: Partial<WorksheetData> = {
    wind: [Array(5).fill(0), Array(5).fill(0), Array(5).fill(0)],
  };

  // Group data by altitude
  const altitudeData = new Map<number, WindTempResponse>();
  windTempData.forEach((item) => {
    altitudeData.set(item.altitude, item);
  });

  // Map to target altitudes
  TARGET_ALTITUDES.forEach((targetAlt, index) => {
    // Find closest altitude data
    const closestData = findClosestAltitudeData(altitudeData, targetAlt);

    if (closestData) {
      const windDir = closestData.wdir;
      const windVel = closestData.wspd;
      const temp = closestData.temp;

      // Validate data if requested
      if (options.validateData) {
        if (isValidWindDirection(windDir)) {
          (result.wind![0] as number[])[index] = windDir;
        }
        if (isValidWindSpeed(windVel)) {
          (result.wind![1] as number[])[index] = windVel;
        }
        if (isValidTemperature(temp)) {
          (result.wind![2] as number[])[index] = temp;
        }
      } else {
        (result.wind![0] as number[])[index] = windDir;
        (result.wind![1] as number[])[index] = windVel;
        (result.wind![2] as number[])[index] = temp;
      }
    }
  });

  return result;
}

/**
 * Extract temperature and pressure data from METAR/TAF responses
 */
export function mapTemperaturePressureData(
  metarData: METARResponse[],
  tafData: TAFResponse[],
  options: WeatherMappingOptions = {}
): Partial<WorksheetData> {
  const result: Partial<WorksheetData> = {
    temp: [null, null, null],
    altimeter: [null, null, null],
  };

  // Process METAR data for current conditions
  if (metarData.length > 0) {
    const metar = metarData[0]; // Use first METAR

    if (metar.temp !== undefined) {
      const temp = Math.round(metar.temp);
      if (!options.validateData || isValidTemperature(temp)) {
        result.temp = [temp, temp, temp]; // Same temp for all phases
      }
    }

    if (metar.altim !== undefined) {
      const altimeter = metar.altim;
      if (!options.validateData || isValidAltimeter(altimeter)) {
        result.altimeter = [altimeter, altimeter, altimeter]; // Same pressure for all phases
      }
    }
  }

  // Process TAF data for forecast conditions
  if (tafData.length > 0 && options.flightDate && options.flightTime) {
    const selectedTAF = selectTAFForFlightTime(
      tafData,
      options.flightDate,
      options.flightTime
    );

    if (selectedTAF) {
      if (selectedTAF.temp !== undefined) {
        const temp = Math.round(selectedTAF.temp);
        if (!options.validateData || isValidTemperature(temp)) {
          result.temp = [temp, temp, temp];
        }
      }

      if (selectedTAF.altim !== undefined) {
        const altimeter = selectedTAF.altim;
        if (!options.validateData || isValidAltimeter(altimeter)) {
          result.altimeter = [altimeter, altimeter, altimeter];
        }
      }
    }
  }

  return result;
}

/**
 * Map airport-specific temperature and pressure data for departure and arrival airports
 * Operating values are not updated (manual entry only)
 */
export function mapAirportSpecificWeatherData(
  metarData: METARResponse[],
  tafData: TAFResponse[],
  options: WeatherMappingOptions = {}
): Partial<WorksheetData> {
  const result: Partial<WorksheetData> = {};

  // Ensure metarData and tafData are arrays
  const safeMetarData = Array.isArray(metarData) ? metarData : [];
  const safeTafData = Array.isArray(tafData) ? tafData : [];

  // Process departure airport weather
  if (options.departureAirport) {
    const departureMetar = safeMetarData.find(
      (metar) => metar.icaoId === options.departureAirport
    );

    const departureTAF = safeTafData.find(
      (taf) => taf.icaoId === options.departureAirport
    );

    // Prefer TAF if available and flight is in the future, otherwise use METAR
    let departureTemp: number | undefined;
    let departureAltimeter: number | undefined;

    // First, try to get values from METAR (current conditions)
    if (departureMetar) {
      if (departureMetar.temp !== undefined) {
        departureTemp = departureMetar.temp;
      }
      if (departureMetar.altim !== undefined) {
        // Convert from hectopascals to inches of mercury, rounded to 2 decimal places
        departureAltimeter =
          Math.round(departureMetar.altim * 0.0295299 * 100) / 100;
      }
    }

    // Then, try TAF if available and flight is in the future
    if (departureTAF && options.flightDate && options.flightTime) {
      const selectedTAF = selectTAFForFlightTime(
        [departureTAF],
        options.flightDate,
        options.flightTime
      );

      if (selectedTAF) {
        // Only use TAF values if they are defined (TAF values are optional)
        if (selectedTAF.temp !== undefined) {
          departureTemp = selectedTAF.temp;
        }
        if (selectedTAF.altim !== undefined) {
          departureAltimeter = selectedTAF.altim;
        }
      }
    }

    // Update departure values if available
    if (departureTemp !== undefined) {
      const temp = Math.round(departureTemp);
      if (!options.validateData || isValidTemperature(temp)) {
        if (!result.temp) {
          result.temp = [-1, -1, -1]; // Initialize with placeholders
        }
        result.temp[0] = temp; // departure
      }
    }

    if (departureAltimeter !== undefined) {
      if (!options.validateData || isValidAltimeter(departureAltimeter)) {
        // Only create the array if it doesn't exist, but don't set all defaults
        if (!result.altimeter) {
          // Create array with -1 as placeholder for positions we don't have data for
          result.altimeter = [-1, -1, -1];
        }
        result.altimeter[0] = departureAltimeter; // departure
      }
    }
  }

  // Process arrival airport weather
  if (options.arrivalAirport) {
    const arrivalMetar = safeMetarData.find(
      (metar) => metar.icaoId === options.arrivalAirport
    );

    const arrivalTAF = safeTafData.find(
      (taf) => taf.icaoId === options.arrivalAirport
    );

    // Prefer TAF if available and flight is in the future, otherwise use METAR
    let arrivalTemp: number | undefined;
    let arrivalAltimeter: number | undefined;

    // First, try to get values from METAR (current conditions)
    if (arrivalMetar) {
      if (arrivalMetar.temp !== undefined) {
        arrivalTemp = arrivalMetar.temp;
      }
      if (arrivalMetar.altim !== undefined) {
        // Convert from hectopascals to inches of mercury, rounded to 2 decimal places
        arrivalAltimeter =
          Math.round(arrivalMetar.altim * 0.0295299 * 100) / 100;
      }
    }

    // Then, try TAF if available and flight is in the future
    if (arrivalTAF && options.flightDate && options.flightTime) {
      const selectedTAF = selectTAFForFlightTime(
        [arrivalTAF],
        options.flightDate,
        options.flightTime
      );

      if (selectedTAF) {
        // Only use TAF values if they are defined (TAF values are optional)
        if (selectedTAF.temp !== undefined) {
          arrivalTemp = selectedTAF.temp;
        }
        if (selectedTAF.altim !== undefined) {
          arrivalAltimeter = selectedTAF.altim;
        }
      }
    }

    // Update arrival values if available
    if (arrivalTemp !== undefined) {
      const temp = Math.round(arrivalTemp);
      if (!options.validateData || isValidTemperature(temp)) {
        if (!result.temp) {
          result.temp = [-1, -1, -1]; // Initialize with placeholders
        }
        result.temp[2] = temp; // arrival
      }
    }

    if (arrivalAltimeter !== undefined) {
      if (!options.validateData || isValidAltimeter(arrivalAltimeter)) {
        // Only create the array if it doesn't exist, but don't set all defaults
        if (!result.altimeter) {
          // Create array with -1 as placeholder for positions we don't have data for
          result.altimeter = [-1, -1, -1];
        }
        result.altimeter[2] = arrivalAltimeter; // arrival
      }
    }
  }

  return result;
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
    windTemp?: WindTempResponse[];
  },
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
    const windTempData = Array.isArray(apiData.windTemp) ? apiData.windTemp : [];
    const metarData = Array.isArray(apiData.metar) ? apiData.metar : [];
    const tafData = Array.isArray(apiData.taf) ? apiData.taf : [];
    const airportData = Array.isArray(apiData.airport) ? apiData.airport : [];
    
    // Map wind/temperature data
    if (windTempData.length > 0) {
      const windData = mapWindTempData(windTempData, options);
      result.data = { ...result.data, ...windData };
    } else {
      result.warnings.push("No wind/temperature data available");
    }

    // Map airport-specific temperature and pressure data
    if (metarData.length > 0 || tafData.length > 0) {
      const airportWeatherData = mapAirportSpecificWeatherData(
        metarData,
        tafData,
        options
      );
      result.data = { ...result.data, ...airportWeatherData };
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
 * Helper function to find closest altitude data with interpolation support
 */
function findClosestAltitudeData(
  altitudeData: Map<number, WindTempResponse>,
  targetAltitude: number
): WindTempResponse | null {
  const altitudes = Array.from(altitudeData.keys()).sort((a, b) => a - b);

  // Find the two closest altitudes
  let lowerAltitude: number | null = null;
  let upperAltitude: number | null = null;

  for (const alt of altitudes) {
    if (alt <= targetAltitude) {
      lowerAltitude = alt;
    } else if (alt > targetAltitude && upperAltitude === null) {
      upperAltitude = alt;
      break;
    }
  }

  // If we have both lower and upper altitudes, interpolate
  if (lowerAltitude !== null && upperAltitude !== null) {
    const lowerData = altitudeData.get(lowerAltitude)!;
    const upperData = altitudeData.get(upperAltitude)!;

    // Calculate interpolation factor (0 = lower altitude, 1 = upper altitude)
    const factor =
      (targetAltitude - lowerAltitude) / (upperAltitude - lowerAltitude);

    // Interpolate wind direction (handle wraparound at 360 degrees)
    const lowerWdir = lowerData.wdir;
    const upperWdir = upperData.wdir;
    let interpolatedWdir: number;

    if (Math.abs(upperWdir - lowerWdir) > 180) {
      // Handle wraparound case
      if (upperWdir > lowerWdir) {
        interpolatedWdir =
          ((lowerWdir + 360) * (1 - factor) + upperWdir * factor) % 360;
      } else {
        interpolatedWdir =
          (lowerWdir * (1 - factor) + (upperWdir + 360) * factor) % 360;
      }
    } else {
      interpolatedWdir = lowerWdir * (1 - factor) + upperWdir * factor;
    }

    // Interpolate wind speed and temperature (linear)
    const interpolatedWspd =
      lowerData.wspd * (1 - factor) + upperData.wspd * factor;
    const interpolatedTemp =
      lowerData.temp * (1 - factor) + upperData.temp * factor;

    return {
      icaoId: lowerData.icaoId,
      altitude: targetAltitude,
      wdir: Math.round(interpolatedWdir),
      wspd: Math.round(interpolatedWspd),
      temp: Math.round(interpolatedTemp),
      pressure: lowerData.pressure, // Use lower altitude pressure
      validTime: lowerData.validTime, // Use lower altitude validTime
    };
  }

  // Fallback to closest altitude if interpolation isn't possible
  let closest: WindTempResponse | null = null;
  let minDifference = Infinity;

  for (const [altitude, data] of altitudeData) {
    const difference = Math.abs(altitude - targetAltitude);
    if (difference < minDifference) {
      minDifference = difference;
      closest = data;
    }
  }

  // Only return data if it's within 2000 feet of target altitude
  return minDifference <= 2000 ? closest : null;
}

/**
 * Select appropriate TAF data based on flight time
 */
function selectTAFForFlightTime(
  tafData: TAFResponse[],
  flightDate: string,
  flightTime: string
): TAFResponse | null {
  if (tafData.length === 0) return null;

  try {
    const flightDateTime = new Date(`${flightDate}T${flightTime}:00`);

    // Find TAF that covers the flight time
    for (const taf of tafData) {
      const validTime = new Date(taf.validTime);
      const validTimeEnd = taf.validTimeEnd ? new Date(taf.validTimeEnd) : null;

      if (
        flightDateTime >= validTime &&
        (!validTimeEnd || flightDateTime <= validTimeEnd)
      ) {
        return taf;
      }
    }

    // If no exact match, return the most recent TAF
    return tafData[tafData.length - 1];
  } catch (error) {
    console.warn("Error parsing flight date/time:", error);
    return tafData[0]; // Return first TAF as fallback
  }
}

/**
 * Find the shortest runway from airport runway data, excluding helipads
 * Helipads have a null alignment value and should be excluded
 */
function findShortestRunway(
  runways: { length: number; alignment?: number | null }[]
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
    data.wind[0].forEach((dir, index) => {
      if (dir !== 0 && !isValidWindDirection(dir)) {
        errors.push(
          `Invalid wind direction at altitude ${TARGET_ALTITUDES[index]}ft: ${dir}`
        );
      }
    });

    data.wind[1].forEach((speed, index) => {
      if (speed !== 0 && !isValidWindSpeed(speed)) {
        errors.push(
          `Invalid wind speed at altitude ${TARGET_ALTITUDES[index]}ft: ${speed}`
        );
      }
    });

    data.wind[2].forEach((temp, index) => {
      if (temp !== 0 && !isValidTemperature(temp)) {
        errors.push(
          `Invalid temperature at altitude ${TARGET_ALTITUDES[index]}ft: ${temp}`
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
      data.wind[0].some((val) => val !== 0)
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
    // Only update departure (index 0) and arrival (index 2) temperatures, preserve operating (index 1)
    if (result.temp && apiData.temp) {
      // Preserve existing operating temperature
      const existingOperatingTemp = result.temp[1];

      // Update only departure and arrival temperatures (ignore placeholder -1)
      if (apiData.temp[0] !== undefined && apiData.temp[0] !== -1) {
        result.temp[0] = apiData.temp[0]; // departure
      }
      if (apiData.temp[2] !== undefined && apiData.temp[2] !== -1) {
        result.temp[2] = apiData.temp[2]; // arrival
      }

      // Ensure operating temperature is preserved (manual entry only)
      // Only restore if it wasn't a placeholder
      if (existingOperatingTemp !== -1) {
        result.temp[1] = existingOperatingTemp;
      }
    } else {
      result.temp = apiData.temp;
    }
  }

  if (apiData.altimeter) {
    // Only update departure (index 0) and arrival (index 2) altimeters, preserve operating (index 1)
    if (result.altimeter && apiData.altimeter) {
      // Preserve existing operating altimeter
      const existingOperatingAltimeter = result.altimeter[1];

      // Update only departure and arrival altimeters (ignore placeholder -1)
      if (apiData.altimeter[0] !== undefined && apiData.altimeter[0] !== -1) {
        result.altimeter[0] = apiData.altimeter[0]; // departure
      }
      if (apiData.altimeter[2] !== undefined && apiData.altimeter[2] !== -1) {
        result.altimeter[2] = apiData.altimeter[2]; // arrival
      }

      // Ensure operating altimeter is preserved (manual entry only)
      // Only restore if it wasn't a placeholder
      if (existingOperatingAltimeter !== -1) {
        result.altimeter[1] = existingOperatingAltimeter;
      }
    } else {
      // No existing altimeter data, use API data as-is (including placeholders)
      // The operating altimeter (index 1) will be a placeholder -1 if not provided
      result.altimeter = apiData.altimeter;
    }
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

  return result;
}
