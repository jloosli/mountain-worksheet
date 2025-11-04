"use client";

import { type ReactNode } from "react";
import SortieInfo from "@/components/SortieInfo";
import WeatherInfo from "@/components/WeatherInfo";
import AircraftPerformance from "@/components/AircraftPerformance";
import MountainQuals from "@/components/MountainQuals";
import type { URLSerializable, WorksheetData } from "@/utils/types";

interface WorksheetFormProps {
  state: URLSerializable<WorksheetData>;
  onStateUpdate: (updates: Partial<URLSerializable<WorksheetData>>) => void;
  weatherLastUpdated?: Date;
}

export default function AppInputs({
  state,
  onStateUpdate,
  weatherLastUpdated,
}: WorksheetFormProps): ReactNode {
  const handleUpdate = (data: Partial<URLSerializable<WorksheetData>>) => {
    onStateUpdate(data);
  };

  // Extract data for each component
  const sortieData = {
    pilot: state.pilot || "",
    date: state.date || "",
    time: state.time || "",
    acType: state.acType || "",
    tailN: state.tailN || "",
    airport: state.airport || ["", ""],
    route: state.route || "",
    weight: state.weight || null,
  };

  const weatherData = {
    wind: state.wind || [Array(5).fill(0), Array(5).fill(0), Array(5).fill(0)],
    turb: state.turb || false,
    cielVis: state.cielVis || false,
    mtnObsc: state.mtnObsc || false,
  };

    const perfData = {
      airport: state.airport || ["", ""],
      temp: state.temp || [null, null, null],
      altimeter: state.altimeter || [null, null, null],
      altitude: state.altitude || [null, null, null],
      rwy: state.rwy || [null, null],
    };

    const mtnQualsData = {
      mtnEndorse: state.mtnEndorse || false,
      mtnCert: state.mtnCert || false,
    };

    return (
      <div className="flex w-full max-w-4xl flex-col gap-8">
        <SortieInfo onUpdate={handleUpdate} initialData={sortieData} />
        <MountainQuals onUpdate={handleUpdate} initialData={mtnQualsData} />
        <WeatherInfo
          onUpdate={handleUpdate}
          initialData={weatherData}
          worksheetData={state}
          lastUpdated={weatherLastUpdated}
        />
        <AircraftPerformance
          onUpdate={handleUpdate}
          initialData={perfData}
          worksheetData={state}
        />
      </div>
    );
}
