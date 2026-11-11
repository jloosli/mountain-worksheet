import type { Notification } from "@/utils/notifications";
import type { WorksheetData } from "@/utils/types";
import {
  EMPTY_SESSION,
  evaluateWorksheet,
  type WorksheetEvaluation,
  type WorksheetSession,
} from "@/utils/worksheetEvaluation";

/**
 * The evaluation of `state` for a component test, as if weather were
 * fetched this session (so there's no Unverified weather Caution), with
 * `notifications` also in force.
 *
 * The extra notifications go through the session's runway-lookup slot, the
 * one free-form source, so values are withheld and marked exactly as
 * `evaluateWorksheet` would do it for real.
 */
export function evaluationFor(
  state: WorksheetData,
  notifications: readonly Notification[] = [],
  session: Partial<WorksheetSession> = {},
): WorksheetEvaluation {
  return evaluateWorksheet(state, {
    ...EMPTY_SESSION,
    weatherLastUpdated: new Date("2026-01-01T00:00:00Z"),
    ...session,
    runwayNotifications: [...(session.runwayNotifications ?? []), ...notifications],
  });
}
