// src/components/ActionBar.tsx
"use client";

import { useEffect, useRef } from "react";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentCheckIcon,
  CloudArrowDownIcon,
  ExclamationCircleIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { LimitStateDot } from "@/components/LimitCheckCallout";
import type { ActionBarState } from "@/utils/actionBarState";
import {
  bySeverity,
  limitCheckDomId,
  limitCheckSummary,
  type LimitCheck,
} from "@/utils/limitChecks";
import type { WorksheetData } from "@/utils/types";

interface ActionBarProps {
  state: ActionBarState;
  worksheetData: WorksheetData;
  /** The Limit checks, summarized in one sentence that jumps to the worst. */
  limitChecks: readonly LimitCheck[];
  weatherLastUpdated?: Date;
  onFetch: () => void;
  fetchDisabled: boolean;
  isFetching: boolean;
  onOpenChecklist: () => void;
  onPrint: () => void;
}

/**
 * Publishes the bar's bottom edge as `--action-bar-bottom` on the root, so
 * jump targets can set their scroll margin below it. The bar's height varies
 * with its state and the screen width (it stacks below `sm`), so it is
 * measured rather than assumed.
 */
function usePublishedBottomEdge() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      const top = parseFloat(getComputedStyle(el).top) || 0;
      root.style.setProperty(
        "--action-bar-bottom",
        `${Math.ceil(top + el.getBoundingClientRect().height)}px`,
      );
    };
    publish();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

const formatHhMmZ = (time: string): string =>
  // time is "HH:MM" from the form; renders it as "18:00z"
  time ? `${time}z` : "—";

const formatClockUtc = (d: Date): string => {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}z`;
};

export default function ActionBar({
  state,
  worksheetData,
  limitChecks,
  weatherLastUpdated,
  onFetch,
  fetchDisabled,
  isFetching,
  onOpenChecklist,
  onPrint,
}: ActionBarProps) {
  const barRef = usePublishedBottomEdge();
  return (
    <div
      ref={barRef}
      className="sticky top-[44px] z-10 border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_8px_-6px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 print:hidden"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-stretch gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6">
        {state === "incomplete" && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <ExclamationCircleIcon className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Add departure airport, arrival airport, date, and time to fetch weather
              </div>
            </div>
          </div>
        )}

        {state === "ready" && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Sortie details ready
              </div>
              <div className="hidden sm:block text-xs text-slate-600 dark:text-slate-400">
                {worksheetData.airport[0] || "—"} → {worksheetData.airport[1] || "—"} · departing{" "}
                {formatHhMmZ(worksheetData.time)} · ready to fetch weather
              </div>
            </div>
          </div>
        )}

        {state === "fetched" && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Weather fetched
                {weatherLastUpdated && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {formatClockUtc(weatherLastUpdated)}
                    </span>
                  </>
                )}
              </div>
              <div className="hidden sm:block text-xs text-slate-600 dark:text-slate-400">
                Review the weather below, then proceed to the decision.
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 shrink-0">
          {state === "incomplete" && (
            <FetchButton onClick={onFetch} disabled={true} isLoading={isFetching} />
          )}

          {state === "ready" && (
            <FetchButton onClick={onFetch} disabled={fetchDisabled} isLoading={isFetching} />
          )}

          {state === "fetched" && (
            <>
              <button
                type="button"
                onClick={onFetch}
                disabled={fetchDisabled || isFetching}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <ArrowPathIcon className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                {isFetching ? "Loading…" : "Re-fetch"}
              </button>
              <a
                href="#step-decision"
                className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Review decision
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </a>
            </>
          )}

          <div className="flex items-center gap-1.5 sm:ml-0.5 sm:border-l sm:border-slate-200 sm:pl-2.5 dark:sm:border-slate-700">
            <button
              type="button"
              onClick={onPrint}
              title="Print one-page briefing"
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <PrinterIcon className="h-3.5 w-3.5" />
              Print briefing
            </button>
            <button
              type="button"
              onClick={onOpenChecklist}
              title="Open Mountain Flying Checklist"
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <ClipboardDocumentCheckIcon className="h-3.5 w-3.5" />
              Checklist
            </button>
          </div>
        </div>
      </div>
      <LimitCheckSummary checks={limitChecks} />
    </div>
  );
}

/**
 * One line: a dot per check, worst first, then the counts. It has no overall
 * color and states no verdict; clicking jumps to the worst check.
 */
function LimitCheckSummary({ checks }: { checks: readonly LimitCheck[] }) {
  if (checks.length === 0) return null;
  const ordered = bySeverity(checks);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-2 md:px-6">
      <a
        href={`#${limitCheckDomId(ordered[0].id)}`}
        className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <span className="flex gap-1">
          {ordered.map((c) => (
            <LimitStateDot key={c.id} state={c.state} />
          ))}
        </span>
        <span className="min-w-0 flex-1 font-medium">{limitCheckSummary(checks)}</span>
        <span className="hidden text-xs text-slate-500 sm:inline dark:text-slate-400">
          Worksheet limits ↓
        </span>
      </a>
    </div>
  );
}

interface FetchButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
}

function FetchButton({ onClick, disabled, isLoading }: FetchButtonProps) {
  const isReady = !disabled && !isLoading;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={
        isReady
          ? "flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600"
          : "flex cursor-not-allowed items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
      }
    >
      {isLoading ? (
        <ArrowPathIcon className="h-4 w-4 animate-spin" />
      ) : (
        <CloudArrowDownIcon className="h-4 w-4" />
      )}
      {isLoading ? "Loading…" : "Fetch weather"}
      {isReady && <ArrowRightIcon className="h-4 w-4 -mr-0.5" />}
    </button>
  );
}
