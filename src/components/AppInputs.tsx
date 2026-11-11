"use client";

import { type ReactNode } from "react";
import InlineNotifications from "@/components/InlineNotifications";
import SortieInfo from "@/components/SortieInfo";
import StepShell from "@/components/StepShell";
import { LimitCheckCallouts } from "@/components/LimitCheckCallout";
import { windSpeedStates } from "@/utils/limitChecks";
import WeatherSection from "@/components/WeatherSection";
import { stepSubject } from "@/utils/notifications";
import type { WorksheetEvaluation } from "@/utils/worksheetEvaluation";
import { formatStepBadge } from "@/utils/stepStatuses";
import type { RunwayOption, WorksheetData } from "@/utils/types";
import type { RunwayLookupStatus } from "@/utils/useAirportRunways";
import type { RejectedEntries, RejectedEntry, RejectedEntryKey } from "@/utils/rejectedEntries";

interface WorksheetFormProps {
  state: WorksheetData;
  onStateUpdate: (updates: Partial<WorksheetData>) => void;
  airportRunways: [RunwayOption[] | null, RunwayOption[] | null];
  runwayStatus?: [RunwayLookupStatus, RunwayLookupStatus];
  useFahrenheit?: boolean;
  /**
   * The worksheet evaluation: each notification is shown next to its
   * Subject, each Limit check as a callout at the top of the step that owns
   * it, and each step with its status and counts.
   */
  evaluation: WorksheetEvaluation;
  /** Weather entries that were not applied; see WeatherSection. */
  rejectedEntries: RejectedEntries;
  onRejectedEntryChange: (key: RejectedEntryKey, entry: RejectedEntry | null) => void;
}

export default function AppInputs({
  state,
  onStateUpdate,
  airportRunways,
  runwayStatus,
  useFahrenheit,
  evaluation,
  rejectedEntries,
  onRejectedEntryChange,
}: WorksheetFormProps): ReactNode {
  const handleUpdate = (data: Partial<WorksheetData>) => {
    onStateUpdate(data);
  };
  const { notifications, limitChecks, stepStatuses: steps } = evaluation;

  return (
    <div className="flex w-full flex-col space-y-6">
      <StepShell
        id="step-sortie"
        number={1}
        status={steps.sortie}
        badge={formatStepBadge(steps.counts.sortie)}
        title="Sortie Details"
        subtitle="Who's flying, when, and where"
      >
        <LimitCheckCallouts checks={limitChecks} step="sortie" />
        <InlineNotifications notifications={notifications} subject={stepSubject("sortie")} />
        <SortieInfo onUpdate={handleUpdate} initialData={state} notifications={notifications} />
      </StepShell>
      <StepShell
        id="step-weather"
        number={2}
        status={steps.weather}
        badge={formatStepBadge(steps.counts.weather)}
        title="Weather"
        subtitle="Winds aloft, terminal conditions, and advisories"
      >
        <LimitCheckCallouts checks={limitChecks} step="weather" />
        <InlineNotifications notifications={notifications} subject={stepSubject("weather")} />
        <WeatherSection
          state={state}
          onUpdate={handleUpdate}
          airportRunways={airportRunways}
          runwayStatus={runwayStatus}
          useFahrenheit={useFahrenheit}
          notifications={notifications}
          windSpeedStates={windSpeedStates(limitChecks)}
          rejectedEntries={rejectedEntries}
          onRejectedEntryChange={onRejectedEntryChange}
        />
      </StepShell>
    </div>
  );
}
