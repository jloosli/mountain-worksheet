"use client";

import { useEffect, useMemo, useState } from "react";
import ActionBar from "@/components/ActionBar";
import AppInputs from "@/components/AppInputs";
import Calculations from "@/components/Calculations";
import ChecklistPanel from "@/components/ChecklistPanel";
import InstructionsPanel from "@/components/InstructionsPanel";
import PrintBriefing from "@/components/PrintBriefing";
import SlideOver from "@/components/SlideOver";
import Stepper, { type StepperStep } from "@/components/Stepper";
import StepShell from "@/components/StepShell";
import WeatherDataIntegration from "@/components/WeatherDataIntegration";
import WorksheetHeader, { type ShareStatus } from "@/components/WorksheetHeader";
import { formatStepBadge } from "@/utils/stepStatuses";
import InlineNotifications from "@/components/InlineNotifications";
import { LimitCheckCallouts } from "@/components/LimitCheckCallout";
import { stepSubject } from "@/utils/notifications";
import type { WorksheetData } from "@/utils/types";
import { evaluateWorksheet } from "@/utils/worksheetEvaluation";
import type { RejectedEntry, RejectedEntryKey } from "@/utils/rejectedEntries";
import { useTempUnit } from "@/utils/useTempUnit";
import { useUrlReducer } from "@/utils/useUrlState";
import { useAirportRunwayLookup } from "@/utils/useAirportRunways";
import {
  canFetch,
  initialWeatherSession,
  weatherSessionReducer,
  weatherStatus,
  type WeatherSession,
} from "@/utils/weatherSession";
import { sanitizeWorksheetUrlState } from "@/utils/worksheetUrlState";

const worksheetOf = (session: WeatherSession) => session.worksheet;

const getDefaultSortieDateTime = () => {
  const now = new Date();
  const nextHour = new Date(now);

  if (
    now.getUTCMinutes() > 0 ||
    now.getUTCSeconds() > 0 ||
    now.getUTCMilliseconds() > 0
  ) {
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  }

  nextHour.setUTCMinutes(0, 0, 0);

  return {
    date: nextHour.toISOString().split("T")[0],
    time: `${String(nextHour.getUTCHours()).padStart(2, "0")}:00`,
  };
};

