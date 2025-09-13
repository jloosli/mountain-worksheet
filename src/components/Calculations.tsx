"use client";

import type { URLSerializable } from "@/utils/types";
import type { SortieData } from "@/components/SortieInfo";
import type { WeatherData } from "@/components/WeatherInfo";
import type { AircraftPerformanceData } from "@/components/AircraftPerformance";
import type { AircraftWeightData } from "@/components/AircraftWeight";
import type { MountainQualsData } from "@/components/MountainQuals";
import Altitudes from "@/components/Altitudes";
import {
  altitudeToPressureAltitude,
  pressureAltitudeToDensityAltitude,
} from "@/utils/formulas";
import { useEffect, useState } from "react";

type State = {
  sortie: URLSerializable<SortieData>;
  wx: URLSerializable<WeatherData>;
  perf: URLSerializable<AircraftPerformanceData>;
  wgt: URLSerializable<AircraftWeightData>;
  mtnQuals: URLSerializable<MountainQualsData>;
};

interface CalculationsProps {
  perf: State["perf"];
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
      perf?.temp?.dep !== undefined && perf?.alttd?.dep !== undefined
        ? altitudeToPressureAltitude(
            Number(perf.alttd.dep),
            Number(perf?.altr?.dep)
          )
        : null;
    const departureDensityAltitude =
      departurePressureAltitude !== undefined && perf?.alttd?.dep !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(departurePressureAltitude),
            Number(perf?.temp?.dep)
          )
        : null;
    const operatingPressureAltitude =
      perf?.temp?.op !== undefined && perf?.alttd?.op !== undefined
        ? altitudeToPressureAltitude(
            Number(perf.alttd.op),
            Number(perf?.altr?.op)
          )
        : null;
    const operatingDensityAltitude =
      operatingPressureAltitude !== undefined && perf?.alttd?.op !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(operatingPressureAltitude),
            Number(perf?.temp?.op)
          )
        : null;
    const arrivalPressureAltitude =
      perf?.temp?.arr !== undefined && perf?.alttd?.arr !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(perf.alttd.arr),
            Number(perf?.altr?.arr)
          )
        : null;
    const arrivalDensityAltitude =
      arrivalPressureAltitude !== undefined && perf?.alttd?.arr !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(arrivalPressureAltitude),
            Number(perf?.temp?.arr)
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
  }, [
    perf?.temp?.dep,
    perf?.temp?.op,
    perf?.temp?.arr,
    perf?.alttd?.dep,
    perf?.alttd?.op,
    perf?.alttd?.arr,
    perf?.altr?.dep,
    perf?.altr?.op,
    perf?.altr?.arr,
  ]);

  return (
    <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>

      <div className="space-y-4">
        <Altitudes
          departureActual={Number(perf?.alttd?.dep) ?? null}
          departurePA={pressures.departurePA}
          departureDA={pressures.departureDA}
          altitudeActual={Number(perf?.alttd?.op) ?? null}
          altitudePA={pressures.altitudePA}
          altitudeDA={pressures.altitudeDA}
          arrivalActual={Number(perf?.alttd?.arr) ?? null}
          arrivalPA={pressures.arrivalPA}
          arrivalDA={pressures.arrivalDA}
        />
      </div>

      {/* Add more calculations as needed */}
    </div>
  );
}
