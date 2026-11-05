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
import type { AirmetClassification } from "./gairmetApi";
import {
  fieldSubject,
  subjectKey,
  type Notification,
  type Subject,
} from "./notifications";

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
  /**
   * Values to merge into the worksheet. A field the fetch was expected to
   * fill but couldn't is `null` (blank) — never left holding an earlier
   * fetch's value. `-1` in an array slot means "don't update".
   */
  data: Partial<WorksheetData>;
  /** Every notification raised by the fetch, each with its Subject. */
  notifications: Notification[];
}

/**
 * What an airport's identity means for the fields it fills (#216):
 * - `unknown`: matches nothing; elevation, runway and weather need input.
 * - `non-reporting`: exists but publishes no METAR/TAF; weather needs input.
 * Either way those fields are left blank without a Warning, since the
 * airport's own notification already says why.
 */
export type AirportCondition = "unknown" | "non-reporting";

export interface WeatherMappingOptions {
  flightDate?: string; // ISO date string
  flightTime?: string; // HH:MM format
  durationHours?: number | null;
  departureAirport?: string;
  arrivalAirport?: string;
  airportConditions?: {
    departure?: AirportCondition;
    arrival?: AirportCondition;
  };
  position?: [number | null, number | null];
  opAltitudeFt?: number | null;
  validateData?: boolean;
}

/** The identity condition of the airport filling triple slot 0 or 2. */
function conditionOf(
  options: WeatherMappingOptions,
  slot: 0 | 2
): AirportCondition | undefined {
  return slot === 0
    ? options.airportConditions?.departure
    : options.airportConditions?.arrival;
}

/**
 * Map airport-specific temperature and pressure data for departure and arrival airports
 * using per-airport requested time. Operating values are not updated (manual entry only).
 */
