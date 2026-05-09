"use client";

import { useEffect, useMemo, useState } from "react";
import WeatherDataIntegration from "@/components/WeatherDataIntegration";
import type { WorksheetData } from "@/utils/types";
import { LinkIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
import { CloudArrowDownIcon } from "@heroicons/react/24/outline";

interface WorksheetHeaderProps {
  onReset: () => void;
  onShare: () => void | Promise<void>;
  worksheetData: Partial<WorksheetData>;
  onWeatherDataUpdate: (data: Partial<WorksheetData>) => void;
  onWeatherTimestampUpdate: (timestamp: Date) => void;
  weatherLastUpdated?: Date;
}

const formatUtcDisplay = (date: Date) => {
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return {
    dateLabel: dateFormatter.format(date),
    timeLabel: `${timeFormatter.format(date)} UTC`,
  };
};

const UtcClock = () => {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setMounted(true);
    // Update immediately on mount to ensure client and server match
    setNow(new Date());

    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const { dateLabel, timeLabel } = useMemo(() => formatUtcDisplay(now), [now]);

  // Don't render time until after hydration to avoid mismatch
  if (!mounted) {
    return (
      <div className="flex flex-col items-start text-left md:items-end md:text-right gap-0.5">
        <span className="uppercase text-xs tracking-wide text-slate-300">
          Current Time
        </span>
        <span className="font-mono text-2xl font-semibold">--:--:-- UTC</span>
        <span className="text-sm text-slate-300">-- --- --</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start text-left md:items-end md:text-right gap-0.5">
      <span className="uppercase text-xs tracking-wide text-slate-300">
        Current Time
      </span>
      <span className="font-mono text-2xl font-semibold">{timeLabel}</span>
      <span className="text-sm text-slate-300">{dateLabel}</span>
    </div>
  );
};

export default function WorksheetHeader({
  onReset,
  onShare,
  worksheetData,
  onWeatherDataUpdate,
  onWeatherTimestampUpdate,
  weatherLastUpdated,
}: WorksheetHeaderProps) {
  return (
    <header className="w-full bg-slate-900 text-white shadow-md">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            Mountain Flying Worksheet
          </h1>
          <UtcClock />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onReset}
              className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
            >
              Reset Worksheet
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              <LinkIcon className="h-5 w-5" />
              Copy Link
            </button>
            <WeatherDataIntegration
              worksheetData={worksheetData}
              onDataUpdate={onWeatherDataUpdate}
              onTimestampUpdate={onWeatherTimestampUpdate}
              hideBox={true}
              renderButton={({ onClick, disabled, isLoading }) => (
                <button
                  type="button"
                  onClick={onClick}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    !disabled
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "cursor-not-allowed bg-slate-700 text-slate-400"
                  }`}
                >
                  {isLoading ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <CloudArrowDownIcon className="h-5 w-5" />
                  )}
                  {isLoading ? "Loading..." : "Fetch Weather"}
                </button>
              )}
            />
          </div>

          {weatherLastUpdated && (
            <div className="text-sm text-slate-300">
              Weather updated at {weatherLastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
