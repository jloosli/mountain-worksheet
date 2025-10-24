/**
 * Aviation Weather API Integration
 *
 * This module provides functions to interact with AviationWeather.gov API endpoints
 * for retrieving METAR, TAF, airport information, and wind/temperature data.
 */

// Base URL for AviationWeather.gov API
const BASE_URL = "/api/aviation-weather";

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
};

// Request tracking for rate limiting
let requestCount = 0;
let windowStart = Date.now();

/**
 * TypeScript interfaces for API response types
 */

export interface METARResponse {
  icaoId: string;
  obsTime: string;
  report: string;
  temp: number;
  dewp: number;
  wdir: number;
  wspd: number;
  wgst?: number;
  visib: number;
  altim: number;
  slp?: number;
  qcField: number;
  wxString?: string;
  presTend?: number;
  maxT?: number;
  minT?: number;
  maxT24?: number;
  minT24?: number;
  precip?: number;
  pcp3hr?: number;
  pcp6hr?: number;
  pcp24hr?: number;
  snow?: number;
  vertVis?: number;
  metarType: string;
  rawOb: string;
}

export interface TAFResponse {
  icaoId: string;
  issueTime: string;
  validTime: string;
  rawTAF: string;
  lat: number;
  lon: number;
  elev: number;
  wdir?: number;
  wspd?: number;
  wgst?: number;
  visib?: number;
  altim?: number;
  wxString?: string;
  temp?: number;
  validTimeEnd?: string;
  prob?: number;
  fcstType: string;
}

export interface AirportResponse {
  icaoId: string;
  iataId?: string;
  name: string;
  city?: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
  elev: number;
  priority: number;
  tz: string;
  metar?: boolean;
  taaf?: boolean;
  runway?: RunwayInfo[];
}

export interface RunwayInfo {
  id: string;
  length: number;
  width: number;
  surface: string;
  lighted: boolean;
  closed: boolean;
}

export interface WindTempResponse {
  icaoId: string;
  validTime: string;
  altitude: number;
  wdir: number;
  wspd: number;
  temp: number;
  pressure: number;
}

export class APIError extends Error {
  code: number;
  message: string;
  details?: string;

  constructor(error: { code: number; message: string; details?: string }) {
    super(error.message);
    this.name = "APIError";
    this.code = error.code;
    this.message = error.message;
    this.details = error.details;
  }
}

/**
 * Rate limiting helper
 */
function checkRateLimit(): boolean {
  const now = Date.now();

  // Reset window if more than 1 minute has passed
  if (now - windowStart > RATE_LIMIT.windowMs) {
    requestCount = 0;
    windowStart = now;
  }

  return requestCount < RATE_LIMIT.maxRequests;
}

/**
 * Increment request counter
 */
