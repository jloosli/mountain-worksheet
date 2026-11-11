import type { NotificationDraft } from "./notifications";

export const PRESSURE_LEVELS = [925, 900, 850, 800, 700, 600, 500] as const;
export type PressureLevel = (typeof PRESSURE_LEVELS)[number];

export const M_TO_FT = 3.28084;
export const HPA_TO_INHG = 0.02953;

export interface OpenMeteoHourly {
  time: string[];
  pressure_msl?: number[];
  [key: string]: number[] | string[] | undefined;
}

export interface OpenMeteoPointForecast {
  hourly: OpenMeteoHourly;
}

function buildHourlyParams(): string[] {
  const params = ["pressure_msl"];
  for (const level of PRESSURE_LEVELS) {
    params.push(
      `temperature_${level}hPa`,
      `wind_speed_${level}hPa`,
      `wind_direction_${level}hPa`,
      `geopotential_height_${level}hPa`,
    );
  }
  return params;
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost";
}

async function fetchOpenMeteo(params: Record<string, string>): Promise<OpenMeteoPointForecast> {
  const url = new URL("/api/open-meteo", getOrigin());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as OpenMeteoPointForecast;
}

export async function fetchPointForecast(
  latitude: number,
  longitude: number,
  win: { start: Date; end: Date },
): Promise<OpenMeteoPointForecast> {
  return fetchOpenMeteo({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: dateOnly(win.start),
    end_date: dateOnly(win.end),
    wind_speed_unit: "kn",
    temperature_unit: "celsius",
    hourly: buildHourlyParams().join(","),
  });
}

/**
 * Hourly 2 m temperature at an airport. Passing the field elevation (meters)
 * makes the model downscale to the field rather than its smoothed grid cell
 * (ADR 0003, #301).
 */
export async function fetchFieldForecast(
  latitude: number,
  longitude: number,
  elevationM: number,
  win: { start: Date; end: Date },
): Promise<OpenMeteoPointForecast> {
  return fetchOpenMeteo({
    latitude: String(latitude),
    longitude: String(longitude),
    elevation: String(elevationM),
    start_date: dateOnly(win.start),
    end_date: dateOnly(win.end),
    temperature_unit: "celsius",
    hourly: "temperature_2m",
  });
}

/**
 * Hourly output is on the hour, so any time inside the series is within
 * 30 min of a value; a time farther off is past the end of the forecast.
 */
export const FIELD_FORECAST_MAX_OFFSET_MS = 30 * 60 * 1000;

/**
 * The field forecast's 2 m temperature for the hour nearest `at`, or null
 * when the forecast doesn't reach that time or has no value there.
 */
