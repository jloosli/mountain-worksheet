"use client";

import Image from "next/image";
import SortieInfo, { SortieData } from "@/components/SortieInfo";
import WeatherInfo, { WeatherData } from "@/components/WeatherInfo";
import { useUrlState } from "@/utils/useUrlState";
import type { JsonValue } from "@/utils/urlState";

export default function Home() {
  interface State {
    sortie: SortieData;
    weather: WeatherData;
    [key: string]: JsonValue;
  }

  const [state, setState] = useUrlState<State>({
    sortie: {
      pilotName: "",
      sortieDate: new Date().toISOString().split("T")[0],
      sortieTime: new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
      aircraftModel: "",
      tailNumber: "",
    } as SortieData,
    weather: {
      windDirection: {
        "3000": null,
        "6000": null,
        "9000": null,
        "12000": null,
        "15000": null,
      },
      windVelocity: {
        "3000": null,
        "6000": null,
        "9000": null,
        "12000": null,
        "15000": null,
      },
      temperature: {
        "3000": null,
        "6000": null,
        "9000": null,
        "12000": null,
        "15000": null,
      },
      hasTurbulence: false,
      hasCeilingVisibility: false,
      hasMountainObscuration: false,
    } as WeatherData,
  });

  const handleSortieUpdate = (data: SortieData) => {
    setState({ ...state, sortie: data });
  };

  const handleWeatherUpdate = (data: WeatherData) => {
    setState({ ...state, weather: data });
  };

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1>Mountain Flight Worksheet</h1>
        <SortieInfo onUpdate={handleSortieUpdate} initialData={state.sortie} />
        <WeatherInfo
          onUpdate={handleWeatherUpdate}
          initialData={state.weather}
        />
      </main>
    </div>
  );
}