function incrementRequestCount(): void {
  requestCount++;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic API request function with error handling and retry logic
 */
async function makeApiRequest<T>(
  endpoint: string,
  params: Record<string, string> = {},
  retries: number = 3
): Promise<T> {
  if (!checkRateLimit()) {
    throw new APIError({
      code: 429,
      message: "Rate limit exceeded. Please wait before making more requests.",
    });
  }

  const url = new URL(
    `${BASE_URL}?endpoint=${endpoint}`,
    window.location.origin
  );
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      incrementRequestCount();

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Mountain-Worksheet/1.0",
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data as T;
      }

      // Handle specific HTTP status codes
      switch (response.status) {
        case 400:
          throw new APIError({
            code: 400,
            message: "Bad Request - Invalid parameters",
            details: await response.text(),
          });
        case 404:
          throw new APIError({
            code: 404,
            message: "Not Found - Airport or data not available",
            details: await response.text(),
          });
        case 429:
          const retryAfter = response.headers.get("Retry-After");
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
          if (attempt < retries) {
            await sleep(delay);
            continue;
          }
          throw new APIError({
            code: 429,
            message: "Too Many Requests - Rate limit exceeded",
            details: `Retry after ${delay}ms`,
          });
        case 500:
          if (attempt < retries) {
            await sleep(1000 * Math.pow(2, attempt)); // Exponential backoff
            continue;
          }
          throw new APIError({
            code: 500,
            message: "Internal Server Error",
            details: await response.text(),
          });
        default:
          throw new APIError({
            code: response.status,
            message: `HTTP ${response.status}`,
            details: await response.text(),
          });
      }
    } catch (error) {
      lastError = error as Error;

      if (attempt < retries && !(error instanceof APIError)) {
        // Network error - retry with exponential backoff
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error("Request failed after all retries");
}

/**
 * Get METAR data for specified airports
 */
export async function getMETAR(
  airports: string[],
  hoursBeforeNow: number = 1
): Promise<METARResponse[]> {
  const params = {
    ids: airports.join(","),
    format: "json",
    hours: hoursBeforeNow.toString(),
  };

  return makeApiRequest<METARResponse[]>("metar", params);
}

/**
 * Get TAF data for specified airports
 */
export async function getTAF(
  airports: string[],
  hoursBeforeNow: number = 24
): Promise<TAFResponse[]> {
  const params = {
    ids: airports.join(","),
    format: "json",
    hours: hoursBeforeNow.toString(),
  };

  return makeApiRequest<TAFResponse[]>("taf", params);
}

/**
 * Get airport information
 */
export async function getAirportInfo(
  airports: string[]
): Promise<AirportResponse[]> {
  const params = {
    ids: airports.join(","),
    format: "json",
  };

  return makeApiRequest<AirportResponse[]>("airport", params);
}

/**
 * Get wind and temperature data for specified altitudes
 * Uses regional data to get SLC windtemp information
 */
export async function getWindTemp(
  airports: string[],
  _altitudes: number[] = [3000, 6000, 9000, 12000, 15000]
): Promise<WindTempResponse[]> {
  const params = {
    region: "us",
    level: "low",
    fcst: "06",
    format: "json",
  };

  return makeApiRequest<WindTempResponse[]>("windtemp", params);
}

/**
 * Batch multiple API requests efficiently
 */
export async function getWeatherDataBatch(
  airports: string[],
  options: {
    includeMETAR?: boolean;
    includeTAF?: boolean;
    includeAirport?: boolean;
    includeWindTemp?: boolean;
    metarHours?: number;
    tafHours?: number;
    altitudes?: number[];
  } = {}
): Promise<{
  metar?: METARResponse[];
  taf?: TAFResponse[];
  airport?: AirportResponse[];
  windTemp?: WindTempResponse[];
}> {
  const {
    includeMETAR = true,
    includeTAF = true,
    includeAirport = true,
    includeWindTemp = true,
    metarHours = 1,
    tafHours = 24,
    altitudes = [3000, 6000, 9000, 12000, 15000],
  } = options;

  const promises: Promise<
    METARResponse[] | TAFResponse[] | AirportResponse[] | WindTempResponse[]
  >[] = [];

  if (includeMETAR) {
    promises.push(getMETAR(airports, metarHours));
  }
  if (includeTAF) {
    promises.push(getTAF(airports, tafHours));
  }
  if (includeAirport) {
    promises.push(getAirportInfo(airports));
  }
  if (includeWindTemp) {
    promises.push(getWindTemp(airports, altitudes));
  }

  const results = await Promise.allSettled(promises);

  const response: {
    metar?: METARResponse[];
    taf?: TAFResponse[];
    airport?: AirportResponse[];
    windTemp?: WindTempResponse[];
  } = {};
  let resultIndex = 0;

  if (includeMETAR) {
    response.metar =
      results[resultIndex].status === "fulfilled"
        ? (results[resultIndex] as PromiseFulfilledResult<METARResponse[]>)
            .value
        : [];
    resultIndex++;
  }
  if (includeTAF) {
    response.taf =
      results[resultIndex].status === "fulfilled"
        ? (results[resultIndex] as PromiseFulfilledResult<TAFResponse[]>).value
        : [];
    resultIndex++;
  }
  if (includeAirport) {
    response.airport =
      results[resultIndex].status === "fulfilled"
        ? (results[resultIndex] as PromiseFulfilledResult<AirportResponse[]>)
            .value
        : [];
    resultIndex++;
  }
  if (includeWindTemp) {
    response.windTemp =
      results[resultIndex].status === "fulfilled"
        ? (results[resultIndex] as PromiseFulfilledResult<WindTempResponse[]>)
            .value
        : [];
    resultIndex++;
  }

  return response;
}

/**
 * Debounced API request function
 */
let debounceTimer: NodeJS.Timeout | null = null;

export function debouncedRequest<T>(
  requestFn: () => Promise<T>,
  delay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }, delay);
  });
}
