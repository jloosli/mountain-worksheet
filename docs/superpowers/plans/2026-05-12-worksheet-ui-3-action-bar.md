# Worksheet UI Redesign — Phase 3: Action Bar + Slim Header + Derived Status

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slim the WorksheetHeader to utility-chrome only (Reset / Copy link / °F toggle), add a sticky state-aware `ActionBar` that morphs through `incomplete / ready / fetched / all-done` states with the Fetch Weather button living inside it, and replace the hardcoded `active / pending / pending` step statuses with values derived from worksheet state.

**Architecture:** Two pure-function utility modules compute derived state from `WorksheetData` + `weatherLastUpdated`: `actionBarState.ts` (returns one of four state tags) and `stepStatuses.ts` (returns `StepStatus` for each of the three steps). A new `ActionBar` client component takes the state tag + worksheet data + fetch callback and renders the correct title / subtext / button group for that state. `AppContainer` moves the existing `<WeatherDataIntegration hideBox>` mount out of `WorksheetHeader` and renders `<ActionBar>` inside its `renderButton` callback, so the fetch button's onClick / disabled / isLoading wiring stays unchanged. `WorksheetHeader` drops the four weather props and renders a single tight row (title + UTC clock + Reset / Copy link / °C-°F).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `@heroicons/react/24/outline` and `/24/solid` (existing), Jest + Testing Library.

**Read before starting:** `docs/superpowers/plans/2026-05-11-worksheet-ui-redesign-index.md` for series context, `docs/superpowers/plans/2026-05-11-worksheet-ui-2-step-cards.md` for Phase 2 baseline, and `docs/numbered-step-shell-mockup.html` — specifically the header (lines ~149–176), the sticky action bar (lines ~209–293, including the four state blocks), and the stepper (lines ~178–207). The bottom-right "demo chip" in the mockup cycles `body[data-state="..."]` through all four action-bar states — toggle it to see what each state should look like.

---

## File Structure

**Create:**
- `src/utils/actionBarState.ts` — pure-function module exporting `ActionBarState` type union, `canFetchWeather(state)` predicate, and `deriveActionBarState(state, weatherLastUpdated)` deriver
- `src/utils/actionBarState.test.ts` — colocated unit tests
- `src/utils/stepStatuses.ts` — pure-function module exporting `deriveStepStatuses(state, weatherLastUpdated)` returning `{ sortie, weather, decision }` of `StepStatus`
- `src/utils/stepStatuses.test.ts` — colocated unit tests
- `src/components/ActionBar.tsx` — sticky state-aware bar (4 visual variants)
- `src/components/ActionBar.test.tsx` — colocated component tests

**Modify:**
- `src/components/WorksheetHeader.tsx` — drop `worksheetData` / `onWeatherDataUpdate` / `onWeatherTimestampUpdate` / `weatherLastUpdated` props and the `<WeatherDataIntegration>` block inside; collapse to a single tight row with title + UTC clock + Reset / Copy link / °C–°F; slim button styling per the mockup (`px-2.5 py-1 text-xs` border-only)
- `src/components/WorksheetHeader.test.tsx` — drop the obsolete prop fields from `defaultProps`; the existing assertions still pass
- `src/components/AppContainer.tsx` — replace the static `WORKSHEET_STEPS` constant with a `useMemo`-derived array driven by `deriveStepStatuses`; replace the hardcoded `status="pending"` on the Decision `<StepShell>` with the derived status; move `<WeatherDataIntegration hideBox renderButton={…}>` from inside `WorksheetHeader` to a top-level mount between `<Stepper>` and `<main>`, where `renderButton` returns `<ActionBar … />`; drop the four obsolete props from the `<WorksheetHeader>` call
- `src/components/AppContainer.test.tsx` — add an assertion that the action-bar region is rendered (so a future regression in wiring is caught)

