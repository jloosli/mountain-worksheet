// src/utils/actionBarState.ts
import type { WorksheetData } from "@/utils/types";

export type ActionBarState =
  | "incomplete"
  | "ready"
  | "fetched"
  | "all-done";

/**
 * Returns true when the worksheet has the minimum required fields to fetch
 * weather: both airports, date, and time. Mirrors the predicate inside
 * `WeatherDataIntegration` so the action bar and the fetch button agree on
 * when fetching is possible.
 */
export function canFetchWeather(state: WorksheetData): boolean {
  return Boolean(
    state.airport[0] && state.airport[1] && state.date && state.time
  );
}

/**
 * Derives the action bar's state from the worksheet data and the
 * weather-fetch timestamp.
 *
 * Phase 3 returns only `incomplete | ready | fetched`. The `all-done` state
 * is reserved for after the Go / No-Go panel ships; until then, fetched is
 * the terminal state.
 */
export function deriveActionBarState(
  state: WorksheetData,
  weatherLastUpdated: Date | null
): ActionBarState {
  if (weatherLastUpdated !== null) return "fetched";
  return canFetchWeather(state) ? "ready" : "incomplete";
}
