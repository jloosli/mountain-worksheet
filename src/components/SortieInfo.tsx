"use client";

import { ChangeEvent, useEffect, useState } from "react";
import aircraftData from "@/data/aircraft.json";
import type { URLSerializable, WorksheetData } from "@/utils/types";

type SortieFields = Pick<
  WorksheetData,
  "pilot" | "date" | "time" | "acType" | "tailN"
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
    const updatedData = { ...formData, [name]: value };
    setFormData(updatedData);
    onUpdate(updatedData);
  };

  return (
    <div className="w-full max-w-2xl space-y-4 bg-white dark:bg-black/[.15] p-6 rounded-lg shadow-sm">
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
      </div>
    </div>
  );
}