**Out of scope (do not add here):**
- Stepper badges showing "X of 11" / "●" / "⚠ N" sub-counts (the badge prop on `Stepper` is already wired, but computing field counts and warning counts is deferred — Step 1's count requires per-field validation, Step 3's warning count requires the Go / No-Go panel)
- StepShell card-header badges (e.g. "Fetched 14:31 UTC")
- Auto-transition into the `all-done` state (requires the Go / No-Go panel, which is a separate plan). The state value is in the union and `ActionBar` renders it visually so the four-state UI matches the mockup, but `deriveActionBarState` will only return `incomplete | ready | fetched` in Phase 3.
- "Print briefing" and "Acknowledge & proceed" button behaviours (the buttons render in the `all-done` block but are inert in this phase)
- The Instructions ( ⓘ ) icon in the slim header and the Checklist button on the action bar — both wire to slide-overs in Phase 5
- WeatherInfo's inline "Last updated: X" display — leave it in place; the redundancy with ActionBar's `fetched` state subtext is acceptable and Phase 4 / 5 will revisit the WeatherInfo layout

---

## Task 1: `actionBarState` utility

**Files:**
- Create: `src/utils/actionBarState.ts`
- Create: `src/utils/actionBarState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/actionBarState.test.ts
import {
  canFetchWeather,
  deriveActionBarState,
  type ActionBarState,
} from "./actionBarState";
import type { WorksheetData } from "@/utils/types";

const empty: WorksheetData = {
  pilot: "",
  date: "",
  time: "",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)] as [
    (number | null)[],
    (number | null)[],
    (number | null)[],
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [null, null, null],
  altimeter: [null, null, null],
  altitude: [null, null, null],
  rwy: [null, null],
  weight: null,
  mtnEndorse: false,
  mtnCert: false,
};

describe("canFetchWeather", () => {
  it("returns false when nothing is filled in", () => {
    expect(canFetchWeather(empty)).toBe(false);
  });

  it("returns false when only one airport is filled", () => {
    expect(
      canFetchWeather({
        ...empty,
        airport: ["KOGD", ""],
        date: "2026-05-12",
        time: "18:00",
      })
    ).toBe(false);
  });

  it("returns false when date or time is missing", () => {
    expect(
      canFetchWeather({
        ...empty,
        airport: ["KOGD", "KLGU"],
        date: "",
        time: "18:00",
      })
    ).toBe(false);
    expect(
      canFetchWeather({
        ...empty,
        airport: ["KOGD", "KLGU"],
        date: "2026-05-12",
        time: "",
      })
    ).toBe(false);
  });

  it("returns true when both airports, date, and time are all filled in", () => {
    expect(
      canFetchWeather({
        ...empty,
        airport: ["KOGD", "KLGU"],
        date: "2026-05-12",
        time: "18:00",
      })
    ).toBe(true);
  });
});

describe("deriveActionBarState", () => {
  it("returns 'incomplete' when required fields are missing and weather not yet fetched", () => {
    const result: ActionBarState = deriveActionBarState(empty, null);
    expect(result).toBe("incomplete");
  });

  it("returns 'ready' when canFetchWeather is true but weather not yet fetched", () => {
    const state = {
      ...empty,
      airport: ["KOGD", "KLGU"] as [string, string],
      date: "2026-05-12",
      time: "18:00",
    };
    expect(deriveActionBarState(state, null)).toBe("ready");
  });

  it("returns 'fetched' when weatherLastUpdated is set, regardless of required fields", () => {
    const ts = new Date();
    expect(deriveActionBarState(empty, ts)).toBe("fetched");
    expect(
      deriveActionBarState(
        {
          ...empty,
          airport: ["KOGD", "KLGU"],
          date: "2026-05-12",
          time: "18:00",
        },
        ts
      )
    ).toBe("fetched");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/actionBarState.test.ts`
Expected: FAIL — `Cannot find module './actionBarState'`.

- [ ] **Step 3: Implement the utility**

```ts
// src/utils/actionBarState.ts
import type { WorksheetData } from "@/utils/types";

export type ActionBarState =
  | "incomplete"
  | "ready"
  | "fetched"
  | "all-done";

/**
 * Returns true when the worksheet has the minimum required fields to fetch
 * weather: both airports, date, and time. Mirrors the predicate inside
 * `WeatherDataIntegration` so the action bar and the fetch button agree on
 * when fetching is possible.
 */
export function canFetchWeather(state: WorksheetData): boolean {
  return Boolean(
    state.airport[0] && state.airport[1] && state.date && state.time
  );
}

/**
 * Derives the action bar's state from the worksheet data and the
 * weather-fetch timestamp.
 *
 * Phase 3 returns only `incomplete | ready | fetched`. The `all-done` state
 * is reserved for after the Go / No-Go panel ships; until then, fetched is
 * the terminal state.
 */
export function deriveActionBarState(
  state: WorksheetData,
  weatherLastUpdated: Date | null
): ActionBarState {
  if (weatherLastUpdated !== null) return "fetched";
  return canFetchWeather(state) ? "ready" : "incomplete";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/actionBarState.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/actionBarState.ts src/utils/actionBarState.test.ts
git commit -m "Add actionBarState derivation utility

Pure-function module that derives the action bar state
(incomplete / ready / fetched / all-done) from WorksheetData and the
weather-fetch timestamp. Phase 3 derives only incomplete / ready /
fetched; all-done is reserved for after the Go / No-Go panel ships."
```

