"use client";

import type { WorksheetData } from "@/utils/types";
import Altitudes from "@/components/Altitudes";
import {
  altitudeToPressureAltitude,
  pressureAltitudeToDensityAltitude,
} from "@/utils/formulas";
import { useEffect, useState } from "react";

interface CalculationsProps {
  perf: Pick<WorksheetData, "temp" | "alttd" | "altr">;
}

export default function Calculations({ perf }: CalculationsProps) {
  const [pressures, setPressures] = useState<{
    departurePA: number | null;
    departureDA: number | null;
    altitudePA: number | null;
    altitudeDA: number | null;
    arrivalPA: number | null;
    arrivalDA: number | null;
  }>({
    departurePA: null,
    departureDA: null,
    altitudePA: null,
    altitudeDA: null,
    arrivalPA: null,
    arrivalDA: null,
  });

  useEffect(() => {
    const departurePressureAltitude =
      perf?.temp?.[0] !== undefined && perf?.alttd?.[0] !== undefined
        ? altitudeToPressureAltitude(
            Number(perf.alttd[0]),
            Number(perf?.altr?.[0])
          )
        : null;
    const departureDensityAltitude =
      departurePressureAltitude !== undefined && perf?.alttd?.[0] !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(departurePressureAltitude),
            Number(perf?.temp?.[0])
          )
        : null;
    const operatingPressureAltitude =
      perf?.temp?.[1] !== undefined && perf?.alttd?.[1] !== undefined
        ? altitudeToPressureAltitude(
            Number(perf.alttd[1]),
            Number(perf?.altr?.[1])
          )
        : null;
    const operatingDensityAltitude =
      operatingPressureAltitude !== undefined && perf?.alttd?.[1] !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(operatingPressureAltitude),
            Number(perf?.temp?.[1])
          )
        : null;
    const arrivalPressureAltitude =
      perf?.temp?.[2] !== undefined && perf?.alttd?.[2] !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(perf.alttd[2]),
            Number(perf?.altr?.[2])
          )
        : null;
    const arrivalDensityAltitude =
      arrivalPressureAltitude !== undefined && perf?.alttd?.[2] !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(arrivalPressureAltitude),
            Number(perf?.temp?.[2])
          )
        : null;
    setPressures({
      departurePA: departurePressureAltitude,
      departureDA: departureDensityAltitude,
      altitudePA: operatingPressureAltitude,
      altitudeDA: operatingDensityAltitude,
      arrivalPA: arrivalPressureAltitude,
      arrivalDA: arrivalDensityAltitude,
    });
  }, [perf?.temp, perf?.alttd, perf?.altr]);

  return (
    <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>

      <div className="space-y-4">
        <Altitudes
          departureActual={Number(perf?.alttd?.[0]) ?? null}
          departurePA={pressures.departurePA}
          departureDA={pressures.departureDA}
          altitudeActual={Number(perf?.alttd?.[1]) ?? null}
          altitudePA={pressures.altitudePA}
          altitudeDA={pressures.altitudeDA}
          arrivalActual={Number(perf?.alttd?.[2]) ?? null}
          arrivalPA={pressures.arrivalPA}
          arrivalDA={pressures.arrivalDA}
        />
      </div>

      {/* Add more calculations as needed */}
    </div>
  );
}
