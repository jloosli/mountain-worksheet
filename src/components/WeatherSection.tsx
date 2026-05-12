// src/components/WeatherSection.tsx
"use client";

import AirportCard from "@/components/AirportCard";
import { isApiPopulatedData } from "@/utils/weatherDataMapper";
import { celciusToFarenheit, farenheitToCelcius } from "@/utils/formulas";
import type { RunwayOption, WorksheetData } from "@/utils/types";

interface WeatherSectionProps {
  state: WorksheetData;
  onUpdate: (data: Partial<WorksheetData>) => void;
  airportRunways: [RunwayOption[] | null, RunwayOption[] | null];
  useFahrenheit?: boolean;
}

const ALOFT_ALTITUDES = ["3,000", "6,000", "9,000", "12,000", "15,000"];

export default function WeatherSection({
  state,
  onUpdate,
  airportRunways,
  useFahrenheit = false,
}: WeatherSectionProps) {
  const apiPopulated = isApiPopulatedData(state);

  const handleWindChange = (
    row: 0 | 1 | 2,
    col: number,
    rawValue: string
  ) => {
    const numValue: number | null = rawValue === "" ? null : Number(rawValue);
    let isValid = true;
    if (numValue !== null) {
      if (row === 0) isValid = numValue >= 0 && numValue <= 359 && Number.isInteger(numValue);
      else if (row === 1) isValid = numValue >= 0 && numValue <= 150 && Number.isInteger(numValue);
      else {
        const celsiusValue = useFahrenheit ? farenheitToCelcius(numValue) : numValue;
        isValid = celsiusValue >= -50 && celsiusValue <= 50;
      }
    }
    if (!isValid) return;
    const stored = row === 2 && numValue !== null && useFahrenheit
      ? farenheitToCelcius(numValue)
      : numValue;
    const newWind = state.wind.map((arr) => [...arr]) as [
      (number | null)[],
      (number | null)[],
      (number | null)[],
    ];
    newWind[row][col] = stored;
    onUpdate({ wind: newWind });
  };

  const handleAirportTempChange = (
    index: 0 | 1 | 2,
    rawValue: string
  ) => {
    const num = rawValue === "" ? null : Number(rawValue);
    const stored = num !== null && useFahrenheit ? farenheitToCelcius(num) : num;
    const next = [...state.temp] as [number | null, number | null, number | null];
    next[index] = stored;
    onUpdate({ temp: next });
  };

  const handleAirportAltimeterChange = (
    index: 0 | 1 | 2,
    rawValue: string
  ) => {
    const num = rawValue === "" ? null : Number(rawValue);
    const isValid = num === null || (num >= 28.0 && num <= 31.0);
    const next = [...state.altimeter] as [
      number | null,
      number | null,
      number | null,
    ];
    next[index] = isValid ? num : null;
    onUpdate({ altimeter: next });
  };

  const handleRunwaySelect = (index: 0 | 1, length: number) => {
    const next = [...state.rwy] as [number | null, number | null];
    next[index] = length;
    onUpdate({ rwy: next });
  };

  const handleAdvisoryToggle = (
    field: "turb" | "cielVis" | "mtnObsc"
  ) => {
    onUpdate({ [field]: !state[field] } as Partial<WorksheetData>);
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 text-blue-900 px-2.5 py-1 text-xs dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100">
        <span className="inline-block h-3 w-3 rounded-sm bg-blue-100 border border-blue-400 dark:bg-blue-900/40 dark:border-blue-600"></span>
        Blue cells fetched from{" "}
        <a
          href="https://aviationweather.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline"
        >
          aviationweather.gov
        </a>{" "}
        — type to override
      </div>

      <WindsAloftBlock
        wind={state.wind}
        apiPopulatedWind={apiPopulated.wind}
        apiPopulatedTemp={apiPopulated.temperature}
        useFahrenheit={useFahrenheit}
        onChange={handleWindChange}
      />

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          At airports
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AirportCard
            variant="departure"
            airportCode={state.airport[0]}
            fieldElev={state.altitude[0]}
            temperature={state.temp[0]}
            altimeter={state.altimeter[0]}
            useFahrenheit={useFahrenheit}
            apiPopulated={apiPopulated}
            onTemperatureChange={(v) => handleAirportTempChange(0, v)}
            onAltimeterChange={(v) => handleAirportAltimeterChange(0, v)}
            runways={airportRunways[0]}
            selectedRunwayLength={state.rwy[0]}
            onRunwaySelect={(length) => handleRunwaySelect(0, length)}
          />
          <AirportCard
            variant="operating"
            operatingAltitude={state.altitude[1]}
            temperature={state.temp[1]}
            altimeter={state.altimeter[1]}
            useFahrenheit={useFahrenheit}
            apiPopulated={apiPopulated}
            onTemperatureChange={(v) => handleAirportTempChange(1, v)}
            onAltimeterChange={(v) => handleAirportAltimeterChange(1, v)}
          />
          <AirportCard
            variant="arrival"
            airportCode={state.airport[1]}
            fieldElev={state.altitude[2]}
            temperature={state.temp[2]}
            altimeter={state.altimeter[2]}
            useFahrenheit={useFahrenheit}
            apiPopulated={apiPopulated}
            onTemperatureChange={(v) => handleAirportTempChange(2, v)}
            onAltimeterChange={(v) => handleAirportAltimeterChange(2, v)}
            runways={airportRunways[1]}
            selectedRunwayLength={state.rwy[1]}
            onRunwaySelect={(length) => handleRunwaySelect(1, length)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Advisories
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.turb}
              onChange={() => handleAdvisoryToggle("turb")}
              className="rounded border-slate-300"
            />
            <span>
              AIRMET Tango (turbulence) —{" "}
              <a
                href="https://aviationweather.gov/gfa/#gairmet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                AIRMET
              </a>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.cielVis}
              onChange={() => handleAdvisoryToggle("cielVis")}
              className="rounded border-slate-300"
            />
            <span>
              Ceiling / Vis &lt; 10sm/2000′ —{" "}
              <a
                href="https://aviationweather.gov/gfa/#cigvis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Ceiling/Vis
              </a>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.mtnObsc}
              onChange={() => handleAdvisoryToggle("mtnObsc")}
              className="rounded border-slate-300"
            />
            <span>
              AIRMET Sierra (mtn obscuration) —{" "}
              <a
                href="https://aviationweather.gov/gfa/#gairmet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                AIRMET
              </a>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

