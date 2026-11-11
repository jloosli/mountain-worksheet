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
import { deriveActionBarState } from "@/utils/actionBarState";
import {
  applyOpTempForAltitudeChange,
  describeOpTempChange,
  opTempChangeNotifications,
  type OpTempChange,
} from "@/utils/areaOfOpsWeather";
import { deriveStepStatuses, formatStepBadge } from "@/utils/stepStatuses";
import InlineNotifications from "@/components/InlineNotifications";
import { LimitCheckCallouts } from "@/components/LimitCheckCallout";
import {
  deriveNotifications,
  staleFetchNotifications,
  stepSubject,
  type WeatherFetchResult,
} from "@/utils/notifications";
import {
  computeClimbViewModel,
  computePressureColumns,
  computeTOLDViewModel,
  derivePerformanceNotifications,
} from "@/utils/derived";
import { deriveLimitChecks } from "@/utils/limitChecks";
import type { WorksheetData } from "@/utils/types";
import { unverifiedWeatherNotifications } from "@/utils/unverifiedWeather";
import {
  rejectedEntryNotifications,
  retireRejectedEntries,
  updateRejectedEntries,
  type RejectedEntries,
  type RejectedEntry,
  type RejectedEntryKey,
} from "@/utils/rejectedEntries";
import { useTempUnit } from "@/utils/useTempUnit";
import { useUrlState } from "@/utils/useUrlState";
import { useAirportRunwayLookup } from "@/utils/useAirportRunways";
import {
  deriveUrlNotifications,
  retireUrlNotifications,
  sanitizeWorksheetUrlState,
} from "@/utils/worksheetUrlState";

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
  // Values a shared link coerced or passed through are cleared (or reset)
  // with a Warning on their field.
  const [state, setState, urlLoad] = useUrlState(
    initialWorksheet,
    (loaded, query) =>
      sanitizeWorksheetUrlState(loaded, query, initialWorksheet)
  );

  // The link's notifications still in force; each is retired for good once
  // the pilot or a weather fetch supersedes the value it is about.
  const [linkLoad, setLinkLoad] = useState(urlLoad);

  const [weatherLastUpdated, setWeatherLastUpdated] = useState<Date | null>(
    null
  );

  // The latest weather fetch (session only). Notifications are derived from
  // it plus current state during render, so they clear when their cause does.
  const [weatherFetch, setWeatherFetch] = useState<WeatherFetchResult | null>(
    null
  );

  const runwayLookup = useAirportRunwayLookup(state.airport, state.rwy);

  // The latest operating-temperature re-derivation (#117). Its notifications
  // are derived from it plus current state, so they clear once the pilot
  // overrides the temperature or changes the altitude again.
  const [opTempChange, setOpTempChange] = useState<OpTempChange | null>(null);

  // Weather entries the pilot typed that were out of range and not applied.
  // Held here so their Warnings join the one notifications list (step
  // status, badge, Briefing).
  const [rejectedEntries, setRejectedEntries] = useState<RejectedEntries>({});
  const handleRejectedEntryChange = (
    key: RejectedEntryKey,
    entry: RejectedEntry | null
  ) => setRejectedEntries((prev) => updateRejectedEntries(state, prev, key, entry));

  const [overlay, setOverlay] = useState<"instructions" | "checklist" | null>(
    null
  );
  const handleOpenInstructions = () => setOverlay("instructions");
  const handleOpenChecklist = () => setOverlay("checklist");
  const handleCloseOverlay = () => setOverlay(null);

  const notifications = useMemo(
    () => [
      ...deriveNotifications(state, weatherFetch),
      ...staleFetchNotifications(state, weatherFetch),
      ...runwayLookup.notifications,
      ...opTempChangeNotifications(state, opTempChange),
      ...deriveUrlNotifications(state, linkLoad),
      ...unverifiedWeatherNotifications(state, weatherLastUpdated),
      ...derivePerformanceNotifications(state),
      ...rejectedEntryNotifications(state, rejectedEntries),
    ],
    [
      state,
      weatherFetch,
      runwayLookup.notifications,
      opTempChange,
      linkLoad,
      weatherLastUpdated,
      rejectedEntries,
    ]
  );

  // Limit checks are derived during render and read by the action bar and
  // every step. They don't feed step status or badges (ADR 0002).
  const { PAs } = computePressureColumns(state.altitude, state.altimeter, state.temp);
  const limitChecks = deriveLimitChecks({
    state,
    notifications,
    climb: computeClimbViewModel(state, notifications),
    told: computeTOLDViewModel(state, PAs, notifications),
  });

  const stepStatuses = useMemo(
    () => deriveStepStatuses(state, weatherLastUpdated, notifications),
    [state, weatherLastUpdated, notifications]
  );

  const actionBarState = useMemo(
    () => deriveActionBarState(state, weatherLastUpdated),
    [state, weatherLastUpdated]
  );

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

  /**
   * `fetched` marks an update a weather fetch applied: rejected entries and
   * link notifications for the fields it filled are retired even when the
   * value is unchanged.
   */
  const handleUpdate = (updates: Partial<WorksheetData>, fetched = false) => {
    const merged = { ...state, ...updates } as WorksheetData;
    const replaced = fetched ? updates : undefined;
    setRejectedEntries((prev) => retireRejectedEntries(merged, prev, replaced));
    setLinkLoad((prev) => prev && retireUrlNotifications(prev, merged, replaced));
    const change = describeOpTempChange(state, updates, {
      fetchedOpTemp: weatherFetch?.applied.temp?.[1] ?? null,
      previous: opTempChange,
    });
    if (change) setOpTempChange(change);
    setState((prev: WorksheetData) => {
      const merged = { ...prev, ...updates } as WorksheetData;
      // Issue #117: When the user changes the operating altitude, re-derive
      // temp[1] from the persisted winds-aloft temps so it tracks the air
      // temperature at the new altitude instead of staying frozen at the
      // last weather fetch.
      const nextTemp = applyOpTempForAltitudeChange(prev, updates);
      if (nextTemp) merged.temp = nextTemp;
      return merged;
    });
  };

  const handleWeatherDataUpdate = (data: Partial<WorksheetData>) => {
    handleUpdate(data, true);
  };

  const handleWeatherTimestampUpdate = (timestamp: Date) => {
    setWeatherLastUpdated(timestamp);
  };

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
        onDataUpdate={handleWeatherDataUpdate}
        onTimestampUpdate={handleWeatherTimestampUpdate}
        onFetchResult={setWeatherFetch}
        hideBox
        renderButton={({ onClick, disabled, isLoading }) => (
          <ActionBar
            state={actionBarState}
            worksheetData={state}
            limitChecks={limitChecks}
            weatherLastUpdated={weatherLastUpdated ?? undefined}
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
            notifications={notifications}
            limitChecks={limitChecks}
            stepStatuses={stepStatuses}
            rejectedEntries={rejectedEntries}
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
            <Calculations
              state={state}
              notifications={notifications}
              limitChecks={limitChecks}
            />
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
        <ChecklistPanel />
      </SlideOver>
      <PrintBriefing state={state} notifications={notifications} />
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
