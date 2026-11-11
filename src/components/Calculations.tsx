"use client";

import type { WorksheetData } from "@/utils/types";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import Altitudes from "@/components/Altitudes";
import ClimbPerformance from "@/components/ClimbPerformance";
import TakeoffPerformance from "@/components/TakeoffPerformance";
import ManeuveringPerformance from "@/components/ManeuveringPerformance";
import { calculateManeuveringSpeeds } from "@/utils/maneuveringCalculations";
import {
  computeCanyonTurnEntryRanges,
  computeClimbViewModel,
  computePressureColumns,
  computeTOLDViewModel,
  findAircraft,
  maneuveringNotifications,
} from "@/utils/derived";
import type { Notification } from "@/utils/notifications";
import { formatPercentOfMax, type LimitCheck } from "@/utils/limitChecks";

interface CalculationsProps {
  state: WorksheetData;
  /**
   * All notifications in force. Computed values whose inputs carry a Warning
   * are withheld; those whose inputs carry a Caution are marked.
   */
  notifications?: readonly Notification[];
  /** Limit checks, whose point states style the values they evaluate. */
  limitChecks?: readonly LimitCheck[];
}

export default function Calculations({
  state,
  notifications = [],
  limitChecks = [],
}: CalculationsProps) {
  const { PAs, DAs } = computePressureColumns(
    state.altitude,
    state.altimeter,
    state.temp,
  );
  // Values whose own inputs carry a Warning are withheld (#222).
  const told = computeTOLDViewModel(state, PAs, notifications);
  const climb = computeClimbViewModel(state, notifications);
  const aircraft = findAircraft(state.acType);
  const maneuveringWarnings = maneuveringNotifications(aircraft);
  const maneuveringSpeeds =
    state.acType && maneuveringWarnings.length === 0
      ? calculateManeuveringSpeeds(state.acType)
      : null;
  const entryRanges = computeCanyonTurnEntryRanges(maneuveringSpeeds, climb.va);
  const pointStates = (id: LimitCheck["id"]) =>
    limitChecks.find((c) => c.id === id)?.points.map((p) => p.state) ?? [];
  const weightPoint = limitChecks.find((c) => c.id === "weight")?.points[0];
  const [departureRunway, arrivalRunway] = pointStates("runway");
  const percentMGWText =
    aircraft && state.weight !== null && state.weight !== undefined
      ? formatPercentOfMax(state.weight, aircraft.maxGrossWeight)
      : undefined;

  return (
    <div className="w-full">
      <h3 className="text-2xl font-bold mb-4">Calculations</h3>

      {!state.acType && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">
          Select an aircraft model in the Sortie Information section to see performance calculations.
        </p>
      )}
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2.5 dark:border-amber-900/40 dark:bg-amber-950/30">
          <ExclamationCircleIcon className="h-4 w-4 text-amber-600 mt-0.5 shrink-0 dark:text-amber-500" />
          <p className="flex-1 text-sm text-amber-900 dark:text-amber-200 leading-snug">
            <strong className="font-semibold">For reference only.</strong> It is
            up to the PIC and FRO to responsibly evaluate risks prior to release
            or departure. If risks cannot be reduced to an acceptable level, a
            no-go decision should be considered.
          </p>
        </div>
        <Altitudes altitudes={state.altitude} PAs={PAs} DAs={DAs} notifications={notifications} />
        <ClimbPerformance
          aircraftModel={state.acType}
          climb={climb}
          OATs={state.temp}
          altimeters={state.altimeter}
          inputNotifications={notifications}
          percentMGWState={weightPoint?.state}
          percentMGWText={percentMGWText}
          rateOfClimbStates={pointStates("climb")}
        />
        <TakeoffPerformance
          aircraftModel={state.acType}
          airports={state.airport}
          told={told}
          inputNotifications={notifications}
          runwayStates={{ departure: departureRunway, arrival: arrivalRunway }}
        />
        <ManeuveringPerformance
          aircraftModel={state.acType}
          maneuveringSpeeds={maneuveringSpeeds}
          notifications={maneuveringWarnings}
          entryRanges={entryRanges}
          inputNotifications={notifications}
        />
      </div>
    </div>
  );
}