interface WindsAloftBlockProps {
  wind: [(number | null)[], (number | null)[], (number | null)[]];
  apiPopulatedWind: boolean;
  apiPopulatedTemp: boolean;
  useFahrenheit: boolean;
  onChange: (row: 0 | 1 | 2, col: number, rawValue: string) => void;
}

function WindsAloftBlock({
  wind,
  apiPopulatedWind,
  apiPopulatedTemp,
  useFahrenheit,
  onChange,
}: WindsAloftBlockProps) {
  const cellClass = (apiPopulated: boolean) => {
    const base =
      "w-full text-center rounded border p-1 focus:outline-none focus:ring-2 focus:ring-slate-300";
    return apiPopulated
      ? `${base} bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-600`
      : `${base} bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600`;
  };

  const displayTemp = (raw: number | null | undefined): string => {
    if (raw === null || raw === undefined) return "";
    return useFahrenheit
      ? Math.round(celciusToFarenheit(raw)).toString()
      : parseFloat(raw.toFixed(1)).toString();
  };

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Aloft
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <th className="border border-slate-200 p-2 text-left font-semibold dark:border-slate-700"></th>
              {ALOFT_ALTITUDES.map((alt) => (
                <th
                  key={alt}
                  className="border border-slate-200 p-2 num-mono dark:border-slate-700"
                >
                  {alt}′
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num-mono">
            <tr>
              <td className="border border-slate-200 p-2 font-sans dark:border-slate-700">
                Wind Dir (°)
              </td>
              {ALOFT_ALTITUDES.map((alt, idx) => (
                <td
                  key={alt}
                  className="border border-slate-200 p-1 dark:border-slate-700"
                >
                  <input
                    type="number"
                    min={0}
                    max={359}
                    aria-label={`Wind direction at ${alt} ft`}
                    value={wind[0][idx] ?? ""}
                    onChange={(e) => onChange(0, idx, e.target.value)}
                    className={cellClass(apiPopulatedWind)}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 p-2 font-sans dark:border-slate-700">
                Wind Vel (kt)
              </td>
              {ALOFT_ALTITUDES.map((alt, idx) => (
                <td
                  key={alt}
                  className="border border-slate-200 p-1 dark:border-slate-700"
                >
                  <input
                    type="number"
                    min={0}
                    max={150}
                    aria-label={`Wind velocity at ${alt} ft`}
                    value={wind[1][idx] ?? ""}
                    onChange={(e) => onChange(1, idx, e.target.value)}
                    className={cellClass(apiPopulatedWind)}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 p-2 font-sans dark:border-slate-700">
                Temp (°{useFahrenheit ? "F" : "C"})
              </td>
              {ALOFT_ALTITUDES.map((alt, idx) => (
                <td
                  key={alt}
                  className="border border-slate-200 p-1 dark:border-slate-700"
                >
                  <input
                    type="number"
                    aria-label={`Temperature at ${alt} ft`}
                    value={displayTemp(wind[2][idx])}
                    onChange={(e) => onChange(2, idx, e.target.value)}
                    className={cellClass(apiPopulatedTemp)}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
