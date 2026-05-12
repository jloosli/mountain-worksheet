// src/utils/stepStatuses.ts
import type { StepStatus } from "@/components/Stepper";
import type { WorksheetData } from "@/utils/types";
import { canFetchWeather, hasWeatherData } from "@/utils/actionBarState";

export interface StepStatusesResult {
  sortie: StepStatus;
  weather: StepStatus;
  decision: StepStatus;
}

/**
 * Derives each step's status from the worksheet state.
 *
 * - Sortie: `complete` when the minimum fields to fetch weather are present;
 *   otherwise `active` (the user's current focus).
 * - Weather: `complete` when this session has fetched weather OR the
 *   worksheet already carries weather data (e.g. from a shared URL);
 *   otherwise `active` if sortie is complete (the user's next focus), else
 *   `pending`.
 * - Decision: `active` once weather is complete (next focus); otherwise
 *   `pending`. (`complete` and `warning` are reserved for when the Go / No-Go
 *   panel ships — those depend on verdict logic that doesn't exist yet.)
 */
export function deriveStepStatuses(
  state: WorksheetData,
  weatherLastUpdated: Date | null
): StepStatusesResult {
  const sortieReady = canFetchWeather(state);
  const weatherComplete =
    weatherLastUpdated !== null || hasWeatherData(state);

  const sortie: StepStatus = sortieReady ? "complete" : "active";
  const weather: StepStatus = weatherComplete
    ? "complete"
    : sortieReady
      ? "active"
      : "pending";
  const decision: StepStatus = weatherComplete ? "active" : "pending";

  return { sortie, weather, decision };
}