---

## Task 2: `stepStatuses` utility

**Files:**
- Create: `src/utils/stepStatuses.ts`
- Create: `src/utils/stepStatuses.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/stepStatuses.test.ts
import { deriveStepStatuses } from "./stepStatuses";
import type { WorksheetData } from "@/utils/types";

const empty: WorksheetData = {
  pilot: "",
  date: "",
  time: "",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)] as [
    (number | null)[],
    (number | null)[],
    (number | null)[],
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [null, null, null],
  altimeter: [null, null, null],
  altitude: [null, null, null],
  rwy: [null, null],
  weight: null,
  mtnEndorse: false,
  mtnCert: false,
};

const readyForWeather: WorksheetData = {
  ...empty,
  airport: ["KOGD", "KLGU"] as [string, string],
  date: "2026-05-12",
  time: "18:00",
};

describe("deriveStepStatuses", () => {
  it("returns active / pending / pending when nothing is filled and weather not fetched", () => {
    expect(deriveStepStatuses(empty, null)).toEqual({
      sortie: "active",
      weather: "pending",
      decision: "pending",
    });
  });

  it("returns complete / active / pending when sortie is ready to fetch but weather hasn't been fetched", () => {
    expect(deriveStepStatuses(readyForWeather, null)).toEqual({
      sortie: "complete",
      weather: "active",
      decision: "pending",
    });
  });

  it("returns complete / complete / active when weather has been fetched", () => {
    expect(deriveStepStatuses(readyForWeather, new Date())).toEqual({
      sortie: "complete",
      weather: "complete",
      decision: "active",
    });
  });

  it("treats sortie as complete based on canFetchWeather, not weather-fetched", () => {
    // Edge: weather fetched but airports later cleared — sortie reflects
    // current state (incomplete), but weather/decision reflect fetched
    // history.
    const wiped = { ...readyForWeather, airport: ["", ""] as [string, string] };
    expect(deriveStepStatuses(wiped, new Date())).toEqual({
      sortie: "active",
      weather: "complete",
      decision: "active",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/stepStatuses.test.ts`
Expected: FAIL — `Cannot find module './stepStatuses'`.

- [ ] **Step 3: Implement the utility**

```ts
// src/utils/stepStatuses.ts
import type { StepStatus } from "@/components/Stepper";
import type { WorksheetData } from "@/utils/types";
import { canFetchWeather } from "@/utils/actionBarState";

export interface StepStatusesResult {
  sortie: StepStatus;
  weather: StepStatus;
  decision: StepStatus;
}

/**
 * Derives each step's status from the worksheet state.
 *
 * - Sortie: `complete` when the minimum fields to fetch weather are present;
 *   otherwise `active` (the user's current focus).
 * - Weather: `complete` when weather has been fetched at least once;
 *   otherwise `active` if sortie is complete (the user's next focus), else
 *   `pending`.
 * - Decision: `active` once weather is complete (next focus); otherwise
 *   `pending`. (`complete` and `warning` are reserved for when the Go / No-Go
 *   panel ships — those depend on verdict logic that doesn't exist yet.)
 */
export function deriveStepStatuses(
  state: WorksheetData,
  weatherLastUpdated: Date | null
): StepStatusesResult {
  const sortieReady = canFetchWeather(state);
  const weatherFetched = weatherLastUpdated !== null;

  const sortie: StepStatus = sortieReady ? "complete" : "active";
  const weather: StepStatus = weatherFetched
    ? "complete"
    : sortieReady
      ? "active"
      : "pending";
  const decision: StepStatus = weatherFetched ? "active" : "pending";

  return { sortie, weather, decision };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/stepStatuses.test.ts`
Expected: PASS — all four tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/stepStatuses.ts src/utils/stepStatuses.test.ts
git commit -m "Add stepStatuses derivation utility

