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
  pending:  "bg-slate-300",
  active:   "bg-slate-900",
  complete: "bg-emerald-500",
  warning:  "bg-amber-500",
};

const badgeColor: Record<StepStatus, string> = {
  pending:  "text-slate-500",
  active:   "text-slate-900",
  complete: "text-emerald-600",
  warning:  "text-amber-600",
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
      className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75"
    >
      <div className="mx-auto max-w-5xl px-4 py-2.5 md:px-6">
        <ol className="flex items-center gap-1.5 overflow-x-auto text-sm">
          {steps.map((step, i) => {
            const isActive = currentId === step.id;
            return (
              <Fragment key={step.id}>
                {i > 0 && (
                  <li aria-hidden="true" className="text-slate-300">
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </li>
                )}
                <li className="shrink-0">
                  <a
                    href={`#${step.id}`}
                    data-active={isActive || undefined}
                    className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 transition-all data-[active]:ring-2 data-[active]:ring-slate-900 data-[active]:shadow-sm"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${circleBg[step.status]} font-mono text-xs font-semibold text-white`}
                    >
                      {step.number}
                    </span>
                    <span
                      className={
                        isActive
                          ? "font-medium text-slate-900"
                          : "text-slate-700"
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
