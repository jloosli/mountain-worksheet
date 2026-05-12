"use client";

import { useEffect, useMemo, useState } from "react";
import { LinkIcon } from "@heroicons/react/24/outline";

interface WorksheetHeaderProps {
  onReset: () => void;
  onShare: () => void | Promise<void>;
  useFahrenheit: boolean;
  onToggleTempUnit: () => void;
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
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { dateLabel, timeLabel } = useMemo(() => formatUtcDisplay(now), [now]);

  // Don't render time until after hydration to avoid SSR/CSR mismatch.
  // Wrapped in two stacked spans so it doesn't shift after mount.
  return (
    <div className="hidden flex-col items-end text-right text-xs leading-tight text-slate-300 md:flex">
      <span className="uppercase tracking-wide">Current Time</span>
      <span className="font-mono text-sm text-slate-200">
        {mounted ? timeLabel : "--:--:-- UTC"}
      </span>
      <span>{mounted ? dateLabel : "-- --- --"}</span>
    </div>
  );
};

export default function WorksheetHeader({
  onReset,
  onShare,
  useFahrenheit,
  onToggleTempUnit,
}: WorksheetHeaderProps) {
  return (
    <header className="w-full bg-slate-900 text-white shadow-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3.5 md:px-6">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-[28px]">
            Mountain Flying Worksheet
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <UtcClock />
          <div className="flex items-center gap-1.5">
            <button
              onClick={onReset}
              className="rounded-md border border-slate-700/60 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Reset
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 rounded-md border border-slate-700/60 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <LinkIcon className="h-3 w-3" />
              Copy link
            </button>
            <button
              onClick={onToggleTempUnit}
              title="Toggle temperature unit"
              className="flex items-center gap-1 rounded-md border border-slate-700/60 px-2.5 py-1 text-xs font-mono"
            >
              <span className={useFahrenheit ? "text-slate-500" : "font-semibold text-white"}>°C</span>
              <span className="text-slate-600">|</span>
              <span className={useFahrenheit ? "font-semibold text-white" : "text-slate-500"}>°F</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
