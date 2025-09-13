import { useState } from "react";
import type { URLSerializable, IndexedURLSerializable } from "@/utils/types";

interface WeatherData {
  windDirection: IndexedURLSerializable<number | null>;
  windVelocity: IndexedURLSerializable<number | null>;
  temperature: IndexedURLSerializable<number | null>;
  hasTurbulence: boolean;
  hasCeilingVisibility: boolean;
  hasMountainObscuration: boolean;
}

interface WeatherInfoProps {
  initialData?: URLSerializable<WeatherData>;
  onUpdate: (data: URLSerializable<WeatherData>) => void;
}

const altitudes = ["3000", "6000", "9000", "12000", "15000"];

const DEFAULT_WEATHER_DATA: URLSerializable<WeatherData> = {
  windDirection: Object.fromEntries(altitudes.map((alt) => [alt, null])),
  windVelocity: Object.fromEntries(altitudes.map((alt) => [alt, null])),
  temperature: Object.fromEntries(altitudes.map((alt) => [alt, null])),
  hasTurbulence: false,
  hasCeilingVisibility: false,
  hasMountainObscuration: false,
};

export default function WeatherInfo({
  initialData = DEFAULT_WEATHER_DATA,
  onUpdate,
}: WeatherInfoProps) {
  const [data, setData] = useState<WeatherData>(initialData);

  const handleNumericChange = (
    category: keyof Pick<
      WeatherData,
      "windDirection" | "windVelocity" | "temperature"
    >,
    altitude: string,
    value: string
  ) => {
    const numValue = value === "" ? null : Number(value);
    let isValid = true;

    if (numValue !== null) {
      switch (category) {
        case "windDirection":
          isValid =
            numValue >= 0 && numValue <= 359 && Number.isInteger(numValue);
          break;
        case "windVelocity":
          isValid =
            numValue >= 0 && numValue <= 150 && Number.isInteger(numValue);
          break;
        case "temperature":
          isValid =
            numValue >= -50 && numValue <= 50 && Number.isInteger(numValue);
          break;
      }
    }

    if (isValid) {
      const newData = {
        ...data,
        [category]: {
          ...data[category],
          [altitude]: numValue,
        },
      };
      setData(newData);
      onUpdate(newData);
    }
  };

  const handleCheckboxChange = (
    field: keyof Pick<
      WeatherData,
      "hasTurbulence" | "hasCeilingVisibility" | "hasMountainObscuration"
    >
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
                  value={data.windDirection[alt] ?? ""}
                  onChange={(e) =>
                    handleNumericChange("windDirection", alt, e.target.value)
                  }
                  className="w-full p-1 text-center border rounded"
                  placeholder="?"
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
                  value={data.windVelocity[alt] ?? ""}
                  onChange={(e) =>
                    handleNumericChange("windVelocity", alt, e.target.value)
                  }
                  className="w-full p-1 text-center border rounded"
                  placeholder="?"
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
                  value={data.temperature[alt] ?? ""}
                  onChange={(e) =>
                    handleNumericChange("temperature", alt, e.target.value)
                  }
                  className="w-full p-1 text-center border rounded"
                  placeholder="?"
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
            checked={data.hasTurbulence}
            onChange={() => handleCheckboxChange("hasTurbulence")}
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
            checked={data.hasCeilingVisibility}
            onChange={() => handleCheckboxChange("hasCeilingVisibility")}
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
            checked={data.hasMountainObscuration}
            onChange={() => handleCheckboxChange("hasMountainObscuration")}
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
