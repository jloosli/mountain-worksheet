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
  runwayLength: { min: 1000, max: 15000 },
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
    temp: [21, 21, 21], // Default values
    altimeter: [29.92, 29.92, 29.92], // Default values
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
    const selectedTAF = selectTAFForFlightTime(tafData, options.flightDate, options.flightTime);
    
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
    const departureAirport = airportData.find(
      (airport) => airport.icaoId === options.departureAirport
    );
    
    if (departureAirport?.runway) {
      const longestRunway = findLongestRunway(departureAirport.runway);
      if (longestRunway && (!options.validateData || isValidRunwayLength(longestRunway.length))) {
        result.rwy![0] = longestRunway.length;
      }
    }
  }

  // Process arrival airport
  if (options.arrivalAirport) {
    const arrivalAirport = airportData.find(
      (airport) => airport.icaoId === options.arrivalAirport
    );
    
    if (arrivalAirport?.runway) {
      const longestRunway = findLongestRunway(arrivalAirport.runway);
      if (longestRunway && (!options.validateData || isValidRunwayLength(longestRunway.length))) {
        result.rwy![1] = longestRunway.length;
      }
    }
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
    // Map wind/temperature data
    if (apiData.windTemp && apiData.windTemp.length > 0) {
      const windData = mapWindTempData(apiData.windTemp, options);
      result.data = { ...result.data, ...windData };
    } else {
      result.warnings.push("No wind/temperature data available");
    }

    // Map temperature and pressure data
    if (apiData.metar || apiData.taf) {
      const tempPressureData = mapTemperaturePressureData(
        apiData.metar || [],
        apiData.taf || [],
        options
      );
      result.data = { ...result.data, ...tempPressureData };
    } else {
      result.warnings.push("No METAR/TAF data available for temperature/pressure");
    }

    // Map runway data
    if (apiData.airport && apiData.airport.length > 0) {
      const runwayData = mapRunwayData(apiData.airport, options);
      result.data = { ...result.data, ...runwayData };
    } else {
      result.warnings.push("No airport data available for runway information");
    }

    // Validate mapped data
    if (options.validateData) {
      const validationResult = validateMappedData(result.data);
      result.errors.push(...validationResult.errors);
      result.warnings.push(...validationResult.warnings);
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Mapping error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Helper function to find closest altitude data
 */
function findClosestAltitudeData(
  altitudeData: Map<number, WindTempResponse>,
  targetAltitude: number
): WindTempResponse | null {
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
      
      if (flightDateTime >= validTime && (!validTimeEnd || flightDateTime <= validTimeEnd)) {
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
 * Find the longest runway from airport runway data
 */
function findLongestRunway(runways: any[]): any | null {
  if (!runways || runways.length === 0) return null;

  return runways.reduce((longest, current) => {
    if (!longest || current.length > longest.length) {
      return current;
    }
    return longest;
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
        errors.push(`Invalid wind direction at altitude ${TARGET_ALTITUDES[index]}ft: ${dir}`);
      }
    });

    data.wind[1].forEach((speed, index) => {
      if (speed !== 0 && !isValidWindSpeed(speed)) {
        errors.push(`Invalid wind speed at altitude ${TARGET_ALTITUDES[index]}ft: ${speed}`);
      }
    });

    data.wind[2].forEach((temp, index) => {
      if (temp !== 0 && !isValidTemperature(temp)) {
        errors.push(`Invalid temperature at altitude ${TARGET_ALTITUDES[index]}ft: ${temp}`);
      }
    });
  }

  // Validate temperature data
  if (data.temp) {
    data.temp.forEach((temp, index) => {
      if (!isValidTemperature(temp)) {
        errors.push(`Invalid temperature for phase ${index}: ${temp}`);
      }
    });
  }

  // Validate altimeter data
  if (data.altimeter) {
    data.altimeter.forEach((altimeter, index) => {
      if (!isValidAltimeter(altimeter)) {
        errors.push(`Invalid altimeter setting for phase ${index}: ${altimeter}`);
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
} {
  return {
    wind: !!(data.wind && data.wind[0].some(val => val !== 0)),
    temperature: !!(data.temp && data.temp.some(val => val !== 21)),
    pressure: !!(data.altimeter && data.altimeter.some(val => val !== 29.92)),
    runway: !!(data.rwy && data.rwy.some(val => val !== null)),
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

  // Only update fields that are empty or have default values
  if (apiData.wind && result.wind) {
    apiData.wind.forEach((apiArray, arrayIndex) => {
      apiArray.forEach((apiValue, valueIndex) => {
        const existingValue = result.wind![arrayIndex][valueIndex];
        // Only update if existing value is 0 (default) or API has valid data
        if (existingValue === 0 && apiValue !== 0) {
          result.wind![arrayIndex][valueIndex] = apiValue;
        }
      });
    });
  }

  if (apiData.temp && result.temp) {
    apiData.temp.forEach((apiValue, index) => {
      const existingValue = result.temp![index];
      // Only update if existing value is default (21) or API has different valid data
      if (existingValue === 21 && apiValue !== 21) {
        result.temp![index] = apiValue;
      }
    });
  }

  if (apiData.altimeter && result.altimeter) {
    apiData.altimeter.forEach((apiValue, index) => {
      const existingValue = result.altimeter![index];
      // Only update if existing value is default (29.92) or API has different valid data
      if (existingValue === 29.92 && apiValue !== 29.92) {
        result.altimeter![index] = apiValue;
      }
    });
  }

  if (apiData.rwy && result.rwy) {
    apiData.rwy.forEach((apiValue, index) => {
      const existingValue = result.rwy![index];
      // Only update if existing value is null or API has valid data
      if (existingValue === null && apiValue !== null) {
        result.rwy![index] = apiValue;
      }
    });
  }

  return result;
}
