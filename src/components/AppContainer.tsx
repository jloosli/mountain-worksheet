"use client";

import WorksheetForm from "@/components/WorksheetForm";
import Calculations from "@/components/Calculations";
import { useUrlState } from "@/utils/useUrlState";
import type { URLSerializable, WorksheetData } from "@/utils/types";

export default function AppContainer() {
  const [state, setState] = useUrlState<
    WorksheetData,
    URLSerializable<WorksheetData>
  >({
    // Sortie Information
    pilot: "",
    sDate: new Date().toISOString().split("T")[0],
    sTime: new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }),
    acft: "",
    tailN: "",

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
    apt: ["", ""],
    temp: [21, 21, 21],
    altr: [29.92, 29.92, 29.92],
    alttd: [8000, 8000, 8000],
    rwy: [1000, 1000],

    // Aircraft Weight
    wgt: null,

    // Mountain Qualifications
    mtnEndorse: false,
    mtnCert: false,
  });

  const handleUpdate = (updates: Partial<URLSerializable<WorksheetData>>) => {
    setState((prev) => {
      const merged = { ...prev, ...updates } as URLSerializable<WorksheetData>;
      return merged;
    });
  };

  const perfData = {
    apt: state.apt,
    temp: state.temp,
    altr: state.altr,
    alttd: state.alttd,
    rwy: state.rwy,
    acft: state.acft,
    wgt: state.wgt,
  };

  return (
    <>
      <WorksheetForm state={state} onStateUpdate={handleUpdate} />
      <Calculations perf={perfData} />
    </>
  );
}
