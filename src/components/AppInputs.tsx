"use client";

import { type ReactNode } from "react";
import SortieInfo from "@/components/SortieInfo";
import StepShell from "@/components/StepShell";
import WeatherSection from "@/components/WeatherSection";
import type { RunwayOption, WorksheetData } from "@/utils/types";

interface WorksheetFormProps {
  state: WorksheetData;
  onStateUpdate: (updates: Partial<WorksheetData>) => void;
  airportRunways: [RunwayOption[] | null, RunwayOption[] | null];
  useFahrenheit?: boolean;
}

export default function AppInputs({
  state,
  onStateUpdate,
  airportRunways,
  useFahrenheit,
}: WorksheetFormProps): ReactNode {
  const handleUpdate = (data: Partial<WorksheetData>) => {
    onStateUpdate(data);
  };

  return (
    <div className="flex w-full flex-col space-y-6">
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
        <WeatherSection
          state={state}
          onUpdate={handleUpdate}
          airportRunways={airportRunways}
          useFahrenheit={useFahrenheit}
        />
      </StepShell>
    </div>
  );
}
