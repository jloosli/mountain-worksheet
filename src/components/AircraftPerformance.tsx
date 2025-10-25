"use client";

import { useEffect, useState } from "react";
import type { URLSerializable, WorksheetData } from "@/utils/types";
import { isApiPopulatedData } from "@/utils/weatherDataMapper";

type PerfFields = Pick<
  WorksheetData,
  "airport" | "temp" | "altimeter" | "altitude" | "rwy"
>;

interface AircraftPerformanceProps {
  initialData?: PerfFields;
  onUpdate: (data: Partial<URLSerializable<WorksheetData>>) => void;
  worksheetData?: Partial<WorksheetData>; // Full worksheet data to check API population
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
  worksheetData,
}: AircraftPerformanceProps) {
  const [data, setData] = useState<PerfFields>(() => ({
    ...DEFAULT_DATA,
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

  // Update local data when worksheetData changes (from API population)
  useEffect(() => {
    if (worksheetData) {
      setData((prev) => ({
        ...prev,
        airport: worksheetData.airport ?? prev.airport,
        temp: worksheetData.temp ?? prev.temp,
        altimeter: worksheetData.altimeter ?? prev.altimeter,
        altitude: worksheetData.altitude ?? prev.altitude,
        rwy: worksheetData.rwy ?? prev.rwy,
      }));
    }
  }, [worksheetData]);

  // Use worksheetData for display values if available, otherwise use local data
  const displayData = worksheetData
    ? {
        airport: worksheetData.airport || data.airport,
        temp: worksheetData.temp || data.temp,
        altimeter: worksheetData.altimeter || data.altimeter,
        altitude: worksheetData.altitude || data.altitude,
        rwy: worksheetData.rwy || data.rwy,
      }
    : data;
  const getValue = (category: keyof PerfFields, index: number): string => {
    const arr = displayData[category];
    return arr[index]?.toString() ?? "";
  };

  // Helper function to get input styling based on API population
  const getInputStyling = (
    fieldType: "temp" | "altimeter" | "altitude" | "rwy",
    index?: number
  ) => {
    const baseClasses = "w-full border rounded p-1";
    const apiPopulatedClasses =
      "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-600";
    const manualClasses =
      "bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600";

    if (fieldType === "temp" || fieldType === "altimeter") {
      return apiPopulated.temperature || apiPopulated.pressure
        ? `${baseClasses} ${apiPopulatedClasses}`
        : `${baseClasses} ${manualClasses}`;
    } else if (fieldType === "rwy") {
      return apiPopulated.runway
        ? `${baseClasses} ${apiPopulatedClasses}`
        : `${baseClasses} ${manualClasses}`;
    } else if (fieldType === "altitude") {
      // Check if this specific altitude index is API-populated
      const isApiPopulated =
        apiPopulated.altitude &&
        ((index === 0 && displayData.altitude[0] !== 8000) || // departure
          (index === 2 && displayData.altitude[2] !== 8000)); // arrival
      return isApiPopulated
        ? `${baseClasses} ${apiPopulatedClasses}`
        : `${baseClasses} ${manualClasses}`;
    }
    return `${baseClasses} ${manualClasses}`;
  };

  const handleInputChange = (
    category: keyof PerfFields,
    index: number,
    value: string
  ) => {
    const newValue = Number(value);
    const newData = { ...initialData };

    switch (category) {
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
                <span className="text-gray-700 dark:text-gray-300">
                  {initialData.airport[0] || "Not specified"}
                </span>
              </td>
              <td className="p-2"></td>
              <td className="p-2">
                <span className="text-gray-700 dark:text-gray-300">
                  {initialData.airport[1] || "Not specified"}
                </span>
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
                  className={getInputStyling("temp")}
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("temp", 1)}
                  onChange={(e) => handleInputChange("temp", 1, e.target.value)}
                  min="-30"
                  max="55"
                  className={getInputStyling("temp")}
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("temp", 2)}
                  onChange={(e) => handleInputChange("temp", 2, e.target.value)}
                  min="-30"
                  max="55"
                  className={getInputStyling("temp")}
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
                  className={getInputStyling("altimeter")}
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
                  className={getInputStyling("altimeter")}
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
                  className={getInputStyling("altimeter")}
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
                  className={getInputStyling("altitude", 0)}
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("altitude", 1)}
                  onChange={(e) =>
                    handleInputChange("altitude", 1, e.target.value)
                  }
                  className={getInputStyling("altitude", 1)}
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("altitude", 2)}
                  onChange={(e) =>
                    handleInputChange("altitude", 2, e.target.value)
                  }
                  className={getInputStyling("altitude", 2)}
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
                  className={getInputStyling("rwy")}
                />
              </td>
              <td className="p-2"></td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("rwy", 1)}
                  onChange={(e) => handleInputChange("rwy", 1, e.target.value)}
                  className={getInputStyling("rwy")}
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
