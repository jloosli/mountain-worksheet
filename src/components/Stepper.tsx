// src/components/Stepper.tsx
"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

export type StepStatus = "pending" | "active" | "complete" | "warning";

export interface StepperStep {
  id: string;
  number: number;
  label: string;
  status: StepStatus;
  /** Optional small badge text rendered after the label (e.g. "8 of 11", "●", "⚠ 1"). */
  badge?: string;
}

interface StepperProps {
  steps: StepperStep[];
  /** If set, this id is the active pill. If undefined, scroll-spy picks the active id. */
  activeId?: string;
}

const circleBg: Record<StepStatus, string> = {
  pending:  "bg-slate-300 dark:bg-slate-700",
  active:   "bg-slate-900 dark:bg-slate-100",
  complete: "bg-emerald-500",
  warning:  "bg-amber-500",
};

const circleText: Record<StepStatus, string> = {
  pending:  "text-slate-700 dark:text-slate-300",
  active:   "text-white dark:text-slate-900",
  complete: "text-white",
  warning:  "text-white",
};

const badgeColor: Record<StepStatus, string> = {
  pending:  "text-slate-500 dark:text-slate-500",
  active:   "text-slate-900 dark:text-slate-100",
  complete: "text-emerald-600 dark:text-emerald-400",
  warning:  "text-amber-600 dark:text-amber-400",
};

export default function Stepper({ steps, activeId }: StepperProps) {
  const [scrollSpyId, setScrollSpyId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (activeId !== undefined) return; // explicit control wins
    if (typeof IntersectionObserver === "undefined") return; // SSR / jsdom safety
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.sort(
          (a, b) =>
            a.target.getBoundingClientRect().top -
            b.target.getBoundingClientRect().top
        )[0];
        setScrollSpyId(topMost.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    steps.forEach((step) => {
      const el = document.getElementById(step.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [steps, activeId]);

  const currentId = activeId ?? scrollSpyId ?? steps[0]?.id;

  return (
    <nav
      aria-label="Worksheet steps"
      className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/75"
    >
      <div className="mx-auto max-w-5xl px-4 py-2.5 md:px-6">
        <ol className="-mx-1 -my-1 flex items-center gap-1.5 overflow-x-auto px-1 py-1 text-sm">
          {steps.map((step, i) => {
            const isActive = currentId === step.id;
            return (
              <Fragment key={step.id}>
                {i > 0 && (
                  <li
                    aria-hidden="true"
                    className="text-slate-300 dark:text-slate-700"
                  >
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </li>
                )}
                <li className="shrink-0">
                  <a
                    href={`#${step.id}`}
                    data-active={isActive || undefined}
                    className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-transparent transition-all data-[active]:ring-2 data-[active]:ring-slate-900 data-[active]:shadow-sm dark:bg-slate-900 dark:ring-slate-800 dark:data-[active]:ring-slate-200 dark:data-[active]:shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_2px_8px_-2px_rgba(0,0,0,0.6)]"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${circleBg[step.status]} font-mono text-xs font-semibold ${circleText[step.status]}`}
                    >
                      {step.number}
                    </span>
                    <span
                      className={
                        isActive
                          ? "font-medium text-slate-900 dark:text-slate-100"
                          : "text-slate-700 dark:text-slate-400"
                      }
                    >
                      {step.label}
                    </span>
                    {step.badge && (
                      <span
                        className={`text-xs font-medium ${badgeColor[step.status]}`}
                      >
                        {step.badge}
                      </span>
                    )}
                  </a>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
