import { useState } from "react";
import type { URLSerializable, IndexedURLSerializable } from "@/utils/types";

interface WeatherData {
  wDir: IndexedURLSerializable<number | null>;
  wVel: IndexedURLSerializable<number | null>;
  temp: IndexedURLSerializable<number | null>;
  turb: boolean;
  cielVis: boolean;
  mtnObsc: boolean;
}

// Define a type to ensure default data matches the schema
type EnsureMatchesWeatherData =
  typeof DEFAULT_WEATHER_DATA extends URLSerializable<WeatherData>
    ? true
    : false;

interface WeatherInfoProps {
  initialData?: URLSerializable<WeatherData>;
  onUpdate: (data: URLSerializable<WeatherData>) => void;
}

const altitudes = ["3k", "6k", "9k", "12k", "15k"];

const DEFAULT_WEATHER_DATA: URLSerializable<WeatherData> = {
  wDir: Object.fromEntries(altitudes.map((alt) => [alt, null])),
  wVel: Object.fromEntries(altitudes.map((alt) => [alt, null])),
  temp: Object.fromEntries(altitudes.map((alt) => [alt, null])),
  turb: false,
  cielVis: false,
  mtnObsc: false,
};

export default function WeatherInfo({
  initialData = DEFAULT_WEATHER_DATA,
  onUpdate,
}: WeatherInfoProps) {
  const [data, setData] = useState<URLSerializable<WeatherData>>(() => ({
    ...DEFAULT_WEATHER_DATA,
    ...initialData,
  }));

  const handleNumericChange = (
    category: keyof Pick<WeatherData, "wDir" | "wVel" | "temp">,
    alttd: string,
    value: string
  ) => {
    const numValue = value === "" ? null : Number(value);
    let isValid = true;

    if (numValue !== null) {
      switch (category) {
        case "wDir":
          isValid =
            numValue >= 0 && numValue <= 359 && Number.isInteger(numValue);
          break;
        case "wVel":
          isValid =
            numValue >= 0 && numValue <= 150 && Number.isInteger(numValue);
          break;
        case "temp":
          isValid =
            numValue >= -50 && numValue <= 50 && Number.isInteger(numValue);
          break;
      }
    }

    if (isValid) {
      const newData = {
        ...data,
        [category]: {
          ...(data[category] || {}),
          [alttd]: numValue,
        },
      };
      setData(newData);
      onUpdate(newData);
    }
  };

  const handleCheckboxChange = (
    field: keyof Pick<WeatherData, "turb" | "cielVis" | "mtnObsc">
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
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            <th className="border p-2 text-left">Weather</th>
            {altitudes.map((alt) => (
              <th key={alt} className="border p-2 text-center">
                {alt}&apos;
              </th>
            ))}
            <th className="border p-2 text-left">Obtain From:</th>
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
                  value={data.wDir[alt] ?? ""}
                  onChange={(e) =>
                    handleNumericChange("wDir", alt, e.target.value)
                  }
                  className="w-full p-1 text-center border rounded"
                />
              </td>
            ))}
            <td className="border p-2">Winds Aloft (ForeFlight)</td>
          </tr>
          <tr>
            <td className="border p-2">Wind Velocity (Knots)</td>
            {altitudes.map((alt) => (
              <td key={alt} className="border p-2">
                <input
                  type="number"
                  min={0}
                  max={150}
                  value={data.wVel[alt] ?? ""}
                  onChange={(e) =>
                    handleNumericChange("wVel", alt, e.target.value)
                  }
                  className="w-full p-1 text-center border rounded"
                />
              </td>
            ))}
            <td className="border p-2">Winds Aloft (ForeFlight)</td>
          </tr>
          <tr>
            <td className="border p-2">Temperature (°C)</td>
            {altitudes.map((alt) => (
              <td key={alt} className="border p-2">
                <input
                  type="number"
                  min={-50}
                  max={50}
                  value={data.temp[alt] ?? ""}
                  onChange={(e) =>
                    handleNumericChange("temp", alt, e.target.value)
                  }
                  className="w-full p-1 text-center border rounded"
                />
              </td>
            ))}
            <td className="border p-2">Winds Aloft (ForeFlight)</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="turbulence"
            checked={data.turb}
            onChange={() => handleCheckboxChange("turb")}
            className="rounded border-gray-300"
          />
          <label htmlFor="turbulence">
            Turbulence (AIRMET Tango)? - ForeFlight AIRMET
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ceilingVisibility"
            checked={data.cielVis}
            onChange={() => handleCheckboxChange("cielVis")}
            className="rounded border-gray-300"
          />
          <label htmlFor="ceilingVisibility">
            Ceiling and Vis &lt; 10sm/2000&apos;? - ForeFlight Ceiling,
            Visibility, Cameras
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="mountainObscuration"
            checked={data.mtnObsc}
            onChange={() => handleCheckboxChange("mtnObsc")}
            className="rounded border-gray-300"
          />
          <label htmlFor="mountainObscuration">
            Mtn Obscuration (AIRMET Sierra)? - ForeFlight AIRMET
          </label>
        </div>
      </div>
    </div>
  );
}

export type { WeatherData };
