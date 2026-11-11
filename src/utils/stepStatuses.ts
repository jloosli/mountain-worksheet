// src/utils/stepStatuses.ts
import type { StepStatus } from "@/components/Stepper";
import type { WorksheetData } from "@/utils/types";
import { canFetchWeather } from "@/utils/actionBarState";
import { hasWeather, type WeatherStatus } from "@/utils/weatherStatus";
import {
  countByLevel,
  notificationsOnStep,
  type LevelCounts,
  type Notification,
  type StepId,
} from "@/utils/notifications";

export interface StepStatusesResult {
  sortie: StepStatus;
  weather: StepStatus;
  decision: StepStatus;
  /** Notifications on each step, by level (see `formatStepBadge`). */
  counts: Record<StepId, LevelCounts>;
}

/**
 * Derives each step's status from the worksheet state and the notifications
 * currently in force.
 *
 * - Sortie: `complete` when the minimum fields to fetch weather are present;
 *   otherwise `active` (the user's current focus).
 * - Weather: `complete` when the worksheet has weather (`hasWeather`:
 *   fetched, stale, or unverified from a shared link); otherwise `active`
 *   if sortie is complete (the user's next focus), else `pending`.
 * - Decision: `active` once weather is complete (next focus); otherwise
 *   `pending`. It is never `complete`: the worksheet informs the Go/No-Go
 *   decision but never states it (GLOSSARY.md), and Limit checks don't
 *   change step status (ADR 0002).
 *
 * Any step with a Warning on one of its Subjects is `warning` instead. That
 * only marks the step; it never holds back the other steps.
 */
export function deriveStepStatuses(
  state: WorksheetData,
  weatherStatus: WeatherStatus,
  notifications: readonly Notification[] = [],
): StepStatusesResult {
  const sortieReady = canFetchWeather(state);
  const weatherComplete = hasWeather(weatherStatus);

  const counts: Record<StepId, LevelCounts> = {
    sortie: countByLevel(notificationsOnStep(notifications, "sortie")),
    weather: countByLevel(notificationsOnStep(notifications, "weather")),
    decision: countByLevel(notificationsOnStep(notifications, "decision")),
  };
  const withWarnings = (step: StepId, status: StepStatus): StepStatus =>
    counts[step].warning > 0 ? "warning" : status;

  const sortie: StepStatus = sortieReady ? "complete" : "active";
  const weather: StepStatus = weatherComplete ? "complete" : sortieReady ? "active" : "pending";
  const decision: StepStatus = weatherComplete ? "active" : "pending";

  return {
    sortie: withWarnings("sortie", sortie),
    weather: withWarnings("weather", weather),
    decision: withWarnings("decision", decision),
    counts,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Step badge text counting Warnings and Cautions; `undefined` when none. */
export function formatStepBadge(counts: LevelCounts): string | undefined {
  const parts: string[] = [];
  if (counts.warning > 0) parts.push(plural(counts.warning, "warning"));
  if (counts.caution > 0) parts.push(plural(counts.caution, "caution"));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
