"use client";

import { useMemo, useState } from "react";
import ActionBar from "@/components/ActionBar";
import AppInputs from "@/components/AppInputs";
import Calculations from "@/components/Calculations";
import ChecklistPanel from "@/components/ChecklistPanel";
import InstructionsPanel from "@/components/InstructionsPanel";
import SlideOver from "@/components/SlideOver";
import Stepper, { type StepperStep } from "@/components/Stepper";
import StepShell from "@/components/StepShell";
import WeatherDataIntegration from "@/components/WeatherDataIntegration";
import WorksheetHeader from "@/components/WorksheetHeader";
import { deriveActionBarState } from "@/utils/actionBarState";
import { deriveStepStatuses } from "@/utils/stepStatuses";
import type { AirportRunwayInfo, RunwayOption, WorksheetData } from "@/utils/types";
import { useTempUnit } from "@/utils/useTempUnit";
import { useUrlState } from "@/utils/useUrlState";

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
  const [state, setState] = useUrlState({
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
  } as WorksheetData);

  const [weatherLastUpdated, setWeatherLastUpdated] = useState<Date | null>(
    null
  );

  const [airportRunways, setAirportRunways] = useState<
    [RunwayOption[] | null, RunwayOption[] | null]
  >([null, null]);

  const handleAirportInfoUpdate = (info: AirportRunwayInfo) => {
    setAirportRunways([info.departure, info.arrival]);
  };

  const [overlay, setOverlay] = useState<"instructions" | "checklist" | null>(
    null
  );
  const handleOpenInstructions = () => setOverlay("instructions");
  const handleOpenChecklist = () => setOverlay("checklist");
  const handleCloseOverlay = () => setOverlay(null);

  const stepStatuses = useMemo(
    () => deriveStepStatuses(state, weatherLastUpdated),
    [state, weatherLastUpdated]
  );

  const actionBarState = useMemo(
    () => deriveActionBarState(state, weatherLastUpdated),
    [state, weatherLastUpdated]
  );

  const steps = useMemo<StepperStep[]>(
    () => [
      { id: "step-sortie", number: 1, label: "Sortie Details", status: stepStatuses.sortie },
      { id: "step-weather", number: 2, label: "Weather", status: stepStatuses.weather },
      { id: "step-decision", number: 3, label: "Decision", status: stepStatuses.decision },
    ],
    [stepStatuses]
  );

  const handleUpdate = (updates: Partial<WorksheetData>) => {
    // Clear stale runway options when the user edits an airport code — the
    // dropdown options were fetched for a specific ICAO and shouldn't carry
    // over to a different one. WeatherDataIntegration's onDataUpdate also
    // includes airport in its merged payload, so compare values rather than
    // just checking for the key's presence — otherwise a successful fetch
    // would stomp the runways that just landed.
    if (
      updates.airport !== undefined &&
      (updates.airport[0] !== state.airport[0] ||
        updates.airport[1] !== state.airport[1])
    ) {
      setAirportRunways([null, null]);
    }
    setState((prev: WorksheetData) => {
      const merged = { ...prev, ...updates } as WorksheetData;
      return merged;
    });
  };

  const handleWeatherDataUpdate = (data: Partial<WorksheetData>) => {
    handleUpdate(data);
  };

  const handleWeatherTimestampUpdate = (timestamp: Date) => {
    setWeatherLastUpdated(timestamp);
  };

  const handleReset = () => {
    window.history.replaceState({}, "", window.location.pathname);
    window.location.reload();
  };

  const handleShare = async () => {
    const shareLink = window.location.href.replace(/%22/g, '"');
    try {
      await navigator.clipboard.writeText(shareLink);
      alert("URL copied to clipboard!");
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full">
      <WorksheetHeader
        onReset={handleReset}
        onShare={handleShare}
        useFahrenheit={useFahrenheit}
        onToggleTempUnit={toggleTempUnit}
        onOpenInstructions={handleOpenInstructions}
      />
      <Stepper steps={steps} />
      <WeatherDataIntegration
        worksheetData={state}
        onDataUpdate={handleWeatherDataUpdate}
        onTimestampUpdate={handleWeatherTimestampUpdate}
        onAirportInfoUpdate={handleAirportInfoUpdate}
        hideBox
        renderButton={({ onClick, disabled, isLoading }) => (
          <ActionBar
            state={actionBarState}
            worksheetData={state}
            weatherLastUpdated={weatherLastUpdated ?? undefined}
            onFetch={onClick}
            fetchDisabled={disabled}
            isFetching={isLoading}
            onOpenChecklist={handleOpenChecklist}
          />
        )}
      />
      <main className="flex-1 w-full flex justify-center pb-20">
        <div className="w-full max-w-5xl flex flex-col space-y-6 px-4 md:px-6">
          <AppInputs
            state={state}
            onStateUpdate={handleUpdate}
            useFahrenheit={useFahrenheit}
            airportRunways={airportRunways}
          />
          <StepShell
            id="step-decision"
            number={3}
            status={stepStatuses.decision}
            title="Decision"
            subtitle="Go / no-go summary, with detailed calculations below"
            showSpine={false}
          >
            <Calculations state={state} />
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
      <footer className="w-full py-4 px-2 md:px-8 text-center text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800">
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
