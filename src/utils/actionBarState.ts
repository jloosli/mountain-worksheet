// src/utils/actionBarState.ts
import type { WorksheetData } from "@/utils/types";
import { normalizeAirportCode } from "@/utils/airportCode";
import { hasWeather, type WeatherStatus } from "@/utils/weatherStatus";

export type ActionBarState = "incomplete" | "ready" | "fetched";

/**
 * Returns true when the worksheet has the minimum required fields to fetch
 * weather: both airports, date, and time.
 */
export function canFetchWeather(state: WorksheetData): boolean {
  return Boolean(
    normalizeAirportCode(state.airport[0]) &&
    normalizeAirportCode(state.airport[1]) &&
    state.date &&
    state.time,
  );
}

/**
 * The action bar's state, from the weather status and whether weather can
 * be fetched.
 *
 * `fetched` is the terminal state: the worksheet never states a Go/No-Go
 * decision (see GLOSSARY.md), so there is no "done" state beyond it. It is
 * reached whenever the worksheet has weather (`hasWeather`), including
 * weather opened from a shared link.
 */
export function deriveActionBarState(
  weatherStatus: WeatherStatus,
  canFetch: boolean,
): ActionBarState {
  if (hasWeather(weatherStatus)) return "fetched";
  return canFetch ? "ready" : "incomplete";
}
