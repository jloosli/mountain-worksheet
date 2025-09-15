"use client";

import type { URLSerializable, WorksheetData } from "@/utils/types";

type PerfFields = Pick<
  WorksheetData,
  "apt" | "temp" | "altr" | "alttd" | "rwy"
>;

interface AircraftPerformanceProps {
  initialData?: PerfFields;
  onUpdate: (data: Partial<URLSerializable<WorksheetData>>) => void;
}

const DEFAULT_DATA: PerfFields = {
  apt: ["", ""],
  temp: [21, 21, 21],
  altr: [29.92, 29.92, 29.92],
  alttd: [8000, 8000, 8000],
  rwy: [1000, 1000],
};

export default function AircraftPerformance({
  initialData = DEFAULT_DATA,
  onUpdate,
}: AircraftPerformanceProps) {
  const getValue = (category: keyof PerfFields, index: number): string => {
    const arr = initialData[category];
    return arr[index]?.toString() ?? "";
  };

  const handleInputChange = (
    category: keyof PerfFields,
    index: number,
    value: string
  ) => {
    let newValue: string | number;

    if (category === "apt") {
      newValue = value || "";
    } else {
      newValue = Number(value);
    }
    const newData = { ...initialData };

    switch (category) {
      case "apt":
        const aptArray = [...initialData.apt] as [string, string];
        aptArray[index] = newValue as unknown as string;
        newData.apt = aptArray;
        break;
      case "temp":
        const tempArray = [...initialData.temp] as [number, number, number];
        tempArray[index] = newValue as number;
        newData.temp = tempArray;
        break;
      case "altr":
        const altrArray = [...initialData.altr] as [number, number, number];
        altrArray[index] = newValue as number;
        newData.altr = altrArray;
        break;
      case "alttd":
        const alttdArray = [...initialData.alttd] as [number, number, number];
        alttdArray[index] = newValue as number;
        newData.alttd = alttdArray;
        break;
      case "rwy":
        const rwyArray = [...initialData.rwy] as [number, number];
        rwyArray[index] = newValue as number;
        newData.rwy = rwyArray;
        break;
    }

    onUpdate(newData);
  };
  
  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-xl font-bold mb-4">Aircraft Performance</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Aircraft Performance</th>
              <th className="p-2">Departure</th>
              <th className="p-2">Operating</th>
              <th className="p-2">Arrival</th>
              <th className="text-left p-2">Obtain From:</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="p-2">Airport</td>
              <td className="p-2">
                <input
                  type="text"
                  value={getValue("apt", 0)}
                  onChange={(e) => handleInputChange("apt", 0, e.target.value)}
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2"></td>
              <td className="p-2">
                <input
                  type="text"
                  value={getValue("apt", 1)}
                  onChange={(e) => handleInputChange("apt", 1, e.target.value)}
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">Flight Plan</td>
            </tr>
            <tr className="border-b">
              <td className="p-2">Temperature (°C)</td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("temp", 0)}
                  onChange={(e) => handleInputChange("temp", 0, e.target.value)}
                  min="-30"
                  max="55"
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("temp", 1)}
                  onChange={(e) => handleInputChange("temp", 1, e.target.value)}
                  min="-30"
                  max="55"
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("temp", 2)}
                  onChange={(e) => handleInputChange("temp", 2, e.target.value)}
                  min="-30"
                  max="55"
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">ForeFlight METAR, TAF, Daily, Winds Aloft</td>
            </tr>
            <tr className="border-b">
              <td className="p-2">Altimeter setting</td>
              <td className="p-2">
                <input
                  type="number"
                  step="0.01"
                  min="28.00"
                  max="31.00"
                  value={getValue("altr", 0)}
                  onChange={(e) => handleInputChange("altr", 0, e.target.value)}
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  step="0.01"
                  min="28.00"
                  max="31.99"
                  value={getValue("altr", 1)}
                  onChange={(e) => handleInputChange("altr", 1, e.target.value)}
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  step="0.01"
                  min="28.00"
                  max="31.99"
                  value={getValue("altr", 2)}
                  onChange={(e) => handleInputChange("altr", 2, e.target.value)}
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">ForeFlight METAR, TAF, Daily</td>
            </tr>
            <tr className="border-b">
              <td className="p-2">Airport/Max Flight Altitude (MSL)</td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("alttd", 0)}
                  onChange={(e) =>
                    handleInputChange("alttd", 0, e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("alttd", 1)}
                  onChange={(e) =>
                    handleInputChange("alttd", 1, e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("alttd", 2)}
                  onChange={(e) =>
                    handleInputChange("alttd", 2, e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">Flight Plan, ForeFlight</td>
            </tr>
            <tr className="border-b">
              <td className="p-2">Runway length (feet)</td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("rwy", 0)}
                  onChange={(e) => handleInputChange("rwy", 0, e.target.value)}
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2"></td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("rwy", 1)}
                  onChange={(e) => handleInputChange("rwy", 1, e.target.value)}
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">ForeFlight</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
