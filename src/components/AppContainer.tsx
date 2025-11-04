"use client";

import { useState } from "react";
import AppInputs from "@/components/AppInputs";
import Calculations from "@/components/Calculations";
import WorksheetHeader from "@/components/WorksheetHeader";
import { useUrlState } from "@/utils/useUrlState";
import type { URLSerializable, WorksheetData } from "@/utils/types";

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
  const [state, setState] = useUrlState<
    WorksheetData,
    URLSerializable<WorksheetData>
  >({
    // Sortie Information
    pilot: "",
    date: defaultSortieDateTime.date,
    time: defaultSortieDateTime.time,
    acType: "",
    tailN: "",
    airport: ["", ""],
    route: "",

    // Weather Information
    wind: [
      Array(5).fill(0), // wDir values for 3k,6k,9k,12k,15k
      Array(5).fill(0), // wVel values for 3k,6k,9k,12k,15k
      Array(5).fill(0), // temp values for 3k,6k,9k,12k,15k
    ],
    turb: false,
    cielVis: false,
    mtnObsc: false,

    // Aircraft Performance
    temp: [null, null, null],
    altimeter: [null, null, null],
    altitude: [null, null, null],
    rwy: [null, null],

    // Aircraft Weight
    weight: null,

    // Mountain Qualifications
    mtnEndorse: false,
    mtnCert: false,
  });

  const [weatherLastUpdated, setWeatherLastUpdated] = useState<Date | null>(
    null
  );

  const handleUpdate = (updates: Partial<URLSerializable<WorksheetData>>) => {
    setState((prev) => {
      const merged = { ...prev, ...updates } as URLSerializable<WorksheetData>;
      return merged;
    });
  };

  const handleWeatherDataUpdate = (data: Partial<WorksheetData>) => {
    handleUpdate(data as Partial<URLSerializable<WorksheetData>>);
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
      />
      <main className="flex-1 w-full flex justify-center px-2 md:px-8 pb-20">
        <div className="w-full max-w-5xl flex flex-col gap-16 items-center">
          <AppInputs
            state={state}
            onStateUpdate={handleUpdate}
            weatherLastUpdated={weatherLastUpdated ?? undefined}
          />
          <Calculations state={state} />
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
