"use client";

import { type ReactNode } from "react";
import SortieInfo from "@/components/SortieInfo";
import WeatherInfo from "@/components/WeatherInfo";
import AircraftPerformance from "@/components/AircraftPerformance";
import MountainQuals from "@/components/MountainQuals";
import type { WorksheetData } from "@/utils/types";

interface WorksheetFormProps {
  state: WorksheetData;
  onStateUpdate: (updates: Partial<WorksheetData>) => void;
  weatherLastUpdated?: Date;
}

export default function AppInputs({
  state,
  onStateUpdate,
  weatherLastUpdated,
}: WorksheetFormProps): ReactNode {
  const handleUpdate = (data: Partial<WorksheetData>) => {
    onStateUpdate(data);
  };

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <SortieInfo onUpdate={handleUpdate} initialData={state} />
      <MountainQuals onUpdate={handleUpdate} initialData={state} />
      <WeatherInfo
        onUpdate={handleUpdate}
        initialData={state}
        lastUpdated={weatherLastUpdated}
      />
      <AircraftPerformance
        onUpdate={handleUpdate}
        initialData={state}
        worksheetData={state}
      />
    </div>
  );
}
