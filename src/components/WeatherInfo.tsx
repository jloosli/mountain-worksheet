import { useState } from "react";
import type { URLSerializable } from "@/utils/types";

interface WeatherData {
  wind: [number[], number[], number[]]; // [wDir, wVel, temp] arrays
  turb: boolean;
  cielVis: boolean;
  mtnObsc: boolean;
}

interface WeatherInfoProps {
  initialData?: URLSerializable<WeatherData>;
  onUpdate: (data: URLSerializable<WeatherData>) => void;
}

const altitudes = ["3,000", "6,000", "9,000", "12,000", "15,000"];

const DEFAULT_WEATHER_DATA: URLSerializable<WeatherData> = {
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
}: WeatherInfoProps) {
  const [data, setData] = useState<URLSerializable<WeatherData>>(() => ({
    ...DEFAULT_WEATHER_DATA,
    ...initialData,
  }));

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
                  value={data.wind[0][altitudes.indexOf(alt)] || ""}
                  onChange={(e) =>
                    handleNumericChange(
                      0,
                      altitudes.indexOf(alt),
                      e.target.value
                    )
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
                  value={data.wind[1][altitudes.indexOf(alt)] || ""}
                  onChange={(e) =>
                    handleNumericChange(
                      1,
                      altitudes.indexOf(alt),
                      e.target.value
                    )
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
                  value={data.wind[2][altitudes.indexOf(alt)] || ""}
                  onChange={(e) =>
                    handleNumericChange(
                      2,
                      altitudes.indexOf(alt),
                      e.target.value
                    )
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
