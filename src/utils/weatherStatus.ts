/**
 * The weather status type and the worksheet predicate behind it. The
 * selector that computes it, `weatherStatus`, lives with the session memory
 * it reads (`weatherSession.ts`); `evaluateWorksheet` calls it once per
 * render, and step statuses, the action bar and Unverified weather all read
 * that one result.
 */
import type { WorksheetData } from "./types";

/**
 * - `none`: no weather values on the worksheet and no fetch this session.
 * - `unverified`: weather values this session didn't fetch, such as from a
 *   shared link (Unverified weather, GLOSSARY.md).
 * - `fetched`: a fetch this session applied weather, and its inputs still
 *   match the worksheet.
 * - `stale`: a fetch this session applied weather, but a fetch input it
 *   depends on has changed and a field still holds the fetched value.
 */
export type WeatherStatus = "none" | "unverified" | "fetched" | "stale";

/**
 * Returns true when the worksheet has any weather values populated (wind,
 * temperature, or altimeter). The advisory boxes don't count: a ticked box
 * alone isn't weather data (#277).
 */
export function hasWeatherData(state: WorksheetData): boolean {
  const hasWind = state.wind.some((row) => row.some((v) => v !== null));
  const hasTemp = state.temp.some((v) => v !== null);
  const hasAltimeter = state.altimeter.some((v) => v !== null);
  return hasWind || hasTemp || hasAltimeter;
}

/** Whether the worksheet has weather in hand: fetched, stale or unverified. */
export const hasWeather = (status: WeatherStatus): boolean => status !== "none";
