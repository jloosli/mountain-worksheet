"use client";

import WorksheetForm from "@/components/WorksheetForm";
import Calculations from "@/components/Calculations";
import { useUrlState } from "@/utils/useUrlState";
import type { URLSerializable } from "@/utils/types";
import type { SortieData } from "@/components/SortieInfo";
import type { WeatherData } from "@/components/WeatherInfo";
import type { AircraftPerformanceData } from "@/components/AircraftPerformance";
import type { AircraftWeightData } from "@/components/AircraftWeight";
import type { MountainQualsData } from "@/components/MountainQuals";

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

export default function AppContainer() {
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

  const handleUpdate = (
    key: keyof State,
    data: URLSerializable<
      | SortieData
      | WeatherData
      | AircraftPerformanceData
      | AircraftWeightData
      | MountainQualsData
    >
  ) => {
    setState((prev) => ({ ...prev, [key]: data }));
  };

  return (
    <>
      <WorksheetForm state={state} onStateUpdate={handleUpdate} />
      <Calculations perf={state.perf} />
    </>
  );
}
