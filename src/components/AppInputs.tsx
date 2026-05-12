"use client";

import { type ReactNode } from "react";
import SortieInfo from "@/components/SortieInfo";
import WeatherInfo from "@/components/WeatherInfo";
import AircraftPerformance from "@/components/AircraftPerformance";
import StepShell from "@/components/StepShell";
import type { WorksheetData } from "@/utils/types";

interface WorksheetFormProps {
  state: WorksheetData;
  onStateUpdate: (updates: Partial<WorksheetData>) => void;
  weatherLastUpdated?: Date;
  useFahrenheit?: boolean;
}

export default function AppInputs({
  state,
  onStateUpdate,
  weatherLastUpdated,
  useFahrenheit,
}: WorksheetFormProps): ReactNode {
  const handleUpdate = (data: Partial<WorksheetData>) => {
    onStateUpdate(data);
  };

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <StepShell
        id="step-sortie"
        number={1}
        status="active"
        title="Sortie Details"
        subtitle="Who's flying, when, and where"
      >
        <SortieInfo onUpdate={handleUpdate} initialData={state} />
      </StepShell>
      <StepShell
        id="step-weather"
        number={2}
        status="pending"
        title="Weather"
        subtitle="Winds aloft, terminal conditions, and advisories"
      >
        <WeatherInfo
          onUpdate={handleUpdate}
          initialData={state}
          lastUpdated={weatherLastUpdated}
          useFahrenheit={useFahrenheit}
        />
        <AircraftPerformance
          onUpdate={handleUpdate}
          initialData={state}
          worksheetData={state}
          useFahrenheit={useFahrenheit}
        />
      </StepShell>
    </div>
  );
}
