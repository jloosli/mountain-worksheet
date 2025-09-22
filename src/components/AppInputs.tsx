"use client";

import { type ReactNode } from "react";
import SortieInfo from "@/components/SortieInfo";
import WeatherInfo from "@/components/WeatherInfo";
import AircraftPerformance from "@/components/AircraftPerformance";
import AircraftWeight from "@/components/AircraftWeight";
import MountainQuals from "@/components/MountainQuals";
import type { URLSerializable, WorksheetData } from "@/utils/types";
import { LinkIcon } from "@heroicons/react/24/solid";

interface WorksheetFormProps {
  state: URLSerializable<WorksheetData>;
  onStateUpdate: (updates: Partial<URLSerializable<WorksheetData>>) => void;
}

export default function AppInputs({
  state,
  onStateUpdate,
}: WorksheetFormProps): ReactNode {
  const handleUpdate = (
    data: Partial<URLSerializable<WorksheetData>>
  ) => {
    onStateUpdate(data);
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

  // Extract data for each component
  const sortieData = {
    pilot: state.pilot || "",
    sDate: state.sDate || "",
    sTime: state.sTime || "",
    acft: state.acft || "",
    tailN: state.tailN || "",
  };

  const weatherData = {
    wind: state.wind || [Array(5).fill(0), Array(5).fill(0), Array(5).fill(0)],
    turb: state.turb || false,
    cielVis: state.cielVis || false,
    mtnObsc: state.mtnObsc || false,
  };

  const perfData = {
    apt: state.apt || ["", ""],
    temp: state.temp || [21, 21, 21],
    altr: state.altr || [29.92, 29.92, 29.92],
    alttd: state.alttd || [8000, 8000, 8000],
    rwy: state.rwy || [1000, 1000],
  };

  const weightData = {
    wgt: state.wgt || null,
  };

  const mtnQualsData = {
    mtnEndorse: state.mtnEndorse || false,
    mtnCert: state.mtnCert || false,
  };

  return (
    <div className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
      <div className="flex flex-col gap-4 items-center sm:items-start">
        <h1 className="text-4xl font-bold">Mountain Flying Worksheet</h1>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Reset Worksheet
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <LinkIcon className="h-5 w-5" />
            Copy Link
          </button>
        </div>
      </div>
      <SortieInfo onUpdate={handleUpdate} initialData={sortieData} />
      <WeatherInfo onUpdate={handleUpdate} initialData={weatherData} />
      <AircraftPerformance
        onUpdate={handleUpdate}
        initialData={perfData}
      />
      <AircraftWeight onUpdate={handleUpdate} initialData={weightData} />
      <MountainQuals
        onUpdate={handleUpdate}
        initialData={mtnQualsData}
      />
    </div>
  );
}
