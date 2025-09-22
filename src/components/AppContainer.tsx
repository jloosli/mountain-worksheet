"use client";

import AppInputs from "@/components/AppInputs";
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
    date: new Date().toISOString().split("T")[0],
    time: new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }),
    acType: "",
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
    airport: ["", ""],
    temp: [21, 21, 21],
    altimeter: [29.92, 29.92, 29.92],
    altitude: [8000, 8000, 8000],
    rwy: [1000, 1000],

    // Aircraft Weight
    weight: null,

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

  return (
    <>
      <AppInputs state={state} onStateUpdate={handleUpdate} />
      <Calculations state={state} />
    </>
  );
}
