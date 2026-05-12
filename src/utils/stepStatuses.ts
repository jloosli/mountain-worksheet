// src/utils/stepStatuses.ts
import type { StepStatus } from "@/components/Stepper";
import type { WorksheetData } from "@/utils/types";
import { canFetchWeather } from "@/utils/actionBarState";

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
 * - Weather: `complete` when weather has been fetched at least once;
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
  const weatherFetched = weatherLastUpdated !== null;

  const sortie: StepStatus = sortieReady ? "complete" : "active";
  const weather: StepStatus = weatherFetched
    ? "complete"
    : sortieReady
      ? "active"
      : "pending";
  const decision: StepStatus = weatherFetched ? "active" : "pending";

  return { sortie, weather, decision };
}
