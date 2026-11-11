import {
  computeCanyonTurnEntryRanges,
  computeClimbViewModel,
  computePressureColumns,
  computeTOLDViewModel,
  derivePerformanceNotifications,
  findAircraft,
  maneuveringNotifications,
  type CanyonTurnEntryRange,
  type ClimbViewModel,
  type TOLDViewModel,
  type Triple,
} from "./derived";
import { deriveLimitChecks, type LimitCheck } from "./limitChecks";
import { calculateManeuveringSpeeds } from "./maneuveringCalculations";
import type { Notification } from "./notifications";
import { deriveStepStatuses, type StepStatusesResult } from "./stepStatuses";
import type { ManeuveringSpeeds, WorksheetData } from "./types";
import { sessionNotifications, weatherStatus, type WeatherSession } from "./weatherSession";
import type { WeatherStatus } from "./weatherStatus";
import { canFetchWeather, deriveActionBarState, type ActionBarState } from "./actionBarState";

/**
 * What the worksheet remembers about this session beyond the worksheet
 * itself: the weather session's memory (its reducer state, less the
 * worksheet), whose notifications are derived from it plus current state so
 * each clears when its cause does (ADR 0001).
 */
export interface WorksheetSession extends Omit<WeatherSession, "worksheet"> {
  /** Notifications from the runway lookup (an async hook, outside this module). */
  runwayNotifications: readonly Notification[];
}

export const EMPTY_SESSION: WorksheetSession = {
  lastFetch: null,
  lastApplied: null,
  lastUpdated: null,
  opTempChange: null,
  linkLoad: null,
  rejected: {},
  runwayNotifications: [],
};

export interface ManeuveringEvaluation {
  /** Null without an aircraft type, or when its stall speeds are unusable. */
  speeds: ManeuveringSpeeds | null;
  entryRanges: CanyonTurnEntryRange[];
  /** The Warning when the aircraft's stall speeds can't produce speeds. */
  notifications: Notification[];
}

/**
 * Everything the worksheet derives from its state and session: every
 * notification in force, every computed value (computed, withheld, or
 * unavailable), every Limit check, and each step's status.
 */
export interface WorksheetEvaluation {
  notifications: Notification[];
  pressure: { PAs: Triple; DAs: Triple };
  told: TOLDViewModel;
  climb: ClimbViewModel;
  maneuvering: ManeuveringEvaluation;
  limitChecks: LimitCheck[];
  /** Whether the worksheet has weather, and where it came from. */
  weatherStatus: WeatherStatus;
  /** The action bar's state, from the weather status. */
  actionBar: ActionBarState;
  stepStatuses: StepStatusesResult;
}

/**
 * Evaluates the worksheet. Pure; the one place the derived results are
 * assembled, so the screen, the Briefing, and the action bar agree.
 *
 * Performance values are computed twice, in this order:
 * 1. Without notifications, to collect the performance notifications
 *    (weight over maximum gross, extrapolated tables, …). These can't be
 *    known without computing.
 * 2. With every notification in force, so values whose inputs carry a
 *    Warning are withheld and those resting on a Caution are marked.
 */
export function evaluateWorksheet(
  state: WorksheetData,
  session: WorksheetSession,
): WorksheetEvaluation {
  const pressure = computePressureColumns(state.altitude, state.altimeter, state.temp);
  const aircraft = findAircraft(state.acType);
  const maneuveringWarnings = maneuveringNotifications(aircraft);

  const weatherSession: WeatherSession = { ...session, worksheet: state };
  const status = weatherStatus(weatherSession);
  const notifications = [
    ...sessionNotifications(weatherSession, status),
    ...session.runwayNotifications,
    ...derivePerformanceNotifications(state),
  ];

  const told = computeTOLDViewModel(state, pressure.PAs, notifications);
  const climb = computeClimbViewModel(state, notifications);

  const speeds =
    state.acType && maneuveringWarnings.length === 0
      ? calculateManeuveringSpeeds(state.acType)
      : null;

  return {
    notifications,
    pressure,
    told,
    climb,
    maneuvering: {
      speeds,
      entryRanges: computeCanyonTurnEntryRanges(speeds, climb.va),
      notifications: maneuveringWarnings,
    },
    limitChecks: deriveLimitChecks({ state, notifications, climb, told }),
    weatherStatus: status,
    actionBar: deriveActionBarState(status, canFetchWeather(state)),
    stepStatuses: deriveStepStatuses(state, status, notifications),
  };
}
