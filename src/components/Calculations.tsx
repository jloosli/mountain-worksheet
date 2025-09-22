"use client";

import type { WorksheetData } from "@/utils/types";
import Altitudes from "@/components/Altitudes";
import ClimbPerformance from "@/components/ClimbPerformance";
import TakeoffPerformance from "@/components/TakeoffPerformance";
import ManeuveringPerformance from "@/components/ManeuveringPerformance";
import { useState } from "react";

interface CalculationsProps {
  state: WorksheetData;
}

export default function Calculations({ state }: CalculationsProps) {
  const [PAs, setPAs] = useState<[number, number, number]>([0, 0, 0]);
  const handlePressureUpdate = (
    PAs: [number | null, number | null, number | null]
  ) => {
    setPAs(PAs.map((pa) => pa ?? 0) as [number, number, number]);
  };
  return (
    <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>

      <div className="space-y-4">
        <Altitudes
          altitudes={state.altitude}
          altimeters={state.altimeter}
          temperatures={state.temp}
          onPressureUpdate={handlePressureUpdate}
        />
        <ClimbPerformance
          aircraftModel={state.acType}
          weight={state.weight}
          OATs={state.temp}
          PAs={PAs}
        />
        <TakeoffPerformance
          aircraftModel={state.acType}
          airports={state.airport}
        />
        <ManeuveringPerformance aircraftModel={state.acType} />
      </div>
    </div>
  );
}
