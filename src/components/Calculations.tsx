"use client";

import type { WorksheetData } from "@/utils/types";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import Altitudes from "@/components/Altitudes";
import ClimbPerformance from "@/components/ClimbPerformance";
import TakeoffPerformance from "@/components/TakeoffPerformance";
import ManeuveringPerformance from "@/components/ManeuveringPerformance";
import TOLDErrorBoundary from "@/components/TOLDErrorBoundary";
import { calculateManeuveringSpeeds } from "@/utils/maneuveringCalculations";
import {
  computePressureColumns,
  computeTOLDViewModel,
} from "@/utils/derived";

interface CalculationsProps {
  state: WorksheetData;
}

export default function Calculations({ state }: CalculationsProps) {
  const { PAs, DAs } = computePressureColumns(
    state.altitude,
    state.altimeter,
    state.temp,
  );
  const toldData = computeTOLDViewModel(state, PAs);
  const maneuveringSpeeds = state.acType
    ? calculateManeuveringSpeeds(state.acType)
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
        <Altitudes altitudes={state.altitude} PAs={PAs} DAs={DAs} />
        <ClimbPerformance
          aircraftModel={state.acType}
          weight={state.weight}
          OATs={state.temp}
          PAs={PAs}
          altimeters={state.altimeter}
        />
        <TOLDErrorBoundary
          onError={(error, errorInfo) => {
            console.error("TOLD calculation error:", error, errorInfo);
          }}
        >
          <TakeoffPerformance
            aircraftModel={state.acType}
            airports={state.airport}
            toldData={toldData}
          />
        </TOLDErrorBoundary>
        <ManeuveringPerformance
          aircraftModel={state.acType}
          maneuveringSpeeds={maneuveringSpeeds ?? undefined}
        />
      </div>
    </div>
  );
}
