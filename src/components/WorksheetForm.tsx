"use client";

import SortieInfo, { SortieData } from "@/components/SortieInfo";
import WeatherInfo, { WeatherData } from "@/components/WeatherInfo";
import AircraftPerformance, {
  AircraftPerformanceData,
} from "@/components/AircraftPerformance";
import AircraftWeight, {
  AircraftWeightData,
} from "@/components/AircraftWeight";
import MountainQuals, { MountainQualsData } from "@/components/MountainQuals";
import { useUrlState } from "@/utils/useUrlState";
import type { URLSerializable } from "@/utils/types";

type BaseState = {
  sortie: SortieData;
  wx: WeatherData;
  perf: AircraftPerformanceData;
  wgt: AircraftWeightData;
  mtnQuals: MountainQualsData;
};

type State = {
  sortie: URLSerializable<SortieData>;
  wx: URLSerializable<WeatherData>;
  perf: URLSerializable<AircraftPerformanceData>;
  wgt: URLSerializable<AircraftWeightData>;
  mtnQuals: URLSerializable<MountainQualsData>;
};

export default function WorksheetForm() {
  const [state, setState] = useUrlState<BaseState, State>({
    sortie: {
      pilot: "",
      sDate: new Date().toISOString().split("T")[0],
      sTime: new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
      acft: "",
      tailN: "",
    } as URLSerializable<SortieData>,
    wx: {
      wDir: {
        "3k": null,
        "6k": null,
        "9k": null,
        "12k": null,
        "15k": null,
      },
      wVel: {
        "3k": null,
        "6k": null,
        "9k": null,
        "12k": null,
        "15k": null,
      },
      temp: {
        "3k": null,
        "6k": null,
        "9k": null,
        "12k": null,
        "15k": null,
      },
      turb: false,
      cielVis: false,
      mtnObsc: false,
    } as URLSerializable<WeatherData>,
    perf: {
      apt: {
        dep: "",
        arr: "",
      },
      temp: {
        dep: null,
        op: null,
        arr: null,
      },
      altr: {
        dep: null,
        op: null,
        arr: null,
      },
      alttd: {
        dep: null,
        op: null,
        arr: null,
      },
      rwy: {
        dep: null,
        arr: null,
      },
    } as URLSerializable<AircraftPerformanceData>,
    wgt: {
      wgt: null,
    } as URLSerializable<AircraftWeightData>,
    mtnQuals: {
      mtnEndorse: false,
      mtnCert: false,
    } as URLSerializable<MountainQualsData>,
  });

  const handleSortieUpdate = (data: URLSerializable<SortieData>) => {
    setState((prev) => ({ ...prev, sortie: data }));
  };

  const handleWeatherUpdate = (data: URLSerializable<WeatherData>) => {
    setState((prev) => ({ ...prev, wx: data }));
  };

  const handlePerformanceUpdate = (
    data: URLSerializable<AircraftPerformanceData>
  ) => {
    setState((prev) => ({ ...prev, perf: data }));
  };

  const handleWeightUpdate = (data: URLSerializable<AircraftWeightData>) => {
    setState((prev) => ({ ...prev, wgt: data }));
  };

  const handleMountainQualsUpdate = (
    data: URLSerializable<MountainQualsData>
  ) => {
    setState((prev) => ({ ...prev, mtnQuals: data }));
  };

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="flex flex-col gap-4 items-center sm:items-start">
          <h1 className="text-4xl font-bold">Mountain Flying Worksheet</h1>
          <button
            onClick={() => {
              window.history.replaceState({}, "", window.location.pathname);
              window.location.reload();
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Reset Form
          </button>
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
      </main>
    </div>
  );
}