export function mapAirportSpecificWeatherData(
  metarData: METARResponse[],
  tafData: TAFResponse[],
  options: WeatherMappingOptions = {}
): { data: Partial<WorksheetData>; notifications: Notification[] } {
  const result: Partial<WorksheetData> = {};
  const notifications: Notification[] = [];

  const safeMetar = Array.isArray(metarData) ? metarData : [];
  const safeTaf = Array.isArray(tafData) ? tafData : [];

  if (!options.flightDate || !options.flightTime) {
    return { data: result, notifications };
  }

  const depTime = new Date(`${options.flightDate}T${options.flightTime}:00Z`);
  if (Number.isNaN(depTime.getTime())) {
    return { data: result, notifications };
  }
  const durationHours =
    typeof options.durationHours === "number" &&
    Number.isFinite(options.durationHours) &&
    options.durationHours > 0
      ? options.durationHours
      : 0;
  const arrTime = new Date(depTime.getTime() + durationHours * 3600 * 1000);

  const setSlot = (
    key: "temp" | "altimeter",
    index: 0 | 2,
    value: number | null
  ) => {
    const next = (result[key] ? [...result[key]!] : [-1, -1, -1]) as [
      number | null,
      number | null,
      number | null,
    ];
    next[index] = value;
    result[key] = next;
  };

  const applyAirportWeather = (
    airportCode: string | undefined,
    requestedTime: Date,
    index: 0 | 2
  ): void => {
    if (!airportCode) return;
    if (conditionOf(options, index)) {
      setSlot("temp", index, null);
      setSlot("altimeter", index, null);
      return;
    }
    const code = airportCode.toUpperCase();
    const metar = safeMetar.find((m) => m.icaoId?.toUpperCase() === code);
    const taf = safeTaf.find((t) => t.icaoId?.toUpperCase() === code);
    const sel = selectAirportWeather(metar, taf, requestedTime, code, index);
    notifications.push(...sel.notifications);
    const label = index === 0 ? "Departure" : "Arrival";

    let temp = sel.temp;
    if (temp !== null && options.validateData && !isValidTemperature(temp)) {
      notifications.push({
        level: "warning",
        subject: fieldSubject("temp", index),
        message: `${label} temperature ${temp}°C from ${code} is out of valid range; not applied`,
      });
      temp = null;
    }
    setSlot("temp", index, temp);

    let altimeter = sel.altimeter;
    if (
      altimeter !== null &&
      options.validateData &&
      !isValidAltimeter(altimeter)
    ) {
      notifications.push({
        level: "warning",
        subject: fieldSubject("altimeter", index),
        message: `${label} altimeter ${altimeter} inHg from ${code} is out of valid range; not applied`,
      });
      altimeter = null;
    }
    setSlot("altimeter", index, altimeter);
  };

  applyAirportWeather(options.departureAirport, depTime, 0);
  applyAirportWeather(options.arrivalAirport, arrTime, 2);

  return { data: result, notifications };
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
    const code = options.departureAirport.toUpperCase();
    const departureAirport = airportData.find(
      (airport) => airport.icaoId?.toUpperCase() === code
    );

    if (typeof departureAirport?.elev === "number") {
      // Convert elevation from meters to feet (1 meter = 3.28084 feet)
      altitudeUpdates[0] = Math.round(departureAirport.elev * 3.28084);
    }
  }

  // Process arrival airport elevation (altitude[2])
  if (options.arrivalAirport) {
    const code = options.arrivalAirport.toUpperCase();
    const arrivalAirport = airportData.find(
      (airport) => airport.icaoId?.toUpperCase() === code
    );

    if (typeof arrivalAirport?.elev === "number") {
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

type Triple = [number | null, number | null, number | null];
type WindTable = [(number | null)[], (number | null)[], (number | null)[]];

const ALOFT_LABELS = TARGET_ALTITUDES_FT.map(
  (ft) => `${ft.toLocaleString("en-US")} ft`
);

/**
 * Map all weather data from API responses to WorksheetData format, and
 * collect every notification the fetch raised.
 *
 * Every field the fetch is expected to fill ends up either holding a fetched
 * value or blank (`null`) with a Warning on that field. Out-of-range values
 * (when `validateData`) are blanked with a Warning rather than applied.
 */
export function mapWeatherDataToWorksheet(
  apiData: {
    metar?: METARResponse[];
    taf?: TAFResponse[];
    airport?: AirportResponse[];
    /** Request-failure notifications from `getWeatherDataBatch`. */
    notifications?: Notification[];
  },
  areaOfOps: AreaOfOpsWeather | null,
  airmets: AirmetClassification | null,
  options: WeatherMappingOptions = {}
): WeatherMappingResult {
  const notifications: Notification[] = [...(apiData.notifications ?? [])];
  const data: Partial<WorksheetData> = {};

  try {
    const metarData = Array.isArray(apiData.metar) ? apiData.metar : [];
    const tafData = Array.isArray(apiData.taf) ? apiData.taf : [];
    const airportData = Array.isArray(apiData.airport) ? apiData.airport : [];

    // Airport temperature / altimeter (departure = 0, arrival = 2)
    const airportWeather = mapAirportSpecificWeatherData(
      metarData,
      tafData,
      options
    );
    Object.assign(data, airportWeather.data);
    notifications.push(...airportWeather.notifications);

    // Runways and field elevations
    data.rwy = mapRunwayData(airportData, options).rwy;
    const elevation = mapAirportElevationData(airportData, options);
    data.altitude = elevation.altitude ?? [null, -1, null];

    // Area-of-ops weather (Open-Meteo): winds aloft and operating conditions
    const temp = (data.temp ? [...data.temp] : [-1, -1, -1]) as Triple;
    const altimeter = (
      data.altimeter ? [...data.altimeter] : [-1, -1, -1]
    ) as Triple;
    let wind: WindTable = [
      Array(5).fill(null),
      Array(5).fill(null),
      Array(5).fill(null),
    ];
    if (areaOfOps) {
      notifications.push(...areaOfOps.notifications);
      wind = [
        [...areaOfOps.windsAloft.direction],
        [...areaOfOps.windsAloft.speed],
        [...areaOfOps.windsAloft.temp],
      ];
      if (areaOfOps.opTemp !== null) temp[1] = areaOfOps.opTemp;
      altimeter[1] = areaOfOps.opAltimeter;
    } else {
      altimeter[1] = null;
    }
    if (typeof options.opAltitudeFt === "number" && options.opAltitudeFt > 0) {
      // An operating temperature is expected only once there's an altitude.
      if (temp[1] === -1) temp[1] = null;
    }

    if (options.validateData) {
      if (temp[1] !== null && temp[1] !== -1 && !isValidTemperature(temp[1])) {
        notifications.push({
          level: "warning",
          subject: fieldSubject("temp", 1),
          message: `Operating temperature ${temp[1]}°C out of valid range; not applied`,
        });
        temp[1] = null;
      }
      if (altimeter[1] !== null && altimeter[1] !== -1 && !isValidAltimeter(altimeter[1])) {
        notifications.push({
          level: "warning",
          subject: fieldSubject("altimeter", 1),
          message: `Operating altimeter ${altimeter[1]} inHg out of valid range; not applied`,
        });
        altimeter[1] = null;
      }
      const checkedWind = rejectInvalidWinds(wind);
      wind = checkedWind.value;
      notifications.push(...checkedWind.notifications);
    }
    data.temp = temp;
    data.altimeter = altimeter;
    data.wind = wind;

    // G-AIRMET flags. `null` means unavailable; the flag is left alone.
    if (airmets) {
      if (airmets.turb !== null) data.turb = airmets.turb;
      if (airmets.cielVis !== null) data.cielVis = airmets.cielVis;
      if (airmets.mtnObsc !== null) data.mtnObsc = airmets.mtnObsc;
      notifications.push(...airmets.notifications);
    }

    notifications.push(...blankFieldWarnings(data, notifications, options));
  } catch (error) {
    return {
      success: false,
      data: {},
      notifications: [
        ...notifications,
        {
          level: "warning",
          subject: { kind: "step", step: "weather" },
          message: `Weather data could not be read: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        },
      ],
    };
  }

  return { success: true, data, notifications };
}

/** Blanks out-of-range winds-aloft values, with a Warning on each column. */
function rejectInvalidWinds(wind: WindTable): {
  value: WindTable;
  notifications: Notification[];
} {
  const notifications: Notification[] = [];
  const checks: [string, (v: number) => boolean][] = [
    ["wind direction", isValidWindDirection],
    ["wind speed", isValidWindSpeed],
    ["temperature", isValidTemperature],
  ];
  const next = wind.map((row) => [...row]) as WindTable;
  checks.forEach(([label, isValid], row) => {
    next[row].forEach((value, col) => {
      if (value === null || value === undefined || isValid(value)) return;
      notifications.push({
        level: "warning",
        subject: fieldSubject("wind", col),
        message: `Invalid ${label} at ${TARGET_ALTITUDES_FT[col]} ft: ${value}; not applied`,
      });
      next[row][col] = null;
    });
  });
  return { value: next, notifications };
}

/**
 * A Warning for every expected field the fetch left blank, unless a producer
 * already raised a Warning on it (so its more specific reason is kept).
 */
function blankFieldWarnings(
  data: Partial<WorksheetData>,
  existing: Notification[],
  options: WeatherMappingOptions
): Notification[] {
  const warned = new Set(
    existing.filter((n) => n.level === "warning").map((n) => subjectKey(n.subject))
  );
  const dep = options.departureAirport?.toUpperCase();
  const arr = options.arrivalAirport?.toUpperCase();
  const out: Notification[] = [];
  const blank = (subject: Subject, what: string) => {
    if (warned.has(subjectKey(subject))) return;
    warned.add(subjectKey(subject));
    out.push({
      level: "warning",
      subject,
      message: `${what} couldn't be fetched; enter it manually`,
    });
  };

  const slot = (code: string | undefined, label: string) =>
    code ? `${label} (${code})` : label;
  ([0, 1, 2] as const).forEach((i) => {
    const where = ["Departure", "Operating", "Arrival"][i];
    const code = i === 0 ? dep : i === 2 ? arr : undefined;
    if (i !== 1 && !code) return;
    // An Unknown or Non-reporting airport's fields need input; its own
    // notification explains why, so no generic Warning.
    const condition = i === 1 ? undefined : conditionOf(options, i);
    if (condition === "unknown") return;
    if (condition !== "non-reporting") {
      if (data.temp?.[i] === null)
        blank(fieldSubject("temp", i), slot(code, `${where} temperature`));
      if (data.altimeter?.[i] === null)
        blank(fieldSubject("altimeter", i), slot(code, `${where} altimeter`));
    }
    if (i !== 1 && data.altitude?.[i] === null)
      blank(fieldSubject("altitude", i), slot(code, `${where} field elevation`));
  });
  if (dep && data.rwy?.[0] === null && conditionOf(options, 0) !== "unknown")
    blank(fieldSubject("rwy", 0), slot(dep, "Departure runway length"));
  if (arr && data.rwy?.[1] === null && conditionOf(options, 2) !== "unknown")
    blank(fieldSubject("rwy", 1), slot(arr, "Arrival runway length"));

  const wind = data.wind;
  if (wind) {
    const colBlank = (col: number) => wind.every((row) => row[col] == null);
    if (TARGET_ALTITUDES_FT.every((_, col) => colBlank(col))) {
      blank(fieldSubject("wind"), "Winds aloft");
    } else {
      TARGET_ALTITUDES_FT.forEach((_, col) => {
        if (colBlank(col))
          blank(fieldSubject("wind", col), `Winds aloft at ${ALOFT_LABELS[col]}`);
      });
    }
  }
  return out;
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
    const next = (
      result.temp ? [...result.temp] : [null, null, null]
    ) as [number | null, number | null, number | null];
    apiData.temp.forEach((val, i) => {
      if (val !== undefined && val !== -1) {
        next[i] = val;
      }
    });
    result.temp = next;
  }

  if (apiData.altimeter) {
    const next = (
      result.altimeter ? [...result.altimeter] : [null, null, null]
    ) as [number | null, number | null, number | null];
    apiData.altimeter.forEach((val, i) => {
      if (val !== undefined && val !== -1) {
        next[i] = val;
      }
    });
    result.altimeter = next;
  }

  if (apiData.rwy) {
    result.rwy = apiData.rwy;
  }

  // Airport IDs: a confirmed auto-correction (#216) is written back.
  if (apiData.airport) {
    result.airport = [...apiData.airport] as [string, string];
  }

  if (apiData.altitude) {
    if (result.altitude) {
      const next = [...result.altitude] as [
        number | null,
        number | null,
        number | null,
      ];
      if (apiData.altitude[0] !== undefined) next[0] = apiData.altitude[0];
      if (apiData.altitude[2] !== undefined) next[2] = apiData.altitude[2];
      // Operating slot: -1 sentinel means "don't update"; otherwise overwrite.
      if (apiData.altitude[1] !== undefined && apiData.altitude[1] !== -1) {
        next[1] = apiData.altitude[1];
      }
      result.altitude = next;
    } else {
      result.altitude = [...apiData.altitude] as [
        number | null,
        number | null,
        number | null,
      ];
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
