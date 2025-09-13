"use client";

type BaseFieldType = {
  departure: string | number | null;
  arrival: string | number | null;
};

type FieldType = BaseFieldType & {
  operating?: string | number | null;
};

type RunwayFieldType = BaseFieldType;

import type { URLSerializable } from "@/utils/types";

export interface AircraftPerformanceData {
  airport?: FieldType;
  temperature?: FieldType;
  altimeter?: FieldType;
  altitude?: FieldType;
  runwayLength?: RunwayFieldType;
}

interface AircraftPerformanceProps {
  initialData?: URLSerializable<AircraftPerformanceData>;
  onUpdate: (data: URLSerializable<AircraftPerformanceData>) => void;
}

export default function AircraftPerformance({
  initialData = {},
  onUpdate,
}: AircraftPerformanceProps) {
  const getValue = (
    category: keyof AircraftPerformanceData,
    field: keyof BaseFieldType
  ): string => {
    const categoryData = initialData[category];
    if (!categoryData) return "";
    const value = categoryData[field];
    if (value === null || value === undefined) return "";
    return value.toString();
  };

  const getOperatingValue = (
    category: keyof AircraftPerformanceData
  ): string => {
    if (category === "runwayLength") return "";
    const value = (initialData[category] as FieldType)?.operating;
    if (value === null || value === undefined) return "";
    return value.toString();
  };

  const handleInputChange = (
    category: keyof AircraftPerformanceData,
    field: keyof BaseFieldType | "operating",
    value: string
  ) => {
    const numValue = value === "" ? null : Number(value);
    const newData = {
      ...initialData,
      [category]: {
        ...(initialData[category] || {}),
        [field]: category === "airport" ? value : numValue,
      },
    };
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
                  value={getValue("airport", "departure")}
                  onChange={(e) =>
                    handleInputChange("airport", "departure", e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2"></td>
              <td className="p-2">
                <input
                  type="text"
                  value={getValue("airport", "arrival")}
                  onChange={(e) =>
                    handleInputChange("airport", "arrival", e.target.value)
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
                  value={getValue("temperature", "departure")}
                  onChange={(e) =>
                    handleInputChange(
                      "temperature",
                      "departure",
                      e.target.value
                    )
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getOperatingValue("temperature")}
                  onChange={(e) =>
                    handleInputChange(
                      "temperature",
                      "operating",
                      e.target.value
                    )
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("temperature", "arrival")}
                  onChange={(e) =>
                    handleInputChange("temperature", "arrival", e.target.value)
                  }
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
                  value={getValue("altimeter", "departure")}
                  onChange={(e) =>
                    handleInputChange("altimeter", "departure", e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getOperatingValue("altimeter")}
                  onChange={(e) =>
                    handleInputChange("altimeter", "operating", e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("altimeter", "arrival")}
                  onChange={(e) =>
                    handleInputChange("altimeter", "arrival", e.target.value)
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
                  value={getValue("altitude", "departure")}
                  onChange={(e) =>
                    handleInputChange("altitude", "departure", e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getOperatingValue("altitude")}
                  onChange={(e) =>
                    handleInputChange("altitude", "operating", e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("altitude", "arrival")}
                  onChange={(e) =>
                    handleInputChange("altitude", "arrival", e.target.value)
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
                  value={getValue("runwayLength", "departure")}
                  onChange={(e) =>
                    handleInputChange(
                      "runwayLength",
                      "departure",
                      e.target.value
                    )
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2"></td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("runwayLength", "arrival")}
                  onChange={(e) =>
                    handleInputChange("runwayLength", "arrival", e.target.value)
                  }
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
