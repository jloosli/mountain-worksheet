// src/components/StepShell.tsx
import { type ReactNode } from "react";
import type { StepStatus } from "@/components/Stepper";

interface StepShellProps {
  id: string;
  number: number;
  status: StepStatus;
  title: string;
  subtitle?: string;
  badge?: string;
  showSpine?: boolean;
  children: ReactNode;
}

const circleBg: Record<StepStatus, string> = {
  pending:  "bg-slate-300",
  active:   "bg-slate-900",
  complete: "bg-emerald-500",
  warning:  "bg-amber-500",
};

const circleText: Record<StepStatus, string> = {
  pending:  "text-slate-700",
  active:   "text-white",
  complete: "text-white",
  warning:  "text-white",
};

const badgeStyle: Record<StepStatus, string> = {
  pending:  "bg-slate-50 text-slate-600 border-slate-200",
  active:   "bg-slate-50 text-slate-700 border-slate-200",
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning:  "bg-amber-50 text-amber-700 border-amber-200",
};

export default function StepShell({
  id,
  number,
  status,
  title,
  subtitle,
  badge,
  showSpine = true,
  children,
}: StepShellProps) {
  return (
    <section
      id={id}
      className="relative pl-14 md:pl-16 scroll-mt-[60px]"
    >
      <div
        className="absolute left-0 top-0 bottom-0 flex flex-col items-center"
        aria-hidden="true"
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full font-mono font-bold text-base shadow ring-4 ring-slate-100 ${circleBg[status]} ${circleText[status]}`}
        >
          {number}
        </div>
        {showSpine && (
          <div
            data-testid="step-spine"
            className="mt-2 w-px flex-1 bg-slate-300"
          />
        )}
      </div>
      <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {badge && (
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${badgeStyle[status]}`}
            >
              {badge}
            </span>
          )}
        </header>
        <div className="px-5 py-5 space-y-6">{children}</div>
      </article>
    </section>
  );
}
