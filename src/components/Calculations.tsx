"use client";

import type { WorksheetData } from "@/utils/types";
import Altitudes from "@/components/Altitudes";
import ClimbPerformance from "@/components/ClimbPerformance";

interface CalculationsProps {
  state: WorksheetData;
}

export default function Calculations({ state }: CalculationsProps) {
  return (
    <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>

      <div className="space-y-4">
        <Altitudes
          altitudes={state.alttd}
          altimeters={state.altr}
          temperatures={state.temp}
        />
        <ClimbPerformance aircraftModel={state.acft} weight={state.wgt} />
      </div>
    </div>
  );
}