export default function AppContainer() {
  const defaultSortieDateTime = getDefaultSortieDateTime();
  const { useFahrenheit, toggleTempUnit } = useTempUnit();
  const initialWorksheet = {
    // Sortie Information
    pilot: "",
    date: defaultSortieDateTime.date,
    time: defaultSortieDateTime.time,
    acType: "",
    tailN: "",
    airport: ["", ""] as [string, string],
    route: "",
    position: [null, null] as [number | null, number | null],

    // Weather Information
    wind: [
      Array(5).fill(null) as (number | null)[], // wDir values for 3k,6k,9k,12k,15k
      Array(5).fill(null) as (number | null)[], // wVel values for 3k,6k,9k,12k,15k
      Array(5).fill(null) as (number | null)[], // temp values for 3k,6k,9k,12k,15k
    ] as [(number | null)[], (number | null)[], (number | null)[]],
    turb: false,
    cielVis: false,
    mtnObsc: false,

    // Aircraft Performance
    temp: [null, null, null] as [number | null, number | null, number | null],
    altimeter: [null, null, null] as [
      number | null,
      number | null,
      number | null
    ],
    altitude: [null, null, null] as [
      number | null,
      number | null,
      number | null
    ],
    rwy: [null, null] as [number | null, number | null],

    // Aircraft Weight
    weight: null,
    duration: null,

    // Mountain Qualifications
    mtnEndorse: false,
    mtnCert: false,
  } as WorksheetData;
  // The worksheet and what this session remembers about it, as one pure
  // reducer (`weatherSession.ts`). Values a shared link coerced or passed
  // through are cleared (or reset) with a Warning on their field.
  const [session, dispatch] = useUrlReducer(
    weatherSessionReducer,
    initialWorksheet,
    initialWeatherSession,
    worksheetOf,
    (loaded, query) => sanitizeWorksheetUrlState(loaded, query, initialWorksheet)
  );
  const state = session.worksheet;

  const runwayLookup = useAirportRunwayLookup(state.airport, state.rwy);

  const handleRejectedEntryChange = (
    key: RejectedEntryKey,
    entry: RejectedEntry | null
  ) => dispatch({ type: "entryRejected", key, entry });

  const [overlay, setOverlay] = useState<"instructions" | "checklist" | null>(
    null
  );
  const handleOpenInstructions = () => setOverlay("instructions");
  const handleOpenChecklist = () => setOverlay("checklist");
  const handleCloseOverlay = () => setOverlay(null);

  // Every notification, computed value, Limit check and step status, derived
  // during render from the worksheet and this session.
  const evaluation = useMemo(
    () =>
      evaluateWorksheet(state, {
        ...session,
        runwayNotifications: runwayLookup.notifications,
      }),
    [state, session, runwayLookup.notifications]
  );
  const { notifications, limitChecks, stepStatuses } = evaluation;

  const actionBarState = weatherStatus(session);

  const steps = useMemo<StepperStep[]>(
    () => [
      {
        id: "step-sortie",
        number: 1,
        label: "Sortie Details",
        status: stepStatuses.sortie,
        badge: formatStepBadge(stepStatuses.counts.sortie),
      },
      {
        id: "step-weather",
        number: 2,
        label: "Weather",
        status: stepStatuses.weather,
        badge: formatStepBadge(stepStatuses.counts.weather),
      },
      {
        id: "step-decision",
        number: 3,
        label: "Decision",
        status: stepStatuses.decision,
        badge: formatStepBadge(stepStatuses.counts.decision),
      },
    ],
    [stepStatuses]
  );

  const handleUpdate = (updates: Partial<WorksheetData>) =>
    dispatch({ type: "edit", updates });

  const handleReset = () => {
    window.history.replaceState({}, "", window.location.pathname);
    window.location.reload();
  };

  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null);

  // A successful copy is confirmed briefly; a failure stays until the next try.
  useEffect(() => {
    if (shareStatus?.kind !== "copied") return;
    const timer = setTimeout(() => setShareStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [shareStatus]);

  const handleShare = async () => {
    const shareLink = window.location.href.replace(/%22/g, '"');
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareStatus({ kind: "copied" });
    } catch (error) {
      // Developer diagnostic; the pilot sees the failure in the header.
      console.error("Error sharing:", error);
      setShareStatus({
        kind: "failed",
        link: shareLink,
        reason: error instanceof Error ? error.message : "clipboard unavailable",
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col flex-1 w-full">
      <WorksheetHeader
        onReset={handleReset}
        onShare={handleShare}
        shareStatus={shareStatus}
        useFahrenheit={useFahrenheit}
        onToggleTempUnit={toggleTempUnit}
        onOpenInstructions={handleOpenInstructions}
      />
      <Stepper steps={steps} />
      <WeatherDataIntegration
        worksheetData={state}
        canFetch={canFetch(session)}
        onFetched={dispatch}
        renderButton={({ onClick, disabled, isLoading }) => (
          <ActionBar
            state={actionBarState}
            worksheetData={state}
            limitChecks={limitChecks}
            weatherLastUpdated={session.lastUpdated ?? undefined}
            onFetch={onClick}
            fetchDisabled={disabled}
            isFetching={isLoading}
            onOpenChecklist={handleOpenChecklist}
            onPrint={handlePrint}
          />
        )}
      />
      <main className="flex-1 w-full flex justify-center pb-20 print:hidden">
        <div className="w-full max-w-5xl flex flex-col space-y-6 px-4 md:px-6">
          <AppInputs
            state={state}
            onStateUpdate={handleUpdate}
            useFahrenheit={useFahrenheit}
            airportRunways={runwayLookup.runways}
            runwayStatus={runwayLookup.status}
            evaluation={evaluation}
            rejectedEntries={session.rejected}
            onRejectedEntryChange={handleRejectedEntryChange}
          />
          <StepShell
            id="step-decision"
            number={3}
            status={stepStatuses.decision}
            badge={formatStepBadge(stepStatuses.counts.decision)}
            title="Decision"
            subtitle="Worksheet limits and detailed calculations"
            showSpine={false}
          >
            <LimitCheckCallouts checks={limitChecks} step="decision" />
            <InlineNotifications
              notifications={notifications}
              subject={stepSubject("decision")}
              className="mb-4"
            />
            <Calculations state={state} evaluation={evaluation} />
          </StepShell>
        </div>
      </main>
      <SlideOver
        isOpen={overlay === "instructions"}
        onClose={handleCloseOverlay}
        title="Instructions & Operational Notes"
      >
        <InstructionsPanel />
      </SlideOver>
      <SlideOver
        isOpen={overlay === "checklist"}
        onClose={handleCloseOverlay}
        title="Mountain Flying Checklist"
      >
        <ChecklistPanel checks={limitChecks} />
      </SlideOver>
      <PrintBriefing state={state} evaluation={evaluation} />
      <footer className="w-full py-4 px-2 md:px-8 text-center text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 print:hidden">
        Found an issue or bug?{" "}
        <a
          href="https://github.com/jloosli/mountain-worksheet/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          Report it here
        </a>
      </footer>
    </div>
  );
}
