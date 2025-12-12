"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import aircraftData from "@/data/aircraft.json";
import type { WorksheetData } from "@/utils/types";

interface SortieInfoProps {
  initialData?: WorksheetData;
  onUpdate: (data: Partial<WorksheetData>) => void;
}

type SortieInfoData = Pick<
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

export default function SortieInfo({ initialData, onUpdate }: SortieInfoProps) {
  const [formData, setFormData] = useState<SortieInfoData>({
    pilot: "",
    date: "",
    time: "",
    acType: "",
    tailN: "",
    airport: ["", ""],
    route: "",
    weight: null,
  });

  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialData) {
      const newData = {} as Partial<SortieInfoData>;
      for (const key in formData) {
        if (initialData[key as keyof WorksheetData]) {
          // @ts-expect-error - Dynamic key assignment is safe here
          newData[key as keyof SortieInfoData] =
            initialData[key as keyof WorksheetData];
        }
      }
      setFormData({ ...formData, ...newData });
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
    const airportArray = (
      formData.airport ? [...formData.airport] : ["", ""]
    ) as [string, string];
    // Convert airport codes to uppercase
    airportArray[index] = value.toUpperCase();
    const updatedData = { ...formData, airport: airportArray };
    setFormData(updatedData);
    onUpdate(updatedData);
  };

  const utcHourOptions = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => {
        const paddedHour = String(hour).padStart(2, "0");
        return {
          value: `${paddedHour}:00`,
          label: `${paddedHour}00`,
        };
      }),
    []
  );

  const sortieLocalTiming = useMemo(() => {
    if (!formData.date || !formData.time || !formData.time.includes(":")) {
      return null;
    }

    const [yearStr, monthStr, dayStr] = formData.date.split("-");
    const [hourStr, minuteStr] = formData.time.split(":");

    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const hour = Number(hourStr);
    const minute = Number(minuteStr);

    if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
      return null;
    }

    const sortieUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));

    if (Number.isNaN(sortieUtc.getTime())) {
      return null;
    }

    const localMonth = String(sortieUtc.getMonth() + 1).padStart(2, "0");
    const localDay = String(sortieUtc.getDate()).padStart(2, "0");
    const localYear = String(sortieUtc.getFullYear() % 100).padStart(2, "0");
    const localHours = String(sortieUtc.getHours()).padStart(2, "0");
    const localMinutes = String(sortieUtc.getMinutes()).padStart(2, "0");

    const localDisplay = `${localMonth}/${localDay}/${localYear} ${localHours}${localMinutes} local`;

    const diffMinutes = Math.round(
      (sortieUtc.getTime() - currentTime.getTime()) / 60000
    );
    const absMinutes = Math.abs(diffMinutes);

    if (absMinutes === 0) {
      return `${localDisplay}, now`;
    }

    const isFuture = diffMinutes > 0;

    if (absMinutes < 60) {
      const minutes = absMinutes;
      const minuteLabel = `${minutes} minute${minutes === 1 ? "" : "s"}`;
      return `${localDisplay}, ${minuteLabel} ${isFuture ? "from now" : "ago"}`;
    }

    const hours = Math.round(absMinutes / 60);
    const hourLabel = `${hours} hour${hours === 1 ? "" : "s"}`;
    return `${localDisplay}, ${hourLabel} ${isFuture ? "from now" : "ago"}`;
  }, [formData.date, formData.time, currentTime]);

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
            Time of Sortie (UTC)
          </label>
          <select
            id="time"
            name="time"
            value={formData.time}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
          >
            <option value="">Select Time</option>
            {utcHourOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {sortieLocalTiming && (
          <div className="sm:col-span-2 text-xs text-gray-600 dark:text-gray-400">
            {sortieLocalTiming}
          </div>
        )}

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
            value={formData.airport?.[0] || ""}
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
            value={formData.airport?.[1] || ""}
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
