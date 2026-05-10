"use client";

import { useState } from "react";
import AppInputs from "@/components/AppInputs";
import Calculations from "@/components/Calculations";
import MountainFlyingChecklist from "@/components/MountainFlyingChecklist";
import WorksheetHeader from "@/components/WorksheetHeader";
import { useUrlState } from "@/utils/useUrlState";
import { useTempUnit } from "@/utils/useTempUnit";
import type { WorksheetData } from "@/utils/types";

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

  const handleUpdate = (updates: Partial<WorksheetData>) => {
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
        worksheetData={state}
        onWeatherDataUpdate={handleWeatherDataUpdate}
        onWeatherTimestampUpdate={handleWeatherTimestampUpdate}
        weatherLastUpdated={weatherLastUpdated ?? undefined}
        useFahrenheit={useFahrenheit}
        onToggleTempUnit={toggleTempUnit}
      />
      <main className="flex-1 w-full flex justify-center px-2 md:px-8 pb-20">
        <div className="w-full max-w-5xl flex flex-col gap-16 items-center">
          <AppInputs
            state={state}
            onStateUpdate={handleUpdate}
            weatherLastUpdated={weatherLastUpdated ?? undefined}
            useFahrenheit={useFahrenheit}
          />
          <Calculations state={state} />
          <MountainFlyingChecklist />
        </div>
      </main>
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
