"use client";

import { ChangeEvent, useEffect, useState } from "react";

import type { JsonValue } from "@/utils/urlState";

export type SortieData = {
  pilot: string;
  sDate: string;
  sTime: string;
  acft: string;
  tailN: string;
  [key: string]: JsonValue;
};

interface SortieInfoProps {
  initialData?: SortieData;
  onUpdate: (data: SortieData) => void;
}

export default function SortieInfo({ initialData, onUpdate }: SortieInfoProps) {
  const [formData, setFormData] = useState<SortieData>({
    pilot: "",
    sDate: "",
    sTime: "",
    acft: "",
    tailN: "",
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
          <label htmlFor="sDate" className="block text-sm font-medium">
            Date of Sortie
          </label>
          <input
            type="date"
            id="sDate"
            name="sDate"
            value={formData.sDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="sTime" className="block text-sm font-medium">
            Time of Sortie
          </label>
          <input
            type="time"
            id="sTime"
            name="sTime"
            value={formData.sTime}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="acft" className="block text-sm font-medium">
            Aircraft Model
          </label>
          <input
            type="text"
            id="acft"
            name="acft"
            value={formData.acft}
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
            value={formData.tailN}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          />
        </div>
      </div>
    </div>
  );
}
