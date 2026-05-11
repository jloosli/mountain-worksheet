"use client";

import type { WorksheetData } from "@/utils/types";
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
    <div className="w-full max-w-4xl bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>

      {!state.acType && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">
          Select an aircraft model in the Sortie Information section to see performance calculations.
        </p>
      )}
      <div className="space-y-4">
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
