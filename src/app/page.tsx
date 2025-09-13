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
  weather: WeatherData;
  performance: AircraftPerformanceData;
  weight: AircraftWeightData;
  mountainQuals: MountainQualsData;
};

type State = URLSerializable<BaseState>;

export default function Home() {
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
    performance: {
      airport: {
        departure: "",
        arrival: "",
      },
      temperature: {
        departure: null,
        operating: null,
        arrival: null,
      },
      altimeter: {
        departure: null,
        operating: null,
        arrival: null,
      },
      altitude: {
        departure: null,
        operating: null,
        arrival: null,
      },
      runwayLength: {
        departure: null,
        arrival: null,
      },
    } as AircraftPerformanceData,
    weight: {
      weight: null,
    } as AircraftWeightData,
    mountainQuals: {
      hasMountainEndorsement: false,
      hasMountainCertification: false,
    } as MountainQualsData,
  });

  const handleSortieUpdate = (data: URLSerializable<SortieData>) => {
    setState({ ...state, sortie: data });
  };

  const handleWeatherUpdate = (data: URLSerializable<WeatherData>) => {
    setState({ ...state, weather: data });
  };

  const handlePerformanceUpdate = (
    data: URLSerializable<AircraftPerformanceData>
  ) => {
    setState({ ...state, performance: data });
  };

  const handleWeightUpdate = (data: URLSerializable<AircraftWeightData>) => {
    setState({ ...state, weight: data });
  };

  const handleMountainQualsUpdate = (
    data: URLSerializable<MountainQualsData>
  ) => {
    setState({ ...state, mountainQuals: data });
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
        <AircraftPerformance
          onUpdate={handlePerformanceUpdate}
          initialData={state.performance}
        />
        <AircraftWeight
          onUpdate={handleWeightUpdate}
          initialData={state.weight ?? { weight: null }}
        />
        <MountainQuals
          onUpdate={handleMountainQualsUpdate}
          initialData={state.mountainQuals}
        />
      </main>
    </div>
  );
}
