"use client";

import { type ReactNode } from "react";
import SortieInfo, { SortieData } from "@/components/SortieInfo";
import WeatherInfo, { WeatherData } from "@/components/WeatherInfo";
import AircraftPerformance, {
  AircraftPerformanceData,
} from "@/components/AircraftPerformance";
import AircraftWeight, {
  AircraftWeightData,
} from "@/components/AircraftWeight";
import MountainQuals, { MountainQualsData } from "@/components/MountainQuals";
import type { URLSerializable } from "@/utils/types";
import { LinkIcon } from "@heroicons/react/24/solid";

type State = {
  sortie: URLSerializable<SortieData>;
  wx: URLSerializable<WeatherData>;
  perf: URLSerializable<AircraftPerformanceData>;
  wgt: URLSerializable<AircraftWeightData>;
  mtnQuals: URLSerializable<MountainQualsData>;
};

interface WorksheetFormProps {
  state: State;
  onStateUpdate: (
    key: keyof State,
    data: URLSerializable<
      | SortieData
      | WeatherData
      | AircraftPerformanceData
      | AircraftWeightData
      | MountainQualsData
    >
  ) => void;
}

export default function WorksheetForm({
  state,
  onStateUpdate,
}: WorksheetFormProps): ReactNode {
  const handleSortieUpdate = (data: URLSerializable<SortieData>) => {
    onStateUpdate("sortie", data);
  };

  const handleWeatherUpdate = (data: URLSerializable<WeatherData>) => {
    onStateUpdate("wx", data);
  };

  const handlePerformanceUpdate = (
    data: URLSerializable<AircraftPerformanceData>
  ) => {
    onStateUpdate("perf", data);
  };

  const handleWeightUpdate = (data: URLSerializable<AircraftWeightData>) => {
    onStateUpdate("wgt", data);
  };

  const handleMountainQualsUpdate = (
    data: URLSerializable<MountainQualsData>
  ) => {
    onStateUpdate("mtnQuals", data);
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
      <SortieInfo onUpdate={handleSortieUpdate} initialData={state.sortie} />
      <WeatherInfo onUpdate={handleWeatherUpdate} initialData={state.wx} />
      <AircraftPerformance
        onUpdate={handlePerformanceUpdate}
        initialData={state.perf}
      />
      <AircraftWeight onUpdate={handleWeightUpdate} initialData={state.wgt} />
      <MountainQuals
        onUpdate={handleMountainQualsUpdate}
        initialData={state.mtnQuals}
      />
    </div>
  );
}
