"use client";

import { useEffect, useMemo, useState } from "react";
import { LinkIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

/** Outcome of the last "Copy link". */
export type ShareStatus =
  | { kind: "copied" }
  | { kind: "failed"; link: string; reason: string };

interface WorksheetHeaderProps {
  onReset: () => void;
  onShare: () => void | Promise<void>;
  shareStatus?: ShareStatus | null;
  useFahrenheit: boolean;
  onToggleTempUnit: () => void;
  onOpenInstructions: () => void;
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
  shareStatus = null,
  useFahrenheit,
  onToggleTempUnit,
  onOpenInstructions,
}: WorksheetHeaderProps) {
  return (
    <header className="w-full bg-slate-900 text-white shadow-md print:hidden">
      {/* Below sm the title gets its own row so it isn't truncated to "Mountain F…"
          by the control cluster; from sm up both share one row as before. */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:truncate md:text-[28px]">
            Mountain Flying Worksheet
          </h1>
        </div>
        <div className="flex items-center justify-end gap-3 sm:shrink-0">
          <UtcClock />
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenInstructions}
              title="Instructions & operational notes"
              aria-label="Open instructions"
              className="flex items-center rounded-md border border-slate-700/60 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <QuestionMarkCircleIcon className="h-3.5 w-3.5" />
            </button>
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
      {shareStatus && <ShareStatusLine status={shareStatus} />}
    </header>
  );
}

function ShareStatusLine({ status }: { status: ShareStatus }) {
  if (status.kind === "copied") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-2 md:px-6">
        <p role="status" className="text-right text-xs text-slate-300">
          Link copied to clipboard.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-3 md:px-6">
      <div
        role="alert"
        className="rounded border border-red-800 bg-red-950/60 px-2 py-1.5 text-xs text-red-100"
      >
        <span className="font-semibold">Warning:</span> Couldn&apos;t copy the
        link ({status.reason}). Copy it from here:
        <input
          readOnly
          aria-label="Worksheet link"
          value={status.link}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 block w-full rounded border border-red-800 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100"
        />
      </div>
    </div>
  );
}