Returns derived StepStatus values for each of the three steps based on
the worksheet state plus the weather-fetch timestamp. Replaces the
hardcoded active/pending/pending the Stepper has been using since
Phase 1."
```

---

## Task 3: `ActionBar` component

**Files:**
- Create: `src/components/ActionBar.tsx`
- Create: `src/components/ActionBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ActionBar.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import ActionBar from "./ActionBar";
import type { WorksheetData } from "@/utils/types";

const empty: WorksheetData = {
  pilot: "",
  date: "",
  time: "",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)] as [
    (number | null)[],
    (number | null)[],
    (number | null)[],
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [null, null, null],
  altimeter: [null, null, null],
  altitude: [null, null, null],
  rwy: [null, null],
  weight: null,
  mtnEndorse: false,
  mtnCert: false,
};

const baseProps = {
  worksheetData: empty,
  onFetch: jest.fn(),
  fetchDisabled: false,
  isFetching: false,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ActionBar — incomplete state", () => {
  it("renders the incomplete title and a disabled Fetch weather button", () => {
    render(<ActionBar {...baseProps} state="incomplete" fetchDisabled={true} />);
    expect(
      screen.getByText(/Add departure airport, arrival airport, date, and time/i)
    ).toBeInTheDocument();
    const fetchBtn = screen.getByRole("button", { name: /Fetch weather/i });
    expect(fetchBtn).toBeDisabled();
  });

  it("disabled Fetch weather click does not call onFetch", () => {
    render(<ActionBar {...baseProps} state="incomplete" fetchDisabled={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));
    expect(baseProps.onFetch).not.toHaveBeenCalled();
  });
});

describe("ActionBar — ready state", () => {
  const ready = {
    ...baseProps,
    state: "ready" as const,
    worksheetData: {
      ...empty,
      airport: ["KOGD", "KLGU"] as [string, string],
      date: "2026-05-12",
      time: "18:00",
    },
  };

  it("renders the ready title and an enabled Fetch weather button", () => {
    render(<ActionBar {...ready} />);
    expect(screen.getByText(/Sortie details ready/i)).toBeInTheDocument();
    const fetchBtn = screen.getByRole("button", { name: /Fetch weather/i });
    expect(fetchBtn).not.toBeDisabled();
  });

  it("subtext summarises departure / arrival / time", () => {
    render(<ActionBar {...ready} />);
    expect(screen.getByText(/KOGD/)).toBeInTheDocument();
    expect(screen.getByText(/KLGU/)).toBeInTheDocument();
    expect(screen.getByText(/18:00z/)).toBeInTheDocument();
  });

  it("clicking Fetch weather calls onFetch", () => {
    render(<ActionBar {...ready} />);
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));
    expect(ready.onFetch).toHaveBeenCalledTimes(1);
  });
});

describe("ActionBar — fetched state", () => {
  const fetched = {
    ...baseProps,
    state: "fetched" as const,
    weatherLastUpdated: new Date("2026-05-12T14:31:00Z"),
  };

  it("renders the fetched title with the fetch timestamp", () => {
    render(<ActionBar {...fetched} />);
    expect(screen.getByText(/Weather fetched/i)).toBeInTheDocument();
    expect(screen.getByText(/14:31z/)).toBeInTheDocument();
  });

  it("renders a Re-fetch button that calls onFetch", () => {
    render(<ActionBar {...fetched} />);
    const refetch = screen.getByRole("button", { name: /Re-fetch/i });
    fireEvent.click(refetch);
    expect(fetched.onFetch).toHaveBeenCalledTimes(1);
  });

  it("renders a Review decision link pointing to #step-decision", () => {
    render(<ActionBar {...fetched} />);
    const link = screen.getByRole("link", { name: /Review decision/i });
    expect(link).toHaveAttribute("href", "#step-decision");
  });
});

describe("ActionBar — all-done state", () => {
  it("renders the all-done title and the Print + Acknowledge buttons", () => {
    render(<ActionBar {...baseProps} state="all-done" />);
    expect(screen.getByText(/All checks complete/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print briefing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acknowledge/i })).toBeInTheDocument();
  });
});

