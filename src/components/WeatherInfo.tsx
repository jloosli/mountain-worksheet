import { useState, useEffect, useRef } from "react";
import type { WorksheetData } from "@/utils/types";
import { isApiPopulatedData } from "@/utils/weatherDataMapper";
import { celciusToFarenheit, farenheitToCelcius } from "@/utils/formulas";

type WeatherFields = Pick<
  WorksheetData,
  "wind" | "turb" | "cielVis" | "mtnObsc"
>;

interface WeatherInfoProps {
  initialData?: WorksheetData;
  onUpdate: (data: Partial<WorksheetData>) => void;
  lastUpdated?: Date;
  useFahrenheit?: boolean;
}

const altitudes = ["3,000", "6,000", "9,000", "12,000", "15,000"];

const DEFAULT_WEATHER_DATA: WeatherFields = {
  wind: [
    Array(5).fill(null) as (number | null)[], // wDir values for 3k,6k,9k,12k,15k
    Array(5).fill(null) as (number | null)[], // wVel values for 3k,6k,9k,12k,15k
    Array(5).fill(null) as (number | null)[], // temp values for 3k,6k,9k,12k,15k
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
};

export default function WeatherInfo({
  initialData,
  onUpdate,
  lastUpdated,
  useFahrenheit = false,
}: WeatherInfoProps) {
  const [data, setData] = useState<WeatherFields>(() => ({
    ...DEFAULT_WEATHER_DATA,
    // If initialData is provided, destructure its fields that exist in DEFAULT_WEATHER_DATA
    ...(initialData
      ? Object.fromEntries(
          Object.keys(DEFAULT_WEATHER_DATA)
            .filter((key) => key in (initialData ?? {}))
            .map((key) => [key, initialData[key as keyof WeatherFields]])
        )
      : {}),
  }));

  // Determine which fields are API-populated
  const apiPopulated = initialData
    ? isApiPopulatedData(initialData)
    : {
        wind: false,
        temperature: false,
        pressure: false,
        runway: false,
        altitude: false,
      };

  // Track previous initialData to detect actual changes
  const prevInitialDataRef = useRef<WorksheetData | undefined>(initialData);
  const prevApiPopulatedWindRef = useRef(apiPopulated.wind);
  const prevApiPopulatedTempRef = useRef(apiPopulated.temperature);

  // Helper to deep compare arrays
  const arraysEqual = (
    a: (number | null)[] | undefined,
    b: (number | null)[] | undefined
  ): boolean => {
    if (!a || !b) return a === b;
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  };

  // Helper to deep compare wind arrays (3D array)
  const windArraysEqual = (
    a: [(number | null)[], (number | null)[], (number | null)[]] | undefined,
    b: [(number | null)[], (number | null)[], (number | null)[]] | undefined
  ): boolean => {
    if (!a || !b) return a === b;
    if (a.length !== b.length) return false;
    return a.every((arr, idx) => arraysEqual(arr, b[idx]));
  };

  // Update local data only when API-populated fields actually change
  useEffect(() => {
    if (!initialData) {
      prevInitialDataRef.current = initialData;
      prevApiPopulatedWindRef.current = apiPopulated.wind;
      prevApiPopulatedTempRef.current = apiPopulated.temperature;
      return;
    }

    const prevInitialData = prevInitialDataRef.current;
    const prevApiPopulatedWind = prevApiPopulatedWindRef.current;
    const prevApiPopulatedTemp = prevApiPopulatedTempRef.current;

    // Check if API-populated status has changed (new API data available)
    const windApiStatusChanged = apiPopulated.wind !== prevApiPopulatedWind;
    const tempApiStatusChanged =
      apiPopulated.temperature !== prevApiPopulatedTemp;

    // Check if API-populated fields have actually changed
    const windDataChanged = !windArraysEqual(
      initialData.wind,
      prevInitialData?.wind
    );
    const tempDataChanged = !arraysEqual(
      initialData.wind?.[2], // temperature is stored in wind[2]
      prevInitialData?.wind?.[2]
    );

    // Only update if:
    // 1. Field is API-populated AND data changed, OR
    // 2. Field just became API-populated (status changed from false to true)
    const shouldUpdateWind =
      apiPopulated.wind &&
      (windDataChanged || (windApiStatusChanged && !prevApiPopulatedWind));
    const shouldUpdateTemp =
      apiPopulated.temperature &&
      (tempDataChanged || (tempApiStatusChanged && !prevApiPopulatedTemp));

    // Only update if API-populated fields have changed
    if (shouldUpdateWind || shouldUpdateTemp) {
      setData((prev) => {
        const updates: Partial<WeatherFields> = {};

        // Only update wind if it's API-populated and should be updated
        if (shouldUpdateWind && initialData.wind) {
          updates.wind = initialData.wind as [(number | null)[], (number | null)[], (number | null)[]];
        }

        // Preserve user edits to non-API fields (turb, cielVis, mtnObsc)
        // These should never be overwritten by API data

        return {
          ...prev,
          ...updates,
        };
      });
    }

    // Update refs for next comparison
    prevInitialDataRef.current = initialData;
    prevApiPopulatedWindRef.current = apiPopulated.wind;
    prevApiPopulatedTempRef.current = apiPopulated.temperature;
  }, [initialData, apiPopulated.wind, apiPopulated.temperature]);

  // Use initialData for display values if available, otherwise use local data
  const hasApiWindData =
    initialData?.wind &&
    Array.isArray(initialData.wind) &&
    initialData.wind.length === 3 &&
    initialData.wind[0] &&
    Array.isArray(initialData.wind[0]) &&
    initialData.wind[0].some((val) => val !== null && val !== undefined);

  const displayData = hasApiWindData
    ? {
        wind: initialData.wind,
        turb: initialData.turb || data.turb,
        cielVis: initialData.cielVis || data.cielVis,
        mtnObsc: initialData.mtnObsc || data.mtnObsc,
      }
    : data;

  // Helper function to get input styling based on API population
  const getInputStyling = (fieldType: "windDir" | "windVel" | "temp") => {
    const baseClasses = "w-full p-1 text-center border rounded";
    const apiPopulatedClasses =
      "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-600";
    const manualClasses =
      "bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600";

    if (fieldType === "windDir" || fieldType === "windVel") {
      return apiPopulated.wind
        ? `${baseClasses} ${apiPopulatedClasses}`
        : `${baseClasses} ${manualClasses}`;
    } else if (fieldType === "temp") {
      return apiPopulated.temperature
        ? `${baseClasses} ${apiPopulatedClasses}`
        : `${baseClasses} ${manualClasses}`;
    }
    return `${baseClasses} ${manualClasses}`;
  };

  const handleNumericChange = (
    type: number, // 0 for wDir, 1 for wVel, 2 for temp
    index: number, // 0 for 3k, 1 for 6k, etc.
    value: string
  ) => {
    const numValue: number | null = value === "" ? null : Number(value);
    let isValid = true;

    if (numValue !== null) {
      switch (type) {
        case 0: // wDir
          isValid =
            numValue >= 0 && numValue <= 359 && Number.isInteger(numValue);
          break;
        case 1: // wVel
          isValid =
            numValue >= 0 && numValue <= 150 && Number.isInteger(numValue);
          break;
        case 2: { // temp
          const celsiusValue = useFahrenheit ? farenheitToCelcius(numValue) : numValue;
          isValid = celsiusValue >= -50 && celsiusValue <= 50;
          break;
        }
      }
    }

    if (isValid) {
      const newWind = [...data.wind] as [(number | null)[], (number | null)[], (number | null)[]];
      newWind[type] = [...newWind[type]];
      const storedValue = type === 2 && numValue !== null && useFahrenheit
        ? farenheitToCelcius(numValue)
        : numValue;
      newWind[type][index] = storedValue;
      const newData = {
        ...data,
        wind: newWind,
      };
      setData(newData);
      onUpdate(newData);
    }
  };

  const handleCheckboxChange = (
    field: keyof Pick<WeatherFields, "turb" | "cielVis" | "mtnObsc">
  ) => {
    const newData = {
      ...data,
      [field]: !data[field],
    };
    setData(newData);
    onUpdate(newData);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Weather Information</h2>
        {lastUpdated && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>
      <p className="mb-4">
        Obtain from aviationweather.gov{" "}
        <a
          href="https://aviationweather.gov/gfa/#winds"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          winds
        </a>
      </p>
      <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            <th className="border p-2 text-left">Weather</th>
            {altitudes.map((alt) => (
              <th key={alt} className="border p-2 text-center">
                {alt}&apos;
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">
              <span className="hidden md:inline">Wind Direction (Degrees)</span>
              <span className="md:hidden">Wnd Dir (°)</span>
            </td>
            {altitudes.map((alt) => (
              <td key={alt} className="border p-2">
                <input
                  type="number"
                  min={0}
                  max={359}
                  value={displayData.wind?.[0]?.[altitudes.indexOf(alt)] ?? ""}
                  onChange={(e) =>
                    handleNumericChange(
                      0,
                      altitudes.indexOf(alt),
                      e.target.value
                    )
                  }
                  className={getInputStyling("windDir")}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className="border p-2">
              <span className="hidden md:inline">Wind Velocity (Knots)</span>
              <span className="md:hidden">Wnd Vel (kt)</span>
            </td>
            {altitudes.map((alt) => (
              <td key={alt} className="border p-2">
                <input
                  type="number"
                  min={0}
                  max={150}
                  value={displayData.wind?.[1]?.[altitudes.indexOf(alt)] ?? ""}
                  onChange={(e) =>
                    handleNumericChange(
                      1,
                      altitudes.indexOf(alt),
                      e.target.value
                    )
                  }
                  className={getInputStyling("windVel")}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className="border p-2">
              <span className="hidden md:inline">Temperature (°{useFahrenheit ? "F" : "C"})</span>
              <span className="md:hidden">Temp (°{useFahrenheit ? "F" : "C"})</span>
            </td>
            {altitudes.map((alt) => {
              const idx = altitudes.indexOf(alt);
              const rawVal = displayData.wind?.[2]?.[idx];
              const displayVal = rawVal !== null && rawVal !== undefined
                ? (useFahrenheit ? Math.round(celciusToFarenheit(rawVal)) : parseFloat(rawVal.toFixed(1)))
                : "";
              return (
                <td key={alt} className="border p-2">
                  <input
                    type="number"
                    min={useFahrenheit ? -58 : -50}
                    max={useFahrenheit ? 122 : 50}
                    value={displayVal}
                    onChange={(e) =>
                      handleNumericChange(2, idx, e.target.value)
                    }
                    className={getInputStyling("temp")}
                  />
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="turbulence"
            checked={displayData.turb}
            onChange={() => handleCheckboxChange("turb")}
            className="rounded border-gray-300"
          />
          <label htmlFor="turbulence">
            Turbulence (AIRMET Tango)? -{" "}
            <a
              href="https://aviationweather.gov/gfa/#gairmet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              AIRMET
            </a>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ceilingVisibility"
            checked={displayData.cielVis}
            onChange={() => handleCheckboxChange("cielVis")}
            className="rounded border-gray-300"
          />
          <label htmlFor="ceilingVisibility">
            Ceiling and Vis &lt; 10sm/2000&apos;? -{" "}
            <a
              href="https://aviationweather.gov/gfa/#cigvis"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ceiling/Vis
            </a>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="mountainObscuration"
            checked={displayData.mtnObsc}
            onChange={() => handleCheckboxChange("mtnObsc")}
            className="rounded border-gray-300"
          />
          <label htmlFor="mountainObscuration">
            Mtn Obscuration (AIRMET Sierra)? -{" "}
            <a
              href="https://aviationweather.gov/gfa/#gairmet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              AIRMET
            </a>
          </label>
        </div>
      </div>
    </div>
  );
}
