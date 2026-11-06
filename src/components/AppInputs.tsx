"use client";

import { type ReactNode } from "react";
import InlineNotifications from "@/components/InlineNotifications";
import SortieInfo from "@/components/SortieInfo";
import StepShell from "@/components/StepShell";
import WeatherSection from "@/components/WeatherSection";
import { stepSubject, type Notification } from "@/utils/notifications";
import {
  deriveStepStatuses,
  formatStepBadge,
  type StepStatusesResult,
} from "@/utils/stepStatuses";
import type { RunwayOption, WorksheetData } from "@/utils/types";
import type { RunwayLookupStatus } from "@/utils/useAirportRunways";
import type {
  RejectedEntries,
  RejectedEntry,
  RejectedEntryKey,
} from "@/utils/rejectedEntries";

interface WorksheetFormProps {
  state: WorksheetData;
  onStateUpdate: (updates: Partial<WorksheetData>) => void;
  airportRunways: [RunwayOption[] | null, RunwayOption[] | null];
  runwayStatus?: [RunwayLookupStatus, RunwayLookupStatus];
  useFahrenheit?: boolean;
  /** All notifications in force; each is shown next to its Subject. */
  notifications?: readonly Notification[];
  /** Step statuses and counts; derived from `state` + `notifications` if omitted. */
  stepStatuses?: StepStatusesResult;
  /** Weather entries that were not applied; see WeatherSection. */
  rejectedEntries?: RejectedEntries;
  onRejectedEntryChange?: (key: RejectedEntryKey, entry: RejectedEntry | null) => void;
}

export default function AppInputs({
  state,
  onStateUpdate,
  airportRunways,
  runwayStatus,
  useFahrenheit,
  notifications = [],
  stepStatuses,
  rejectedEntries,
  onRejectedEntryChange,
}: WorksheetFormProps): ReactNode {
  const handleUpdate = (data: Partial<WorksheetData>) => {
    onStateUpdate(data);
  };
  const steps = stepStatuses ?? deriveStepStatuses(state, null, notifications);

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
        <InlineNotifications
          notifications={notifications}
          subject={stepSubject("sortie")}
        />
        <SortieInfo
          onUpdate={handleUpdate}
          initialData={state}
          notifications={notifications}
        />
      </StepShell>
      <StepShell
        id="step-weather"
        number={2}
        status={steps.weather}
        badge={formatStepBadge(steps.counts.weather)}
        title="Weather"
        subtitle="Winds aloft, terminal conditions, and advisories"
      >
        <InlineNotifications
          notifications={notifications}
          subject={stepSubject("weather")}
        />
        <WeatherSection
          state={state}
          onUpdate={handleUpdate}
          airportRunways={airportRunways}
          runwayStatus={runwayStatus}
          useFahrenheit={useFahrenheit}
          notifications={notifications}
          rejectedEntries={rejectedEntries}
          onRejectedEntryChange={onRejectedEntryChange}
        />
      </StepShell>
    </div>
  );
}
