"use client";

import { ChangeEvent, useEffect, useState } from "react";
import aircraftData from "@/data/aircraft.json";
import type { URLSerializable, WorksheetData } from "@/utils/types";

type SortieFields = Pick<
  WorksheetData,
  | "pilot"
  | "date"
  | "time"
  | "acType"
  | "tailN"
  | "airport"
  | "route"
  | "weight"
>;

interface SortieInfoProps {
  initialData?: SortieFields;
  onUpdate: (data: Partial<URLSerializable<WorksheetData>>) => void;
}

export default function SortieInfo({ initialData, onUpdate }: SortieInfoProps) {
  const [formData, setFormData] = useState<SortieFields>({
    pilot: "",
    date: "",
    time: "",
    acType: "",
    tailN: "",
    airport: ["", ""],
    route: "",
    weight: null,
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    // Convert to uppercase for tailN and route fields
    const processedValue =
      name === "tailN" || name === "route" ? value.toUpperCase() : value;
    const updatedData = { ...formData, [name]: processedValue };
    setFormData(updatedData);
    onUpdate(updatedData);
  };

  const handleWeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === "" ? null : Number(e.target.value);
    const updatedData = { ...formData, weight: value };
    setFormData(updatedData);
    onUpdate({ weight: value });
  };

  const handleAirportChange = (index: number, value: string) => {
    const airportArray = [...formData.airport] as [string, string];
    // Convert airport codes to uppercase
    airportArray[index] = value.toUpperCase();
    const updatedData = { ...formData, airport: airportArray };
    setFormData(updatedData);
    onUpdate(updatedData);
  };

  return (
    <div className="w-full max-w-4xl space-y-4 bg-white dark:bg-black/[.15] rounded-lg shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="pilot" className="block text-sm font-medium">
            Pilot Name
          </label>
          <input
            type="text"
            id="pilot"
            name="pilot"
            value={formData.pilot || ""}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="acType" className="block text-sm font-medium">
            Aircraft Model
          </label>
          <select
            id="acType"
            name="acType"
            value={formData.acType || ""}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          >
            <option value="">Select Aircraft</option>
            {aircraftData.map((aircraft) => (
              <option key={aircraft.id} value={aircraft.id}>
                {aircraft.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="date" className="block text-sm font-medium">
            Date of Sortie
          </label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="time" className="block text-sm font-medium">
            Time of Sortie
          </label>
          <input
            type="time"
            id="time"
            name="time"
            value={formData.time}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="tailN" className="block text-sm font-medium">
            Aircraft Tail Number
          </label>
          <input
            type="text"
            id="tailN"
            name="tailN"
            value={formData.tailN || ""}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="departureAirport"
            className="block text-sm font-medium"
          >
            Departure Airport
          </label>
          <input
            type="text"
            id="departureAirport"
            value={formData.airport[0] || ""}
            onChange={(e) => handleAirportChange(0, e.target.value)}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="route" className="block text-sm font-medium">
            Area of Operations/Route
          </label>
          <input
            type="text"
            id="route"
            name="route"
            value={formData.route || ""}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="arrivalAirport" className="block text-sm font-medium">
            Arrival Airport
          </label>
          <input
            type="text"
            id="arrivalAirport"
            value={formData.airport[1] || ""}
            onChange={(e) => handleAirportChange(1, e.target.value)}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="weight" className="block text-sm font-medium">
            Aircraft Takeoff Weight (lbs)
          </label>
          <input
            type="number"
            id="weight"
            name="weight"
            value={formData.weight ?? ""}
            onChange={handleWeightChange}
            min={2200}
            max={3600}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>
      </div>
    </div>
  );
}