export function fieldTemperatureAt(
  raw: OpenMeteoPointForecast | undefined,
  at: Date,
): number | null {
  if (!raw) return null;
  const { idx, deltaMs } = pickClosestTimeIdx(raw, at);
  if (idx < 0 || deltaMs > FIELD_FORECAST_MAX_OFFSET_MS) return null;
  const value = (raw.hourly.temperature_2m as number[] | undefined)?.[idx];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface InterpolationSample {
  timeIdx: number;
  heightsFtByLevel: Record<PressureLevel, number>;
  tempByLevel: Record<PressureLevel, number>;
  wspdByLevel: Record<PressureLevel, number>;
  wdirByLevel: Record<PressureLevel, number>;
}

export interface InterpolatedAloft {
  temp: number | null;
  wspd: number | null;
  wdir: number | null;
  /** Caveats about this altitude; the caller attaches the Subject. */
  notes: NotificationDraft[];
}

function circularInterp(low: number, high: number, f: number): number {
  if (Math.abs(high - low) > 180) {
    if (high > low) return ((low + 360) * (1 - f) + high * f) % 360;
    return (low * (1 - f) + (high + 360) * f) % 360;
  }
  return low * (1 - f) + high * f;
}

function roundFinite(v: number): number | null {
  return Number.isFinite(v) ? Math.round(v) : null;
}

export function interpolateAtAltitude(targetFt: number, s: InterpolationSample): InterpolatedAloft {
  const notes: NotificationDraft[] = [];
  // Only consider levels with a finite geopotential height; missing heights
  // would otherwise collapse to 0 ft and pollute bracket selection.
  const sortedLevels = [...PRESSURE_LEVELS]
    .filter((l) => Number.isFinite(s.heightsFtByLevel[l]))
    .sort((a, b) => s.heightsFtByLevel[a] - s.heightsFtByLevel[b]);

  if (sortedLevels.length === 0) {
    notes.push({
      level: "warning",
      message: "No pressure-level heights available for interpolation",
    });
    return { temp: null, wspd: null, wdir: null, notes };
  }

  const lowest = sortedLevels[0];
  const highest = sortedLevels[sortedLevels.length - 1];

  if (targetFt <= s.heightsFtByLevel[lowest]) {
    if (targetFt < s.heightsFtByLevel[lowest]) {
      notes.push({
        level: "caution",
        message: `Target altitude ${targetFt} ft below available pressure-level range (${Math.round(
          s.heightsFtByLevel[lowest],
        )} ft); snapping to lowest level`,
      });
    }
    return withMissingComponents(targetFt, notes, {
      temp: roundFinite(s.tempByLevel[lowest]),
      wspd: roundFinite(s.wspdByLevel[lowest]),
      wdir: roundFinite(s.wdirByLevel[lowest]),
    });
  }
  if (targetFt >= s.heightsFtByLevel[highest]) {
    if (targetFt > s.heightsFtByLevel[highest]) {
      notes.push({
        level: "caution",
        message: `Target altitude ${targetFt} ft above available pressure-level range (${Math.round(
          s.heightsFtByLevel[highest],
        )} ft); snapping to highest level`,
      });
    }
    return withMissingComponents(targetFt, notes, {
      temp: roundFinite(s.tempByLevel[highest]),
      wspd: roundFinite(s.wspdByLevel[highest]),
      wdir: roundFinite(s.wdirByLevel[highest]),
    });
  }

  let lowerLevel: PressureLevel = lowest;
  let upperLevel: PressureLevel = highest;
  for (let i = 0; i < sortedLevels.length - 1; i++) {
    if (
      s.heightsFtByLevel[sortedLevels[i]] <= targetFt &&
      targetFt <= s.heightsFtByLevel[sortedLevels[i + 1]]
    ) {
      lowerLevel = sortedLevels[i];
      upperLevel = sortedLevels[i + 1];
      break;
    }
  }
  const lowerHeight = s.heightsFtByLevel[lowerLevel];
  const upperHeight = s.heightsFtByLevel[upperLevel];

  // No bracket has zero width here: a target equal to a duplicated height
  // matches the bracket below the pair first, or the lowest/highest snap.

  const f = (targetFt - lowerHeight) / (upperHeight - lowerHeight);

  const tempLow = s.tempByLevel[lowerLevel];
  const tempHigh = s.tempByLevel[upperLevel];
  const wspdLow = s.wspdByLevel[lowerLevel];
  const wspdHigh = s.wspdByLevel[upperLevel];
  const wdirLow = s.wdirByLevel[lowerLevel];
  const wdirHigh = s.wdirByLevel[upperLevel];

  const temp =
    Number.isFinite(tempLow) && Number.isFinite(tempHigh) ? tempLow * (1 - f) + tempHigh * f : NaN;
  const wspd =
    Number.isFinite(wspdLow) && Number.isFinite(wspdHigh) ? wspdLow * (1 - f) + wspdHigh * f : NaN;
  const wdir =
    Number.isFinite(wdirLow) && Number.isFinite(wdirHigh)
      ? circularInterp(wdirLow, wdirHigh, f)
      : NaN;
  return withMissingComponents(targetFt, notes, {
    temp: roundFinite(temp),
    wspd: roundFinite(wspd),
    wdir: roundFinite(wdir),
  });
}

/**
 * Adds a Warning note naming each component the forecast didn't provide at
 * the target altitude. Every return path with data goes through here.
 */
function withMissingComponents(
  targetFt: number,
  notes: NotificationDraft[],
  result: Omit<InterpolatedAloft, "notes">,
): InterpolatedAloft {
  const missing = [
    result.wdir === null && "wind direction",
    result.wspd === null && "wind speed",
    result.temp === null && "temperature",
  ].filter((m): m is string => typeof m === "string");
  if (missing.length > 0) {
    notes.push({
      level: "warning",
      message: `Forecast had no ${joinList(missing)} at ${targetFt.toLocaleString(
        "en-US",
      )} ft; enter ${missing.length > 1 ? "them" : "it"} manually`,
    });
  }
  return { ...result, notes };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function buildSampleAtTime(
  raw: OpenMeteoPointForecast,
  timeIdx: number,
): InterpolationSample {
  const heightsFtByLevel = {} as Record<PressureLevel, number>;
  const tempByLevel = {} as Record<PressureLevel, number>;
  const wspdByLevel = {} as Record<PressureLevel, number>;
  const wdirByLevel = {} as Record<PressureLevel, number>;
  for (const level of PRESSURE_LEVELS) {
    const heights = raw.hourly[`geopotential_height_${level}hPa`] as number[] | undefined;
    const temps = raw.hourly[`temperature_${level}hPa`] as number[] | undefined;
    const wspds = raw.hourly[`wind_speed_${level}hPa`] as number[] | undefined;
    const wdirs = raw.hourly[`wind_direction_${level}hPa`] as number[] | undefined;
    heightsFtByLevel[level] = (heights?.[timeIdx] ?? 0) * M_TO_FT;
    tempByLevel[level] = temps?.[timeIdx] ?? NaN;
    wspdByLevel[level] = wspds?.[timeIdx] ?? NaN;
    wdirByLevel[level] = wdirs?.[timeIdx] ?? NaN;
  }
  return { timeIdx, heightsFtByLevel, tempByLevel, wspdByLevel, wdirByLevel };
}

// Open-Meteo returns naive ISO8601 timestamps in UTC by default (e.g.
// "2026-05-12T00:00"). Treat those as UTC by appending "Z". If the API ever
// returns a timestamp that already carries a timezone designator ("Z" or
// +/-HH:MM), parse it as-is — double-appending would yield NaN.
function parseOpenMeteoTime(t: string): number {
  const hasTz = /(Z|[+-]\d{2}:?\d{2})$/.test(t);
  return Date.parse(hasTz ? t : t + "Z");
}

export function pickClosestTimeIdx(
  raw: OpenMeteoPointForecast,
  target: Date,
): { idx: number; deltaMs: number } {
  const targetMs = target.getTime();
  const times = raw.hourly.time;
  if (!times || times.length === 0) return { idx: -1, deltaMs: Infinity };
  let bestIdx = 0;
  let bestDelta = Math.abs(parseOpenMeteoTime(times[0]) - targetMs);
  for (let i = 1; i < times.length; i++) {
    const t = parseOpenMeteoTime(times[i]);
    const d = Math.abs(t - targetMs);
    if (d < bestDelta) {
      bestDelta = d;
      bestIdx = i;
    }
  }
  return { idx: bestIdx, deltaMs: bestDelta };
}
