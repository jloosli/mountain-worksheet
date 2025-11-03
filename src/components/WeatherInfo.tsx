import { useState, useEffect } from "react";
import type { URLSerializable, WorksheetData } from "@/utils/types";
import { isApiPopulatedData } from "@/utils/weatherDataMapper";

type WeatherFields = Pick<
  WorksheetData,
  "wind" | "turb" | "cielVis" | "mtnObsc"
>;

interface WeatherInfoProps {
  initialData?: WeatherFields;
  onUpdate: (data: Partial<URLSerializable<WorksheetData>>) => void;
  worksheetData?: Partial<WorksheetData>; // Full worksheet data to check API population
  lastUpdated?: Date; // Timestamp for when data was last updated
}

const altitudes = ["3,000", "6,000", "9,000", "12,000", "15,000"];

const DEFAULT_WEATHER_DATA: WeatherFields = {
  wind: [
    Array(5).fill(0), // wDir values for 3k,6k,9k,12k,15k
    Array(5).fill(0), // wVel values for 3k,6k,9k,12k,15k
    Array(5).fill(0), // temp values for 3k,6k,9k,12k,15k
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
};

export default function WeatherInfo({
  initialData = DEFAULT_WEATHER_DATA,
  onUpdate,
  worksheetData,
  lastUpdated,
}: WeatherInfoProps) {
  const [data, setData] = useState<WeatherFields>(() => ({
    ...DEFAULT_WEATHER_DATA,
    ...initialData,
  }));

  // Determine which fields are API-populated
  const apiPopulated = worksheetData
    ? isApiPopulatedData(worksheetData)
    : {
        wind: false,
        temperature: false,
        pressure: false,
        runway: false,
      };

  // Update local data when initialData changes (from API population)
  useEffect(() => {
    if (initialData) {
      setData((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [initialData]);

  // Use worksheetData for display values if available, otherwise use local data
  const hasApiWindData =
    worksheetData?.wind &&
    Array.isArray(worksheetData.wind) &&
    worksheetData.wind.length === 3 &&
    worksheetData.wind[0] &&
    Array.isArray(worksheetData.wind[0]) &&
    worksheetData.wind[0].some((val) => val !== 0);

  const displayData = hasApiWindData
    ? {
        wind: worksheetData.wind,
        turb: worksheetData.turb || data.turb,
        cielVis: worksheetData.cielVis || data.cielVis,
        mtnObsc: worksheetData.mtnObsc || data.mtnObsc,
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
    const numValue = value === "" ? 0 : Number(value);
    let isValid = true;

    switch (type) {
      case 0: // wDir
        isValid =
          numValue >= 0 && numValue <= 359 && Number.isInteger(numValue);
        break;
      case 1: // wVel
        isValid =
          numValue >= 0 && numValue <= 150 && Number.isInteger(numValue);
        break;
      case 2: // temp
        isValid =
          numValue >= -50 && numValue <= 50 && Number.isInteger(numValue);
        break;
    }

    if (isValid) {
      const newWind = [...data.wind] as [number[], number[], number[]];
      newWind[type] = [...newWind[type]];
      newWind[type][index] = numValue;
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
    <div className="w-full max-w-4xl">
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
            <td className="border p-2">Wind Direction (Degrees)</td>
            {altitudes.map((alt) => (
              <td key={alt} className="border p-2">
                <input
                  type="number"
                  min={0}
                  max={359}
                  value={displayData.wind?.[0]?.[altitudes.indexOf(alt)] || ""}
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
            <td className="border p-2">Wind Velocity (Knots)</td>
            {altitudes.map((alt) => (
              <td key={alt} className="border p-2">
                <input
                  type="number"
                  min={0}
                  max={150}
                  value={displayData.wind?.[1]?.[altitudes.indexOf(alt)] || ""}
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
            <td className="border p-2">Temperature (°C)</td>
            {altitudes.map((alt) => (
              <td key={alt} className="border p-2">
                <input
                  type="number"
                  min={-50}
                  max={50}
                  value={displayData.wind?.[2]?.[altitudes.indexOf(alt)] || ""}
                  onChange={(e) =>
                    handleNumericChange(
                      2,
                      altitudes.indexOf(alt),
                      e.target.value
                    )
                  }
                  className={getInputStyling("temp")}
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>

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
              Cieling/Vis
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
