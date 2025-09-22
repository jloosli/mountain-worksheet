"use client";

import type { URLSerializable, WorksheetData } from "@/utils/types";

type PerfFields = Pick<
  WorksheetData,
  "airport" | "temp" | "altimeter" | "altitude" | "rwy"
>;

interface AircraftPerformanceProps {
  initialData?: PerfFields;
  onUpdate: (data: Partial<URLSerializable<WorksheetData>>) => void;
}

const DEFAULT_DATA: PerfFields = {
  airport: ["", ""],
  temp: [21, 21, 21],
  altimeter: [29.92, 29.92, 29.92],
  altitude: [8000, 8000, 8000],
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

    if (category === "airport") {
      newValue = value || "";
    } else {
      newValue = Number(value);
    }
    const newData = { ...initialData };

    switch (category) {
      case "airport":
        const airportArray = [...initialData.airport] as [string, string];
        airportArray[index] = newValue as unknown as string;
        newData.airport = airportArray;
        break;
      case "temp":
        const tempArray = [...initialData.temp] as [number, number, number];
        tempArray[index] = newValue as number;
        newData.temp = tempArray;
        break;
      case "altimeter":
        const altimeterArray = [...initialData.altimeter] as [
          number,
          number,
          number
        ];
        altimeterArray[index] = newValue as number;
        newData.altimeter = altimeterArray;
        break;
      case "altitude":
        const altitudeArray = [...initialData.altitude] as [
          number,
          number,
          number
        ];
        altitudeArray[index] = newValue as number;
        newData.altitude = altitudeArray;
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
                  value={getValue("airport", 0)}
                  onChange={(e) =>
                    handleInputChange("airport", 0, e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2"></td>
              <td className="p-2">
                <input
                  type="text"
                  value={getValue("airport", 1)}
                  onChange={(e) =>
                    handleInputChange("airport", 1, e.target.value)
                  }
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
                  value={getValue("altimeter", 0)}
                  onChange={(e) =>
                    handleInputChange("altimeter", 0, e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  step="0.01"
                  min="28.00"
                  max="31.99"
                  value={getValue("altimeter", 1)}
                  onChange={(e) =>
                    handleInputChange("altimeter", 1, e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  step="0.01"
                  min="28.00"
                  max="31.99"
                  value={getValue("altimeter", 2)}
                  onChange={(e) =>
                    handleInputChange("altimeter", 2, e.target.value)
                  }
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
                  value={getValue("altitude", 0)}
                  onChange={(e) =>
                    handleInputChange("altitude", 0, e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("altitude", 1)}
                  onChange={(e) =>
                    handleInputChange("altitude", 1, e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("altitude", 2)}
                  onChange={(e) =>
                    handleInputChange("altitude", 2, e.target.value)
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