describe("ActionBar — isFetching", () => {
  it("shows a Loading… label while fetching", () => {
    render(
      <ActionBar
        {...baseProps}
        state="ready"
        worksheetData={{
          ...empty,
          airport: ["KOGD", "KLGU"],
          date: "2026-05-12",
          time: "18:00",
        }}
        isFetching={true}
      />
    );
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/ActionBar.test.tsx`
Expected: FAIL — `Cannot find module './ActionBar'`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/ActionBar.tsx
"use client";

import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CloudArrowDownIcon,
  ExclamationCircleIcon,
  PrinterIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import type { ActionBarState } from "@/utils/actionBarState";
import type { WorksheetData } from "@/utils/types";

interface ActionBarProps {
  state: ActionBarState;
  worksheetData: WorksheetData;
  weatherLastUpdated?: Date;
  onFetch: () => void;
  fetchDisabled: boolean;
  isFetching: boolean;
}

const formatHhMmZ = (time: string): string =>
  // time is "HH:MM" from the form; mockup renders it as "1800z"
  time ? `${time.replace(":", "").padStart(4, "0")}z` : "—";

const formatClockUtc = (d: Date): string => {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}z`;
};

export default function ActionBar({
  state,
  worksheetData,
  weatherLastUpdated,
  onFetch,
  fetchDisabled,
  isFetching,
}: ActionBarProps) {
  return (
    <div className="sticky top-[44px] z-10 border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_8px_-6px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-2.5 md:px-6">
        {state === "incomplete" && (
          <>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <ExclamationCircleIcon className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Add departure airport, arrival airport, date, and time to fetch weather
                </div>
              </div>
            </div>
            <FetchButton onClick={onFetch} disabled={true} isLoading={false} />
          </>
        )}

        {state === "ready" && (
          <>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Sortie details ready
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {worksheetData.airport[0] || "—"} → {worksheetData.airport[1] || "—"} · departing {formatHhMmZ(worksheetData.time)} · ready to fetch weather
                </div>
              </div>
            </div>
            <FetchButton onClick={onFetch} disabled={fetchDisabled} isLoading={isFetching} />
          </>
        )}

        {state === "fetched" && (
          <>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Weather fetched
                  {weatherLastUpdated && (
                    <>
                      {" "}
                      · <span className="font-mono text-slate-700 dark:text-slate-300">{formatClockUtc(weatherLastUpdated)}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Review the weather below, then proceed to the decision.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
            </div>
          </>
        )}

        {state === "all-done" && (
          <>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <StarIcon className="h-5 w-5 text-slate-900 shrink-0 dark:text-slate-100" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  All checks complete — verdict ready for review
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <PrinterIcon className="h-3.5 w-3.5" />
                Print briefing
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Acknowledge &amp; proceed
              </button>
            </div>
          </>
        )}
      </div>
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
```

`sticky top-[44px]` parks the action bar just under the sticky stepper. The `z-10` (vs the Stepper's `z-20`) keeps it below the stepper when scrolled headers stack. `data-active`-style attribute APIs aren't used here because the four states are mutually exclusive — render only the right branch.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/ActionBar.test.tsx`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionBar.tsx src/components/ActionBar.test.tsx
git commit -m "Add ActionBar component with four state variants

Sticky bar pinned under the Stepper that renders state-appropriate
content for incomplete / ready / fetched / all-done. The Fetch weather
button lives here in the ready and fetched states (as Re-fetch);
all-done is rendered but not reachable until the Go / No-Go panel
ships."
```

---

## Task 4: Slim `WorksheetHeader`

**Files:**
- Modify: `src/components/WorksheetHeader.tsx`
- Modify: `src/components/WorksheetHeader.test.tsx`

The new header drops the embedded `<WeatherDataIntegration>` block, the four weather-related props (`worksheetData`, `onWeatherDataUpdate`, `onWeatherTimestampUpdate`, `weatherLastUpdated`), and the "Weather updated at X" tail display. The layout collapses to a single tight row with title + clock + Reset / Copy link / °C–°F.

- [ ] **Step 1: Update WorksheetHeader.test.tsx to drop the obsolete props**

Open `src/components/WorksheetHeader.test.tsx` and replace the `defaultProps` block (lines 9–17) with:

```tsx
const defaultProps = {
  onReset: jest.fn(),
  onShare: jest.fn(),
  useFahrenheit: false,
  onToggleTempUnit: jest.fn(),
};
```

Then also remove the `jest.mock("./WeatherDataIntegration", ...)` block at the top (lines 4–7) — `WorksheetHeader` no longer imports `WeatherDataIntegration`. The file's first lines should become:

```tsx
import { render, screen } from "../test-utils/test-utils";
import WorksheetHeader from "./WorksheetHeader";

const defaultProps = {
  onReset: jest.fn(),
  onShare: jest.fn(),
  useFahrenheit: false,
  onToggleTempUnit: jest.fn(),
};

describe("WorksheetHeader", () => {
  // existing tests below
```

The two existing tests (`'Current Time' instead of 'Current UTC'` and `max-w-5xl inner container`) stay as-is and should still pass after the source change.

Add this new test inside the existing `describe("WorksheetHeader", ...)` block, after the two existing tests:

```tsx
  it("does not render a Fetch Weather button (moved to the action bar)", () => {
    render(<WorksheetHeader {...defaultProps} />);
    expect(
      screen.queryByRole("button", { name: /Fetch Weather/i })
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/WorksheetHeader.test.tsx`
Expected: at minimum, the new "does not render a Fetch Weather button" test fails because the current header DOES render that button. Type errors on the obsolete props will appear but won't block test execution.

- [ ] **Step 3: Rewrite WorksheetHeader.tsx**

Replace the entire contents of `src/components/WorksheetHeader.tsx` with:

```tsx
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
```

Notes:
- The component no longer imports `WeatherDataIntegration`, `ArrowPathIcon`, or `CloudArrowDownIcon` — all three are unused after this slim-down.
- The clock now renders inline next to the buttons (hidden on mobile via `hidden … md:flex`) instead of taking its own block. The mockup shows the clock as a small num-mono string near the title; this implementation keeps the existing 3-line `Current Time / 14:32:08 UTC / Sun 12 May 2026` format but at a smaller size, which preserves the existing tests' "Current Time" assertion.
- All buttons use the slim `px-2.5 py-1 text-xs border-only` style from the mockup.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/WorksheetHeader.test.tsx`
Expected: PASS — all 3 tests (2 existing + 1 new) green.

- [ ] **Step 5: Commit**

```bash
git add src/components/WorksheetHeader.tsx src/components/WorksheetHeader.test.tsx
git commit -m "Slim WorksheetHeader to utility chrome only

Drops the embedded WeatherDataIntegration block, the four weather
props (worksheetData / onWeatherDataUpdate / onWeatherTimestampUpdate
/ weatherLastUpdated), and the 'Weather updated at X' tail display.
Tightens the layout to a single row with title + UTC clock + Reset /
Copy link / °C-°F using slim border-only buttons. The Fetch Weather
button is added back in the next task via the new ActionBar."
```

---

## Task 5: Wire ActionBar + derived statuses in AppContainer

**Files:**
- Modify: `src/components/AppContainer.tsx`
- Modify: `src/components/AppContainer.test.tsx`

This is the integration task. `WeatherDataIntegration` moves from inside `WorksheetHeader` to AppContainer top level, the static `WORKSHEET_STEPS` is replaced by a `useMemo` over derived statuses, the Decision `<StepShell>` gets a derived status, and the `<WorksheetHeader>` call sheds its four obsolete props.

- [ ] **Step 1: Update AppContainer.test.tsx**

Open `src/components/AppContainer.test.tsx` and add this assertion inside the existing top-level `describe`:

```tsx
  it("renders the sticky ActionBar region", () => {
    render(<AppContainer />);
    // ActionBar always renders a Fetch weather button (disabled in incomplete state)
    expect(
      screen.getByRole("button", { name: /Fetch weather/i })
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/AppContainer.test.tsx`
Expected: FAIL — no Fetch-weather button is rendered yet (the slim header in Task 4 removed it; ActionBar isn't wired yet).

- [ ] **Step 3: Update AppContainer.tsx imports**

In `src/components/AppContainer.tsx`, update the imports near the top:

Before (current imports — verify exact lines around 3–13 before editing):

```tsx
import { useState } from "react";
import AppInputs from "@/components/AppInputs";
import Calculations from "@/components/Calculations";
import InstructionsAndNotes from "@/components/InstructionsAndNotes";
import MountainFlyingChecklist from "@/components/MountainFlyingChecklist";
import Stepper, { type StepperStep } from "@/components/Stepper";
import StepShell from "@/components/StepShell";
import WorksheetHeader from "@/components/WorksheetHeader";
import { useUrlState } from "@/utils/useUrlState";
import { useTempUnit } from "@/utils/useTempUnit";
import type { WorksheetData } from "@/utils/types";
```

After:

```tsx
import { useMemo, useState } from "react";
import ActionBar from "@/components/ActionBar";
import AppInputs from "@/components/AppInputs";
import Calculations from "@/components/Calculations";
import InstructionsAndNotes from "@/components/InstructionsAndNotes";
import MountainFlyingChecklist from "@/components/MountainFlyingChecklist";
import Stepper, { type StepperStep } from "@/components/Stepper";
import StepShell from "@/components/StepShell";
import WeatherDataIntegration from "@/components/WeatherDataIntegration";
import WorksheetHeader from "@/components/WorksheetHeader";
import { deriveActionBarState } from "@/utils/actionBarState";
import { deriveStepStatuses } from "@/utils/stepStatuses";
import { useTempUnit } from "@/utils/useTempUnit";
import { useUrlState } from "@/utils/useUrlState";
import type { WorksheetData } from "@/utils/types";
```

- [ ] **Step 4: Remove the static `WORKSHEET_STEPS` constant**

Delete the existing `const WORKSHEET_STEPS: StepperStep[] = [ … ];` block (currently around lines 15–19). It is replaced by a `useMemo` inside the component body in Step 5.

- [ ] **Step 5: Add the derived steps `useMemo` inside the component**

Inside `AppContainer()`, immediately after the line `const [weatherLastUpdated, setWeatherLastUpdated] = useState<Date | null>(null);`, add:

```tsx
  const stepStatuses = useMemo(
    () => deriveStepStatuses(state, weatherLastUpdated),
    [state, weatherLastUpdated]
  );

  const actionBarState = useMemo(
    () => deriveActionBarState(state, weatherLastUpdated),
    [state, weatherLastUpdated]
  );

  const steps = useMemo<StepperStep[]>(
    () => [
      { id: "step-sortie", number: 1, label: "Sortie Details", status: stepStatuses.sortie },
      { id: "step-weather", number: 2, label: "Weather", status: stepStatuses.weather },
      { id: "step-decision", number: 3, label: "Decision", status: stepStatuses.decision },
    ],
    [stepStatuses]
  );
```

- [ ] **Step 6: Update the WorksheetHeader call to drop obsolete props**

In the JSX return, replace the current `<WorksheetHeader …/>` block (the call inside the top-level `<div>`) with the slimmed-down call:

```tsx
      <WorksheetHeader
        onReset={handleReset}
        onShare={handleShare}
        useFahrenheit={useFahrenheit}
        onToggleTempUnit={toggleTempUnit}
      />
```

(Removes `worksheetData`, `onWeatherDataUpdate`, `onWeatherTimestampUpdate`, `weatherLastUpdated`.)

- [ ] **Step 7: Replace the static `steps={WORKSHEET_STEPS}` with the derived `steps`**

The existing `<Stepper steps={WORKSHEET_STEPS} />` becomes:

```tsx
      <Stepper steps={steps} />
```

- [ ] **Step 8: Mount `<WeatherDataIntegration>` with `<ActionBar>` as the rendered button**

Insert this block immediately after `<Stepper steps={steps} />` and before `<main …>`:

```tsx
      <WeatherDataIntegration
        worksheetData={state}
        onDataUpdate={handleWeatherDataUpdate}
        onTimestampUpdate={handleWeatherTimestampUpdate}
        hideBox
        renderButton={({ onClick, disabled, isLoading }) => (
          <ActionBar
            state={actionBarState}
            worksheetData={state}
            weatherLastUpdated={weatherLastUpdated ?? undefined}
            onFetch={onClick}
            fetchDisabled={disabled}
            isFetching={isLoading}
          />
        )}
      />
```

- [ ] **Step 9: Update the Decision `<StepShell>` to use the derived status**

Find the Decision `<StepShell>` block (currently passes `status="pending"`) and change `status="pending"` to `status={stepStatuses.decision}`. The full block becomes:

```tsx
          <StepShell
            id="step-decision"
            number={3}
            status={stepStatuses.decision}
            title="Decision"
            subtitle="Go / no-go summary, with detailed calculations below"
            showSpine={false}
          >
            <Calculations state={state} />
          </StepShell>
```

- [ ] **Step 10: Run the AppContainer test**

Run: `npx jest src/components/AppContainer.test.tsx`
Expected: PASS — the new "renders the sticky ActionBar region" test now finds the Fetch weather button. The four existing tests (renders without crashing / Stepper / step-decision anchor / Instructions-after-Checklist ordering) continue to pass.

- [ ] **Step 11: Run the full test suite**

Run: `npx jest`
Expected: PASS across all suites. No new TypeScript errors introduced in the files this phase touches.

- [ ] **Step 12: Visual smoke test**

You'll do this manually after the commit (the controller verifies). Cycle through the three reachable action-bar states by:

1. Load the page with all fields empty → action bar shows the **incomplete** state with the disabled Fetch weather button. The Sortie pill in the Stepper is `active` (slate-900); Weather and Decision are `pending` (slate-300).
2. Fill in both airports + date + time → action bar morphs to the **ready** state, the Fetch weather button turns emerald and is clickable, and the subtext shows `{dep} → {arr} · departing 1800z`. The Sortie pill turns `complete` (emerald) and Weather becomes `active`.
3. Click Fetch weather → during the fetch the button shows the spinner + "Loading…". After it resolves, the bar morphs to the **fetched** state with the timestamp + `Re-fetch` + `Review decision` buttons. Weather pill is `complete` and Decision pill is `active`.

The slim header should show: title left, clock right of buttons, then `Reset` / `Copy link` / `°C|°F`. No Fetch weather button in the header.

- [ ] **Step 13: Commit**

```bash
git add src/components/AppContainer.tsx src/components/AppContainer.test.tsx
git commit -m "Wire ActionBar + derived step statuses in AppContainer

- Replaces the hardcoded WORKSHEET_STEPS constant with a useMemo
  driven by deriveStepStatuses(state, weatherLastUpdated).
- Replaces the hardcoded status='pending' on the Decision StepShell
  with the derived status.
- Moves <WeatherDataIntegration hideBox renderButton={…}> out of
  WorksheetHeader and into the top level of AppContainer; the
  renderButton callback returns <ActionBar /> so the existing fetch
  click / disabled / isLoading wiring stays unchanged.
- Drops worksheetData / onWeatherDataUpdate / onWeatherTimestampUpdate
  / weatherLastUpdated from the WorksheetHeader call now that those
  responsibilities live in AppContainer."
```

---

## Verification — full phase

- [ ] All five task commits land cleanly:
  ```bash
  git log --oneline -5
  ```

- [ ] Jest is green:
  ```bash
  npx jest
  ```

- [ ] TypeScript introduces no new errors in files this phase touches:
  ```bash
  npx tsc --noEmit 2>&1 | grep -E "actionBarState|stepStatuses|ActionBar\.tsx|WorksheetHeader\.tsx|AppContainer\.tsx"
  ```
  Expected: empty.

- [ ] Visual checklist (in a browser at `localhost:3000`):
  - Slim header: title left, UTC clock + slim border-only buttons (`Reset`, `Copy link`, `°C|°F`) right. No Fetch weather button in the header.
  - Sticky 3-pill Stepper below the header.
  - Sticky ActionBar below the stepper, morphing through `incomplete → ready → fetched` as the user fills airports/date/time and then clicks Fetch.
  - Stepper pill colors update with state: empty page → `1 active`, `2 pending`, `3 pending`. After airports/date/time → `1 complete`, `2 active`, `3 pending`. After fetch → `1 complete`, `2 complete`, `3 active`.
  - Decision StepShell's numbered circle reflects the same status transitions (slate-300 → slate-300 → slate-900 active).
  - No browser console errors.

---

## Out of scope for Phase 3 (do **not** add here)

- Stepper badges with counts (`8 of 11`, `●`, `⚠ 1`) — defer; the badge prop is wired but values stay undefined
- StepShell card-header badges (`Fetched 14:31 UTC`, `1 warning`) — defer
- Auto-derivation of the `all-done` state — requires the Go / No-Go panel, separate plan
- "Print briefing" and "Acknowledge & proceed" button behaviours — buttons render but are inert
- Instructions ( ⓘ ) icon in the slim header and Checklist button on the action bar — Phase 5 (slide-overs)
- Weather and Aircraft Performance body reorganization (Aloft / At airports / Advisories) — Phase 4
- Airport-card layout, runway dropdown — Phase 4
- "For reference only" disclaimer in Decision — Phase 5
- `@media print` stylesheet — Phase 5
