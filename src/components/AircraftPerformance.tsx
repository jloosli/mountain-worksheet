"use client";

import { useEffect, useRef, useState } from "react";
import type { WorksheetData } from "@/utils/types";
import { isApiPopulatedData } from "@/utils/weatherDataMapper";

type PerfFields = Pick<
  WorksheetData,
  "airport" | "temp" | "altimeter" | "altitude" | "rwy"
> & {
  temp: [number | null, number | null, number | null];
  altimeter: [number | null, number | null, number | null];
  altitude: [number | null, number | null, number | null];
  rwy: [number | null, number | null];
};

interface AircraftPerformanceProps {
  initialData?: PerfFields;
  onUpdate: (data: Partial<WorksheetData>) => void;
  worksheetData?: Partial<WorksheetData>; // Full worksheet data to check API population
}

const DEFAULT_DATA: PerfFields = {
  airport: ["", ""],
  temp: [null, null, null] as [number | null, number | null, number | null],
  altimeter: [null, null, null] as [
    number | null,
    number | null,
    number | null
  ],
  altitude: [null, null, null] as [number | null, number | null, number | null],
  rwy: [null, null] as [number | null, number | null],
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

  const [altimeterStrings, setAltimeterStrings] = useState<
    [string, string, string]
  >([
    initialData.altimeter[0]?.toString() ?? "",
    initialData.altimeter[1]?.toString() ?? "",
    initialData.altimeter[2]?.toString() ?? "",
  ]);

  // Track the last altimeter values we ourselves pushed upstream via onUpdate.
  // Used to distinguish our own round-trips from genuine external changes (e.g. API).
  const lastPushedAltimeterRef = useRef<
    [number | null, number | null, number | null]
  >([
    initialData.altimeter[0] ?? null,
    initialData.altimeter[1] ?? null,
    initialData.altimeter[2] ?? null,
  ]);

  // Determine which fields are API-populated
  const apiPopulated = worksheetData
    ? isApiPopulatedData(worksheetData)
    : {
        wind: false,
        temperature: false,
        pressure: false,
        runway: false,
        altitude: false,
      };

  // Update local data when initialData changes (from API population)
  useEffect(() => {
    if (initialData) {
      setData((prev) => ({
        ...prev,
        ...initialData,
      }));
      // NOTE: Do NOT sync altimeterStrings here — this effect fires on every
      // keystroke (because onUpdate → parent state change → initialData change)
      // and would clear the field while the user is mid-entry.
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
      // Only sync altimeter display strings when the incoming values differ from
      // what we last pushed upstream. This prevents the keystroke round-trip
      // (user types → onUpdate → state changes → worksheetData changes → this
      // effect fires) from resetting the field while the user is mid-entry.
      if (worksheetData.altimeter) {
        const incoming = worksheetData.altimeter;
        const lastPushed = lastPushedAltimeterRef.current;
        const isExternalChange = incoming.some((v, i) => v !== lastPushed[i]);
        if (isExternalChange) {
          setAltimeterStrings([
            incoming[0]?.toString() ?? "",
            incoming[1]?.toString() ?? "",
            incoming[2]?.toString() ?? "",
          ]);
          lastPushedAltimeterRef.current = [...incoming] as [
            number | null,
            number | null,
            number | null
          ];
        }
      }
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
    const value = arr[index];
    return value !== null && value !== undefined ? value.toString() : "";
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
      // Only apply API styling to departure (index 0) and arrival (index 2) fields
      // Operating field (index 1) should always be manual entry (no API styling)
      const isApiPopulated =
        index !== 1 && // Never apply API styling to operating field
        ((fieldType === "temp" && apiPopulated.temperature) ||
          (fieldType === "altimeter" && apiPopulated.pressure));
      return isApiPopulated
        ? `${baseClasses} ${apiPopulatedClasses}`
        : `${baseClasses} ${manualClasses}`;
    } else if (fieldType === "rwy") {
      return apiPopulated.runway
        ? `${baseClasses} ${apiPopulatedClasses}`
        : `${baseClasses} ${manualClasses}`;
    } else if (fieldType === "altitude") {
      // Only apply API styling to departure (index 0) and arrival (index 2) altitudes
      // Operating altitude (index 1) should always be manual entry (no API styling)
      const isApiPopulated = apiPopulated.altitude && index !== 1; // Never apply API styling to operating altitude
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
    const newValue = value === "" ? null : Number(value);
    const newData = { ...initialData };

    switch (category) {
      case "temp":
        const tempArray = [...initialData.temp] as [
          number | null,
          number | null,
          number | null
        ];
        tempArray[index] = newValue as number | null;
        newData.temp = tempArray;
        break;
      case "altimeter":
        const altimeterArray = [...initialData.altimeter] as [
          number | null,
          number | null,
          number | null
        ];
        altimeterArray[index] = newValue as number | null;
        newData.altimeter = altimeterArray;
        break;
      case "altitude":
        const altitudeArray = [...initialData.altitude] as [
          number | null,
          number | null,
          number | null
        ];
        altitudeArray[index] = newValue as number | null;
        newData.altitude = altitudeArray;
        break;
      case "rwy":
        const rwyArray = [...initialData.rwy] as [number | null, number | null];
        rwyArray[index] = newValue as number | null;
        newData.rwy = rwyArray;
        break;
    }

    onUpdate(newData);
  };

  const handleAltimeterChange = (index: number, value: string) => {
    const newStrings = [...altimeterStrings] as [string, string, string];
    newStrings[index] = value;
    setAltimeterStrings(newStrings);

    const num = value === "" ? null : Number(value);
    const isValid = num === null || (num >= 28.0 && num <= 31.0);
    const altimeterArray = [...initialData.altimeter] as [
      number | null,
      number | null,
      number | null
    ];
    altimeterArray[index] = isValid ? num : null;

    // Record what we're pushing so the worksheetData useEffect can ignore
    // this round-trip and not reset the display strings mid-entry.
    lastPushedAltimeterRef.current = [...altimeterArray] as [
      number | null,
      number | null,
      number | null
    ];

    onUpdate({ ...initialData, altimeter: altimeterArray });
  };

  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-xl font-bold mb-4">Aircraft Performance</h2>
      <p className="mb-4">
        Obtain from aviationweather.gov{" "}
        <a
          href="https://aviationweather.gov/data/metar/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          METAR/TAF
        </a>
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Aircraft Performance</th>
              <th className="p-2">Departure</th>
              <th className="p-2">Operating</th>
              <th className="p-2">Arrival</th>
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
                  className={getInputStyling("temp", 0)}
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("temp", 1)}
                  onChange={(e) => handleInputChange("temp", 1, e.target.value)}
                  min="-30"
                  max="55"
                  className={getInputStyling("temp", 1)}
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("temp", 2)}
                  onChange={(e) => handleInputChange("temp", 2, e.target.value)}
                  min="-30"
                  max="55"
                  className={getInputStyling("temp", 2)}
                />
              </td>
            </tr>
            <tr className="border-b">
              <td className="p-2">Altimeter setting</td>
              <td className="p-2">
                <input
                  type="number"
                  step="0.01"
                  min="28.00"
                  max="31.00"
                  value={altimeterStrings[0]}
                  onChange={(e) => handleAltimeterChange(0, e.target.value)}
                  className={getInputStyling("altimeter", 0)}
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  step="0.01"
                  min="28.00"
                  max="31.00"
                  value={altimeterStrings[1]}
                  onChange={(e) => handleAltimeterChange(1, e.target.value)}
                  className={getInputStyling("altimeter", 1)}
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  step="0.01"
                  min="28.00"
                  max="31.00"
                  value={altimeterStrings[2]}
                  onChange={(e) => handleAltimeterChange(2, e.target.value)}
                  className={getInputStyling("altimeter", 2)}
                />
              </td>
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
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
