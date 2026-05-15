"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import aircraftData from "@/data/aircraft.json";
import type { WorksheetData } from "@/utils/types";
import PositionInput from "@/components/PositionInput";

interface SortieInfoProps {
  initialData?: WorksheetData;
  onUpdate: (data: Partial<WorksheetData>) => void;
}

type SortieInfoData = Pick<
  WorksheetData,
  | "pilot"
  | "date"
  | "time"
  | "duration"
  | "acType"
  | "tailN"
  | "airport"
  | "route"
  | "position"
  | "weight"
  | "altitude"
  | "mtnEndorse"
  | "mtnCert"
>;

export default function SortieInfo({ initialData, onUpdate }: SortieInfoProps) {
  const [formData, setFormData] = useState<SortieInfoData>({
    pilot: "",
    date: "",
    time: "",
    duration: null,
    acType: "",
    tailN: "",
    airport: ["", ""],
    route: "",
    position: [null, null],
    weight: null,
    altitude: [null, null, null],
    mtnEndorse: false,
    mtnCert: false,
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
        if (initialData[key as keyof WorksheetData] !== undefined && initialData[key as keyof WorksheetData] !== null) {
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

  const handleOperatingAltitudeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === "" ? null : Number(e.target.value);
    const currentAltitude = (initialData?.altitude ?? formData.altitude ?? [null, null, null]) as [number | null, number | null, number | null];
    const newAltitude: [number | null, number | null, number | null] = [currentAltitude[0], value, currentAltitude[2]];
    const updatedData = { ...formData, altitude: newAltitude };
    setFormData(updatedData);
    onUpdate({ altitude: newAltitude });
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

  const durationOptions = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => {
        const value = i * 0.5;
        return { value, label: value.toFixed(1) };
      }),
    []
  );

  const handleDurationChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value === "" ? null : Number(e.target.value);
    const updatedData = { ...formData, duration: value };
    setFormData(updatedData);
    onUpdate({ duration: value });
  };

  const handleQualChange = (field: "mtnEndorse" | "mtnCert") =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const updatedData = { ...formData, [field]: e.target.checked };
      setFormData(updatedData);
      onUpdate({ [field]: e.target.checked });
    };

  // Stable identity prevents the 60s currentTime ticker from cancelling
  // PositionInput's pending debounce on every re-render.
  const handlePositionChange = useCallback(
    (route: string, position: [number | null, number | null]) => {
      setFormData((prev) => ({ ...prev, route, position }));
      onUpdate({ route, position });
    },
    [onUpdate]
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

    const offsetTotalMinutes = -sortieUtc.getTimezoneOffset();
    const offsetSign = offsetTotalMinutes >= 0 ? "+" : "-";
    const offsetHours = Math.floor(Math.abs(offsetTotalMinutes) / 60);
    const offsetMins = Math.abs(offsetTotalMinutes) % 60;
    const utcOffset = offsetMins === 0
      ? `UTC${offsetSign}${offsetHours}`
      : `UTC${offsetSign}${offsetHours}:${String(offsetMins).padStart(2, "0")}`;

    const localDisplay = `${localMonth}/${localDay}/${localYear} ${localHours}${localMinutes} local (${utcOffset})`;

    const diffMinutes = Math.round(
      (sortieUtc.getTime() - currentTime.getTime()) / 60000
    );
    const absMinutes = Math.abs(diffMinutes);

    if (absMinutes === 0) {
      return `${localDisplay}, now`;
    }

    const isFuture = diffMinutes > 0;
    const suffix = isFuture ? "from now" : "ago";
    const MINUTES_PER_DAY = 60 * 24;
    const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;

    if (absMinutes > MINUTES_PER_WEEK) {
      return `${localDisplay}, more than a week ${suffix}`;
    }

    if (absMinutes >= MINUTES_PER_DAY) {
      const days = Math.round(absMinutes / MINUTES_PER_DAY);
      const dayLabel = `${days} day${days === 1 ? "" : "s"}`;
      return `${localDisplay}, ${dayLabel} ${suffix}`;
    }

    if (absMinutes < 60) {
      const minutes = absMinutes;
      const minuteLabel = `${minutes} minute${minutes === 1 ? "" : "s"}`;
      return `${localDisplay}, ${minuteLabel} ${suffix}`;
    }

    const hours = Math.round(absMinutes / 60);
    const hourLabel = `${hours} hour${hours === 1 ? "" : "s"}`;
    return `${localDisplay}, ${hourLabel} ${suffix}`;
  }, [formData.date, formData.time, currentTime]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Pilot &amp; Aircraft
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          When
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div className="space-y-2">
            <label htmlFor="duration" className="block text-sm font-medium">
              Expected Duration (hrs)
            </label>
            <select
              id="duration"
              name="duration"
              value={formData.duration ?? ""}
              onChange={handleDurationChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            >
              <option value="">Select Duration</option>
              {durationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {sortieLocalTiming && (
          <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            {sortieLocalTiming}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Where
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <PositionInput
            rawValue={formData.route || ""}
            cachedPosition={formData.position ?? [null, null]}
            onChange={handlePositionChange}
          />

          <div className="space-y-2">
            <label htmlFor="operatingAltitude" className="block text-sm font-medium">
              Operating Altitude (MSL ft)
            </label>
            <input
              type="number"
              id="operatingAltitude"
              value={formData.altitude?.[1] ?? ""}
              onChange={handleOperatingAltitudeChange}
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

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Pilot Qualifications
        </h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.mtnEndorse}
              onChange={handleQualChange("mtnEndorse")}
            />
            Current CAPF 70-5 Mountain Flight Endorsement?
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.mtnCert}
              onChange={handleQualChange("mtnCert")}
            />
            Current CAPF 70-91 and Mountain Flying Certification?
          </label>
        </div>
      </div>
    </div>
  );
}
