"use client";

import type { URLSerializable } from "@/utils/types";
import type { SortieData } from "@/components/SortieInfo";
import type { WeatherData } from "@/components/WeatherInfo";
import type { AircraftPerformanceData } from "@/components/AircraftPerformance";
import type { AircraftWeightData } from "@/components/AircraftWeight";
import type { MountainQualsData } from "@/components/MountainQuals";

type State = {
  sortie: URLSerializable<SortieData>;
  wx: URLSerializable<WeatherData>;
  perf: URLSerializable<AircraftPerformanceData>;
  wgt: URLSerializable<AircraftWeightData>;
  mtnQuals: URLSerializable<MountainQualsData>;
};

interface CalculationsProps {
  state: State;
}

export default function Calculations({ state }: CalculationsProps) {
  // Calculate density altitude for departure
  const getDensityAltitude = (
    temp: number | null,
    altimeter: number | null
  ) => {
    if (!temp || !altimeter) return null;
    // This is a simplified formula - you might want to use a more accurate one
    return Math.round(altimeter + 120 * (temp - 15));
  };

  const depDA =
    state.perf?.temp?.dep !== undefined && state.perf?.alttd?.dep !== undefined
      ? getDensityAltitude(
          Number(state.perf.temp.dep),
          Number(state.perf.alttd.dep)
        )
      : null;
  const opDA =
    state.perf?.temp?.op !== undefined && state.perf?.alttd?.op !== undefined
      ? getDensityAltitude(
          Number(state.perf.temp.op),
          Number(state.perf.alttd.op)
        )
      : null;
  const arrDA =
    state.perf?.temp?.arr !== undefined && state.perf?.alttd?.arr !== undefined
      ? getDensityAltitude(
          Number(state.perf.temp.arr),
          Number(state.perf.alttd.arr)
        )
      : null;

  return (
    <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <h3 className="font-semibold mb-2">Departure Airport</h3>
          <p>
            Density Altitude: {depDA ? `${depDA.toLocaleString()} ft` : "N/A"}
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <h3 className="font-semibold mb-2">Operating Area</h3>
          <p>
            Density Altitude: {opDA ? `${opDA.toLocaleString()} ft` : "N/A"}
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <h3 className="font-semibold mb-2">Arrival Airport</h3>
          <p>
            Density Altitude: {arrDA ? `${arrDA.toLocaleString()} ft` : "N/A"}
          </p>
        </div>
      </div>

      {/* Add more calculations as needed */}
    </div>
  );
}
