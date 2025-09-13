"use client";

import { ChangeEvent, useEffect, useState } from "react";

import type { JsonValue } from "@/utils/urlState";

export type SortieData = {
  pilotName: string;
  sortieDate: string;
  sortieTime: string;
  aircraftModel: string;
  tailNumber: string;
  [key: string]: JsonValue;
};

interface SortieInfoProps {
  initialData?: SortieData;
  onUpdate: (data: SortieData) => void;
}

export default function SortieInfo({ initialData, onUpdate }: SortieInfoProps) {
  const [formData, setFormData] = useState<SortieData>({
    pilotName: "",
    sortieDate: "",
    sortieTime: "",
    aircraftModel: "",
    tailNumber: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedData = { ...formData, [name]: value };
    setFormData(updatedData);
    onUpdate(updatedData);
  };

  return (
    <div className="w-full max-w-2xl space-y-4 bg-white dark:bg-black/[.15] p-6 rounded-lg shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="pilotName" className="block text-sm font-medium">
            Pilot Name
          </label>
          <input
            type="text"
            id="pilotName"
            name="pilotName"
            value={formData.pilotName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="sortieDate" className="block text-sm font-medium">
            Date of Sortie
          </label>
          <input
            type="date"
            id="sortieDate"
            name="sortieDate"
            value={formData.sortieDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="sortieTime" className="block text-sm font-medium">
            Time of Sortie
          </label>
          <input
            type="time"
            id="sortieTime"
            name="sortieTime"
            value={formData.sortieTime}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="aircraftModel" className="block text-sm font-medium">
            Aircraft Model
          </label>
          <input
            type="text"
            id="aircraftModel"
            name="aircraftModel"
            value={formData.aircraftModel}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="tailNumber" className="block text-sm font-medium">
            Aircraft Tail Number
          </label>
          <input
            type="text"
            id="tailNumber"
            name="tailNumber"
            value={formData.tailNumber}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>
      </div>
    </div>
  );
}
