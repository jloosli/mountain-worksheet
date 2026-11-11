import { CautionMarkers } from "@/components/ValueMarkers";
import {
  LIMIT_STATE_LABEL,
  limitCheckDomId,
  type LimitCheck,
  type LimitState,
} from "@/utils/limitChecks";
import type { StepId } from "@/utils/notifications";

/**
 * Per-state styles. Not checked is dashed and neutral: it is not a warning
 * color, because a missing input is not a failed limit.
 */
const STYLE: Record<LimitState, { chip: string; dot: string; box: string; text: string }> = {
  exceeded: {
    chip: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
    dot: "bg-red-600",
    box: "border-red-300 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-300",
  },
  "not-checked": {
    chip: "border-dashed border-slate-400 bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300",
    dot: "bg-white ring-2 ring-inset ring-slate-400 dark:bg-slate-900",
    box: "border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900",
    text: "text-slate-600 dark:text-slate-400",
  },
  near: {
    chip: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    dot: "bg-amber-500",
    box: "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20",
    text: "text-amber-800 dark:text-amber-300",
  },
  within: {
    chip: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    dot: "bg-emerald-600",
    box: "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
    text: "text-slate-900 dark:text-slate-100",
  },
};

/**
 * The style of a value a check evaluates, in an on-screen table. Only
 * Exceeded and Near limit are styled; Within limit and Not checked are not.
 */
export function limitPointClass(state: LimitState | undefined): string {
  if (state === "exceeded") return "font-bold text-red-700 dark:text-red-400";
  if (state === "near") return "font-bold text-amber-800 dark:text-amber-400";
  return "";
}

export function LimitStateDot({ state }: { state: LimitState }) {
  return (
    <span
      aria-hidden="true"
      data-limit-state={state}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STYLE[state].dot}`}
    />
  );
}

export function LimitStateChip({ state }: { state: LimitState }) {
  return (
    <span
      data-limit-state={state}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${STYLE[state].chip}`}
    >
      <LimitStateDot state={state} />
      {LIMIT_STATE_LABEL[state]}
    </span>
  );
}

/**
 * One Limit check at the top of the step that owns its values: name, state
 * chip, worksheet limit, each point with its value or what it's waiting for,
 * substitution markers, and the fixed caveat.
 */
export default function LimitCheckCallout({ check }: { check: LimitCheck }) {
  const style = STYLE[check.state];
  return (
    <section
      id={limitCheckDomId(check.id)}
      aria-label={`Limit check: ${check.name}`}
      data-limit-state={check.state}
      className={`scroll-mt-[calc(var(--action-bar-bottom,13rem)+0.75rem)] rounded-lg border px-3 py-2 ${style.box}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Limit check · {check.name}
        </h3>
        <LimitStateChip state={check.state} />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Worksheet limit: {check.limit}
        </span>
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {check.points.map((p) => (
          <li key={p.label} className="inline-flex items-center gap-1.5">
            <LimitStateDot state={p.state} />
            <span className="text-slate-500 dark:text-slate-400">{p.label}</span>
            {p.value !== undefined ? (
              <span className={`font-mono ${STYLE[p.state].text}`}>{p.value}</span>
            ) : (
              <span className="italic text-slate-600 dark:text-slate-400">{p.waitingFor}</span>
            )}
            <CautionMarkers cautions={p.substitutions} />
            {/* The dot and color are aria-hidden or visual only; name the state in text. */}
            <span className="sr-only"> ({LIMIT_STATE_LABEL[p.state]})</span>
          </li>
        ))}
      </ul>
      {check.note && (
        <p className={`mt-1 text-xs ${style.text}`}>{check.note}</p>
      )}
      {check.caveat && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{check.caveat}</p>
      )}
    </section>
  );
}

/** The callouts for every check `step` owns, or nothing. */
export function LimitCheckCallouts({
  checks,
  step,
}: {
  checks: readonly LimitCheck[];
  step: StepId;
}) {
  const here = checks.filter((c) => c.step === step);
  if (here.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      {here.map((c) => (
        <LimitCheckCallout key={c.id} check={c} />
      ))}
    </div>
  );
}
