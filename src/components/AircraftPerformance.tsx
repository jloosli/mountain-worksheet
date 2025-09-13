"use client";

type BaseFieldType = {
  dep: string | number | null;
  arr: string | number | null;
};

type FieldType = BaseFieldType & {
  op?: string | number | null;
};

type RunwayFieldType = BaseFieldType;

import type { URLSerializable } from "@/utils/types";

export interface AircraftPerformanceData {
  apt?: FieldType;
  temp?: FieldType;
  altr?: FieldType;
  alttd?: FieldType;
  rwy?: RunwayFieldType;
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
    if (category === "rwy") return "";
    const value = (initialData[category] as FieldType)?.op;
    if (value === null || value === undefined) return "";
    return value.toString();
  };

  const handleInputChange = (
    category: keyof AircraftPerformanceData,
    field: keyof BaseFieldType | "op",
    value: string
  ) => {
    const numValue = value === "" ? null : Number(value);
    const newData = {
      ...initialData,
      [category]: {
        ...(initialData[category] || {}),
        [field]: category === "apt" ? value : numValue,
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
                  value={getValue("apt", "dep")}
                  onChange={(e) =>
                    handleInputChange("apt", "dep", e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2"></td>
              <td className="p-2">
                <input
                  type="text"
                  value={getValue("apt", "arr")}
                  onChange={(e) =>
                    handleInputChange("apt", "arr", e.target.value)
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
                  value={getValue("temp", "dep")}
                  onChange={(e) =>
                    handleInputChange("temp", "dep", e.target.value)
                  }
                  min="0"
                  max="55"
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getOperatingValue("temp")}
                  onChange={(e) =>
                    handleInputChange("temp", "op", e.target.value)
                  }
                  min="0"
                  max="55"
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("temp", "arr")}
                  onChange={(e) =>
                    handleInputChange("temp", "arr", e.target.value)
                  }
                  min="0"
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
                  max="31.99"
                  value={getValue("altr", "dep")}
                  onChange={(e) =>
                    handleInputChange("altr", "dep", e.target.value)
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
                  value={getOperatingValue("altr")}
                  onChange={(e) =>
                    handleInputChange("altr", "op", e.target.value)
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
                  value={getValue("altr", "arr")}
                  onChange={(e) =>
                    handleInputChange("altr", "arr", e.target.value)
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
                  value={getValue("alttd", "dep")}
                  onChange={(e) =>
                    handleInputChange("alttd", "dep", e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getOperatingValue("alttd")}
                  onChange={(e) =>
                    handleInputChange("alttd", "op", e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("alttd", "arr")}
                  onChange={(e) =>
                    handleInputChange("alttd", "arr", e.target.value)
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
                  value={getValue("rwy", "dep")}
                  onChange={(e) =>
                    handleInputChange("rwy", "dep", e.target.value)
                  }
                  className="w-full border rounded p-1"
                />
              </td>
              <td className="p-2"></td>
              <td className="p-2">
                <input
                  type="number"
                  value={getValue("rwy", "arr")}
                  onChange={(e) =>
                    handleInputChange("rwy", "arr", e.target.value)
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
