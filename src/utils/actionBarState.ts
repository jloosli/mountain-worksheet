// src/utils/actionBarState.ts
import type { WorksheetData } from "@/utils/types";
import { normalizeAirportCode } from "@/utils/airportCode";

export type ActionBarState = "incomplete" | "ready" | "fetched";

/**
 * Returns true when the worksheet has the minimum required fields to fetch
 * weather: both airports, date, and time. Mirrors the predicate inside
 * `WeatherDataIntegration` so the action bar and the fetch button agree on
 * when fetching is possible.
 */
export function canFetchWeather(state: WorksheetData): boolean {
  return Boolean(
    normalizeAirportCode(state.airport[0]) &&
      normalizeAirportCode(state.airport[1]) &&
      state.date &&
      state.time
  );
}

/**
 * Returns true when the worksheet has any weather values populated (wind,
 * temperature, or altimeter). Used to detect "fetched" state on a shared URL
 * where `weatherLastUpdated` is null but weather fields were populated by a
 * previous session's fetch (or by manual entry).
 */
export function hasWeatherData(state: WorksheetData): boolean {
  const hasWind = state.wind.some((row) => row.some((v) => v !== null));
  const hasTemp = state.temp.some((v) => v !== null);
  const hasAltimeter = state.altimeter.some((v) => v !== null);
  return hasWind || hasTemp || hasAltimeter;
}

/**
 * Derives the action bar's state from the worksheet data and the
 * weather-fetch timestamp.
 *
 * `fetched` is the terminal state: the worksheet never states a Go/No-Go
 * decision (see GLOSSARY.md), so there is no "done" state beyond it.
 * "Fetched" is reached when either the session has a
 * fresh fetch timestamp OR the worksheet already carries weather data (e.g.
 * from a shared URL).
 */
export function deriveActionBarState(
  state: WorksheetData,
  weatherLastUpdated: Date | null
): ActionBarState {
  if (weatherLastUpdated !== null || hasWeatherData(state)) return "fetched";
  return canFetchWeather(state) ? "ready" : "incomplete";
}
