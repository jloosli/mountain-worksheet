# Issue #98 — Calculation Recompute Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the effect-driven derived-state chain in `<Calculations>` / `<Altitudes>` / `<ClimbPerformance>` so calculations always reflect the current form state, and patch the in-place array mutation in `mergeWeatherData` that was masking changes from React's reference-equality checks.

**Architecture:** Introduce a small pure helper module (`src/utils/derived.ts`) that wraps existing calculation utilities. `<Calculations>` becomes a thin orchestrator: it calls these helpers during render and passes results to dumb display children. No `useState`/`useEffect` for derived data; no child→parent callback for PAs. The weather data mapper is also fixed to return new arrays instead of mutating existing ones (defense in depth).

**Tech Stack:** TypeScript, React 19, Next.js App Router, Jest + React Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-10-issue-98-calculation-recompute-design.md`

---

## File map

- **Create:** `src/utils/derived.ts` — pure helpers `computePressureColumns` and `computeTOLDViewModel`
- **Create:** `src/utils/__tests__/derived.test.ts` — unit tests for above
- **Modify:** `src/components/ClimbPerformance.tsx` — compute `aircraft`/`ratesOfClimb`/`percentMGW` during render; remove all `useState`/`useEffect`
- **Modify:** `src/components/Altitudes.tsx` — accept `PAs`/`DAs` as props; remove `useState`, `useEffect`, `onPressureUpdate`
- **Create:** `src/components/Altitudes.test.tsx` — new file (doesn't exist today)
- **Modify:** `src/components/Calculations.tsx` — drop derived `useState`/`useCallback`/`useEffect`; orchestrate via new pure helpers
- **Modify:** `src/components/TakeoffPerformance.tsx` — trim `toldData` prop type (drop `isCalculating`, `retryCalculation`, `clearErrors`); simplify cell helpers
- **Modify:** `src/components/Calculations.test.tsx` — add regression test asserting an operating-temp change immediately updates operating-column output
- **Modify:** `src/utils/weatherDataMapper.ts` — make `mapAirportSpecificWeatherData`, `mapWeatherDataToWorksheet`, and `mergeWeatherData` immutable for `temp`/`altimeter`/`altitude` arrays
- **Modify:** `src/utils/weatherDataMapper.test.ts` — regression test asserting `mergeWeatherData` does not mutate input arrays

## Task ordering rationale

Tasks 1 and 2 build pure helpers in isolation. Task 3 refactors `<ClimbPerformance>` first because it already accepts `PAs` as a prop — removing its internal `useState`/`useEffect` doesn't affect the legacy chain still wired through `<Calculations>` and `<Altitudes>`. Task 4 then performs an **atomic** swap: `<Altitudes>` becomes pure, `<Calculations>` is rewired to use the new helpers, and `<TakeoffPerformance>`'s prop shape is trimmed — all in one commit, because the legacy `onPressureUpdate` callback wiring spans those three files and partial changes leave the build red. Tasks 5–7 add regression tests and the defensive immutability fix. Task 8 is final validation.

---

## Task 1: Pure helper — `computePressureColumns`

**Files:**
- Create: `src/utils/derived.ts`
- Create: `src/utils/__tests__/derived.test.ts`

- [ ] **Step 1.1: Write failing tests**

Create `src/utils/__tests__/derived.test.ts`:

```ts
import { computePressureColumns } from "../derived";

describe("computePressureColumns", () => {
  it("returns nulls for all columns when inputs are missing", () => {
    const { PAs, DAs } = computePressureColumns(
      [null, null, null],
      [null, null, null],
      [null, null, null]
    );
    expect(PAs).toEqual([null, null, null]);
    expect(DAs).toEqual([null, null, null]);
  });

  it("returns nulls when only altitude is provided (missing altimeter or temp)", () => {
    const { PAs, DAs } = computePressureColumns(
      [5000, null, null],
      [null, null, null],
      [null, null, null]
    );
    expect(PAs[0]).toBeNull();
    expect(DAs[0]).toBeNull();
  });

  it("computes PA = altitude when altimeter is standard 29.92", () => {
    const { PAs } = computePressureColumns(
      [5000, null, null],
      [29.92, null, null],
      [15, null, null]
    );
    expect(PAs[0]).toBeCloseTo(5000, 5);
  });

  it("computes PA = altitude + 1000 when altimeter is 28.92", () => {
    const { PAs } = computePressureColumns(
      [5000, null, null],
      [28.92, null, null],
      [15, null, null]
    );
    expect(PAs[0]).toBeCloseTo(6000, 5);
  });

  it("computes DA = PA at ISA temperature (PA = 0, temp = 15°C)", () => {
    const { DAs } = computePressureColumns(
      [0, null, null],
      [29.92, null, null],
      [15, null, null]
    );
    expect(DAs[0]).toBeCloseTo(0, 5);
  });

  it("treats the -1 sentinel as missing for altimeter and temperature", () => {
    const { PAs, DAs } = computePressureColumns(
      [5000, 10000, 5000],
      [-1, 29.92, 29.92],
      [15, -1, 15]
    );
    expect(PAs[0]).toBeNull(); // altimeter -1 → missing
    expect(DAs[0]).toBeNull();
    expect(PAs[1]).toBeNull(); // temp -1 → missing (matches legacy Altitudes.tsx behavior)
    expect(DAs[1]).toBeNull();
    expect(PAs[2]).toBeCloseTo(5000, 5);
  });

  it("handles all three columns independently", () => {
    const { PAs, DAs } = computePressureColumns(
      [1000, 8000, 2000],
      [29.92, 29.92, 29.92],
      [15, 0, 10]
    );
    expect(PAs[0]).toBeCloseTo(1000, 5);
    expect(PAs[1]).toBeCloseTo(8000, 5);
    expect(PAs[2]).toBeCloseTo(2000, 5);
    expect(DAs[0]).not.toBeNull();
    expect(DAs[1]).not.toBeNull();
    expect(DAs[2]).not.toBeNull();
  });
});
```

- [ ] **Step 1.2: Run to confirm failure**

```
npx jest src/utils/__tests__/derived.test.ts
```

Expected: FAIL — `Cannot find module '../derived'`.

- [ ] **Step 1.3: Implement `derived.ts` (minimum to pass)**

Create `src/utils/derived.ts`:

```ts
import {
  altitudeToPressureAltitude,
  pressureAltitudeToDensityAltitude,
} from "./formulas";

type Triple = [number | null, number | null, number | null];

function isReal(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && v !== -1;
}

export function computePressureColumns(
  altitudes: Triple,
  altimeters: Triple,
  temperatures: Triple,
): { PAs: Triple; DAs: Triple } {
  const PAs: Triple = [null, null, null];
  const DAs: Triple = [null, null, null];
  for (let i = 0; i < 3; i++) {
    const alt = altitudes[i];
    const altim = altimeters[i];
    const temp = temperatures[i];
    if (isReal(alt) && isReal(altim) && isReal(temp)) {
      const pa = altitudeToPressureAltitude(alt, altim);
      PAs[i] = pa;
      DAs[i] = pressureAltitudeToDensityAltitude(pa, temp);
    }
  }
  return { PAs, DAs };
}
```

- [ ] **Step 1.4: Run tests, confirm pass**

```
npx jest src/utils/__tests__/derived.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 1.5: Commit**

```
git add src/utils/derived.ts src/utils/__tests__/derived.test.ts
git commit -m "$(cat <<'EOF'
Add pure computePressureColumns helper for issue #98 refactor

Wraps altitudeToPressureAltitude/pressureAltitudeToDensityAltitude into
a single triple-column derivation. Will replace the useState/useEffect
inside <Altitudes> and the implicit PA propagation up to <Calculations>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pure helper — `computeTOLDViewModel`

**Files:**
- Modify: `src/utils/derived.ts`
- Modify: `src/utils/__tests__/derived.test.ts`

The TOLD view model replicates the shape `<TakeoffPerformance>` currently consumes, minus the dead fields (`isCalculating`, `retryCalculation`, `clearErrors`).

- [ ] **Step 2.1: Append failing tests**

Append to `src/utils/__tests__/derived.test.ts`:

```ts
import { computeTOLDViewModel } from "../derived";
import type { WorksheetData } from "../types";

const baseState = (): WorksheetData => ({
  pilot: "",
  date: "2026-01-01",
  time: "10:00",
  duration: null,
  acType: "C182T",
  tailN: "",
  airport: ["KABC", "KXYZ"],
  route: "",
  position: [null, null],
  wind: [
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [20, 10, 20],
  altimeter: [29.92, 29.92, 29.92],
  altitude: [1000, 8000, 1000],
  rwy: [3000, 3000],
  weight: 2700,
  mtnEndorse: false,
  mtnCert: false,
});

describe("computeTOLDViewModel", () => {
  it("returns status 'invalid_inputs' and null results when acType is empty", () => {
    const vm = computeTOLDViewModel(
      { ...baseState(), acType: "" },
      [1000, 8000, 1000]
    );
    expect(vm.results).toBeNull();
    expect(vm.status).toBe("invalid_inputs");
    expect(vm.errors).toEqual([]);
  });

  it("returns status 'invalid_inputs' and null results when weight is null", () => {
    const vm = computeTOLDViewModel(
      { ...baseState(), weight: null },
      [1000, 8000, 1000]
    );
    expect(vm.results).toBeNull();
    expect(vm.status).toBe("invalid_inputs");
  });

  it("returns null results when neither departure nor arrival has PA+temp", () => {
    const vm = computeTOLDViewModel(baseState(), [null, null, null]);
    expect(vm.results).toBeNull();
    expect(vm.status).toBe("invalid_inputs");
  });

  it("returns success with a populated results shape when inputs are valid", () => {
    const vm = computeTOLDViewModel(baseState(), [1000, 8000, 1000]);
    expect(vm.status).toBe("success");
    expect(vm.results).not.toBeNull();
    expect(vm.results!.takeoffGroundRoll).toHaveProperty("departure");
    expect(vm.results!.takeoffGroundRoll).toHaveProperty("arrival");
    expect(vm.results!.takeoff50ftObstacle).toHaveProperty("departure");
    expect(vm.results!.landingGroundRoll).toHaveProperty("departure");
    expect(vm.results!.landing50ftObstacle).toHaveProperty("departure");
    expect(vm.results!.availableRunwayRemainingTakeoffGroundRoll).toHaveProperty("departure");
    expect(vm.results!.availableRunwayRemainingTakeoff50ft).toHaveProperty("departure");
  });

  it("does not expose retry/clear/isCalculating fields", () => {
    const vm = computeTOLDViewModel(baseState(), [1000, 8000, 1000]);
    expect(vm).not.toHaveProperty("isCalculating");
    expect(vm).not.toHaveProperty("retryCalculation");
    expect(vm).not.toHaveProperty("clearErrors");
  });

  it("populates errorSummary as null when there are no errors", () => {
    const vm = computeTOLDViewModel(baseState(), [1000, 8000, 1000]);
    expect(vm.errorSummary).toBeNull();
  });

  it("populates errorSummary when calculation surfaces errors", () => {
    // Weight below empty weight triggers validation error per validateAircraftWeight
    const vm = computeTOLDViewModel(
      { ...baseState(), weight: 100 },
      [1000, 8000, 1000]
    );
    expect(vm.errors.length).toBeGreaterThan(0);
    expect(vm.errorSummary).not.toBeNull();
    expect(vm.errorSummary!.count).toBe(vm.errors.length);
  });
});
```

- [ ] **Step 2.2: Run to confirm failure**

```
npx jest src/utils/__tests__/derived.test.ts
```

Expected: FAIL — `computeTOLDViewModel is not a function`.

- [ ] **Step 2.3: Implement `computeTOLDViewModel`**

Append to `src/utils/derived.ts`:

```ts
import type { WorksheetData, TOLDError } from "./types";
import { calculateTOLDForMultipleAirports } from "./toldCalculations";

export interface TOLDViewModel {
  results: {
    takeoffGroundRoll: { departure: number | null; arrival: number | null };
    takeoff50ftObstacle: { departure: number | null; arrival: number | null };
    landingGroundRoll: { departure: number | null; arrival: number | null };
    landing50ftObstacle: { departure: number | null; arrival: number | null };
    availableRunwayRemainingTakeoffGroundRoll: {
      departure: number | null;
      arrival: number | null;
    };
    availableRunwayRemainingTakeoff50ft: {
      departure: number | null;
      arrival: number | null;
    };
  } | null;
  status: "success" | "invalid_inputs" | "error" | "idle";
  errors: TOLDError[];
  warnings: TOLDError[];
  extrapolationWarnings: TOLDError[];
  errorSummary:
    | { count: number; critical: number; warnings: number; messages: string[] }
    | null;
  warningSummary:
    | {
        count: number;
        validation: number;
        extrapolation: number;
        messages: string[];
      }
    | null;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export function computeTOLDViewModel(
  state: WorksheetData,
  PAs: Triple,
): TOLDViewModel {
  const empty: TOLDViewModel = {
    results: null,
    status: "invalid_inputs",
    errors: [],
    warnings: [],
    extrapolationWarnings: [],
    errorSummary: null,
    warningSummary: null,
    hasErrors: false,
    hasWarnings: false,
  };

  if (!state.acType || state.weight === null || state.weight === undefined) {
    return empty;
  }

  const deptPA = PAs[0];
  const arrPA = PAs[2];
  const deptValid = deptPA !== null && state.temp[0] !== null && state.temp[0] !== undefined;
  const arrValid = arrPA !== null && state.temp[2] !== null && state.temp[2] !== undefined;
  if (!deptValid && !arrValid) {
    return empty;
  }

  let result;
  try {
    result = calculateTOLDForMultipleAirports(state.acType, {
      weight: state.weight,
      pressureAltitudes: [deptPA, arrPA] as [number | null, number | null],
      temperatures: [state.temp[0] ?? null, state.temp[2] ?? null] as [
        number | null,
        number | null,
      ],
      runwayLengths: state.rwy,
    });
  } catch (error) {
    return {
      ...empty,
      status: "error",
      errors: [
        {
          type: "calculation_failed",
          message: `TOLD calculation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          severity: "error",
        },
      ],
      hasErrors: true,
    };
  }

  const errors = result.success ? result.validationErrors : result.errors;
  const warnings = result.validationWarnings;
  const extrap = result.extrapolationWarnings;
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0 || extrap.length > 0;

  return {
    results: result.success && result.results ? result.results : null,
    status: hasErrors ? "error" : result.success ? "success" : "invalid_inputs",
    errors,
    warnings,
    extrapolationWarnings: extrap,
    errorSummary:
      errors.length === 0
        ? null
        : {
            count: errors.length,
            critical: errors.filter((e) => e.severity === "error").length,
            warnings: errors.filter((e) => e.severity === "warning").length,
            messages: errors.map((e) => e.message),
          },
    warningSummary:
      warnings.length + extrap.length === 0
        ? null
        : {
            count: warnings.length + extrap.length,
            validation: warnings.length,
            extrapolation: extrap.length,
            messages: [...warnings, ...extrap].map((w) => w.message),
          },
    hasErrors,
    hasWarnings,
  };
}
```

- [ ] **Step 2.4: Run, confirm pass**

```
npx jest src/utils/__tests__/derived.test.ts
```

Expected: PASS (14 tests total).

- [ ] **Step 2.5: Commit**

```
git add src/utils/derived.ts src/utils/__tests__/derived.test.ts
git commit -m "$(cat <<'EOF'
Add computeTOLDViewModel pure helper for issue #98 refactor

Wraps calculateTOLDForMultipleAirports and returns the view-model shape
TakeoffPerformance consumes, minus the dead retry/clear/isCalculating
fields that are no longer meaningful once results are derived from state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Compute climb data during render in `<ClimbPerformance>`

`<ClimbPerformance>` already accepts `PAs` and `OATs` as props. Removing its internal `useState`/`useEffect` is safe in isolation — it doesn't disturb the legacy `<Altitudes>` → `<Calculations>` chain that Task 4 will replace.

**Files:**
- Modify: `src/components/ClimbPerformance.tsx`

- [ ] **Step 3.1: Rewrite the component to drop the three useState/useEffect pairs**

Replace the contents of `src/components/ClimbPerformance.tsx` with the version below. The helper functions defined below the effects in the original (`actROC`, `Vy`, `Va`, `Vra`, `Vx`, `serviceCeiling`, `getPercentageStyle`) and the entire JSX `return (...)` block stay unchanged. Only the top stanza changes.

New top of file (replacing everything from `import { useEffect, useState } from "react";` through the closing brace of the third `useEffect`):

```tsx
import aircraftData from "@/data/aircraft.json";
import {
  bilinearInterpolate,
  bilinearInterpolateFlexible,
  findInverseXgivenYandZ,
  FlexibleInterpolationTable,
} from "@/utils/interpolation";
import {
  calculateVra,
  calculateVx,
  pressureAltitudeToDensityAltitude,
} from "@/utils/formulas";
import { Aircraft } from "@/utils/types";

interface ClimbPerformanceProps {
  aircraftModel?: string;
  weight?: number | null;
  OATs?: [number | null, number | null, number | null];
  PAs?: [number | null, number | null, number | null];
  altimeters?: [number | null, number | null, number | null];
}

export default function ClimbPerformance({
  aircraftModel,
  weight,
  OATs,
  PAs,
  altimeters,
}: ClimbPerformanceProps) {
  if (!aircraftModel) return null;

  const aircraft: Aircraft | null =
    (aircraftData.find((a) => a.id === aircraftModel) as Aircraft | undefined) ?? null;

  const ratesOfClimb: [number | null, number | null, number | null] = [null, null, null];
  if (aircraft) {
    const climbTable: FlexibleInterpolationTable = aircraft.climbPerformance;
    const options = { xAxisName: "pressureAltitudes", yAxisName: "temperatures" };
    for (let i = 0; i < 3; i++) {
      const pa = PAs?.[i];
      const oat = OATs?.[i];
      if (pa != null && oat != null) {
        try {
          ratesOfClimb[i] = Math.round(
            bilinearInterpolateFlexible(climbTable, pa, oat, options)
          );
        } catch {
          ratesOfClimb[i] = null;
        }
      }
    }
  }

  const percentMGW: number | null =
    weight && aircraft?.maxGrossWeight
      ? Math.round((weight / aircraft.maxGrossWeight) * 100)
      : null;
```

Leave the rest of the file (helper functions and the JSX return) unchanged.

- [ ] **Step 3.2: Run climb tests**

```
npx jest src/components/ClimbPerformance.test.tsx
```

Expected: PASS (all existing tests).

- [ ] **Step 3.3: Run the whole suite**

```
npm test -- --watchAll=false
```

Expected: PASS.

- [ ] **Step 3.4: Commit**

```
git add src/components/ClimbPerformance.tsx
git commit -m "$(cat <<'EOF'
Compute ClimbPerformance derived values during render (issue #98)

Drop three useState/useEffect pairs (aircraft lookup, ratesOfClimb,
percentMGW) in favor of inline computation. Helpers and JSX unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Atomic structural swap — `<Altitudes>` pure, `<Calculations>` rewired, `<TakeoffPerformance>` shape trimmed

This is one atomic commit. Three files must change together because the legacy `onPressureUpdate` callback and the existing `toldData` shape span them.

**Files:**
- Modify: `src/components/Altitudes.tsx`
- Create: `src/components/Altitudes.test.tsx`
- Modify: `src/components/Calculations.tsx`
- Modify: `src/components/TakeoffPerformance.tsx`

- [ ] **Step 4.1: Write `<Altitudes>` test (failing)**

Create `src/components/Altitudes.test.tsx`:

```tsx
import { render, screen } from "../test-utils/test-utils";
import Altitudes from "./Altitudes";

describe("Altitudes (pure display)", () => {
  it("renders '-' for all PA/DA cells when nulls are passed", () => {
    render(
      <Altitudes
        altitudes={[null, null, null]}
        PAs={[null, null, null]}
        DAs={[null, null, null]}
      />
    );
    const dashes = screen.getAllByText("-");
    // 3 altitudes + 3 PAs + 3 DAs = 9 dashes
    expect(dashes.length).toBe(9);
  });

  it("renders the PA values rounded and locale-formatted", () => {
    render(
      <Altitudes
        altitudes={[4472, 10000, 4321]}
        PAs={[4500, 10500, 4400]}
        DAs={[6000, 13000, 5800]}
      />
    );
    expect(screen.getByText("4,500")).toBeInTheDocument();
    expect(screen.getByText("10,500")).toBeInTheDocument();
    expect(screen.getByText("4,400")).toBeInTheDocument();
    expect(screen.getByText("6,000")).toBeInTheDocument();
    expect(screen.getByText("13,000")).toBeInTheDocument();
    expect(screen.getByText("5,800")).toBeInTheDocument();
  });

  it("reflects new props on rerender without await/timers", () => {
    const { rerender } = render(
      <Altitudes
        altitudes={[1000, 8000, 1000]}
        PAs={[1000, 8000, 1000]}
        DAs={[1500, 9500, 1500]}
      />
    );
    expect(screen.getByText("9,500")).toBeInTheDocument();

    rerender(
      <Altitudes
        altitudes={[1000, 8000, 1000]}
        PAs={[1000, 8000, 1000]}
        DAs={[1500, 11000, 1500]}
      />
    );
    expect(screen.getByText("11,000")).toBeInTheDocument();
    expect(screen.queryByText("9,500")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2: Confirm it fails**

```
npx jest src/components/Altitudes.test.tsx
```

Expected: FAIL — current `<Altitudes>` requires `altimeters`/`temperatures`/`onPressureUpdate`; test props don't satisfy.

- [ ] **Step 4.3: Replace `<Altitudes>` body**

Replace the entire contents of `src/components/Altitudes.tsx` with:

```tsx
type Triple = [number | null, number | null, number | null];

interface AltitudesProps {
  altitudes: Triple;
  PAs: Triple;
  DAs: Triple;
}

function fmt(v: number | null): string {
  return v === null ? "-" : Math.round(v).toLocaleString();
}

export default function Altitudes({ altitudes, PAs, DAs }: AltitudesProps) {
  return (
    <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700">
      <thead>
        <tr>
          <th className="border border-gray-300 dark:border-gray-700 p-2">Altitudes</th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">Departure</th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">Operating</th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">Arrival</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">Actual Altitude (feet)</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(altitudes[0])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(altitudes[1])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(altitudes[2])}</td>
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">Pressure Altitude (feet)</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(PAs[0])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(PAs[1])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(PAs[2])}</td>
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">Density Altitude (feet)</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(DAs[0])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(DAs[1])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(DAs[2])}</td>
        </tr>
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4.4: Replace `<Calculations>` body**

Replace the entire contents of `src/components/Calculations.tsx` with:

```tsx
"use client";

import type { WorksheetData } from "@/utils/types";
import Altitudes from "@/components/Altitudes";
import ClimbPerformance from "@/components/ClimbPerformance";
import TakeoffPerformance from "@/components/TakeoffPerformance";
import ManeuveringPerformance from "@/components/ManeuveringPerformance";
import TOLDErrorBoundary from "@/components/TOLDErrorBoundary";
import { calculateManeuveringSpeeds } from "@/utils/maneuveringCalculations";
import {
  computePressureColumns,
  computeTOLDViewModel,
} from "@/utils/derived";

interface CalculationsProps {
  state: WorksheetData;
}

export default function Calculations({ state }: CalculationsProps) {
  const { PAs, DAs } = computePressureColumns(
    state.altitude,
    state.altimeter,
    state.temp,
  );
  const toldData = computeTOLDViewModel(state, PAs);
  const maneuveringSpeeds = state.acType
    ? calculateManeuveringSpeeds(state.acType)
    : undefined;

  return (
    <div className="w-full max-w-4xl bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>

      {!state.acType && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">
          Select an aircraft model in the Sortie Information section to see performance calculations.
        </p>
      )}
      <div className="space-y-4">
        <Altitudes altitudes={state.altitude} PAs={PAs} DAs={DAs} />
        <ClimbPerformance
          aircraftModel={state.acType}
          weight={state.weight}
          OATs={state.temp}
          PAs={PAs}
          altimeters={state.altimeter}
        />
        <TOLDErrorBoundary
          onError={(error, errorInfo) => {
            console.error("TOLD calculation error:", error, errorInfo);
          }}
        >
          <TakeoffPerformance
            aircraftModel={state.acType}
            airports={state.airport}
            toldData={toldData}
          />
        </TOLDErrorBoundary>
        <ManeuveringPerformance
          aircraftModel={state.acType}
          maneuveringSpeeds={maneuveringSpeeds ?? undefined}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4.5: Trim `<TakeoffPerformance>` `toldData` prop and helper signatures**

In `src/components/TakeoffPerformance.tsx`, do the following:

(a) Replace the entire import + interface stanza at the top:

```tsx
import React from "react";
import TOLDErrorDisplay from "./TOLDErrorDisplay";
import TOLDFallbackDisplay from "./TOLDFallbackDisplay";
import type { TOLDError } from "@/utils/types";
import type { TOLDViewModel } from "@/utils/derived";

interface TakeoffPerformanceProps {
  aircraftModel?: string;
  airports: [string, string]; // [departure, arrival]
  toldData?: TOLDViewModel;
}
```

(b) Inside the function body, replace the `shouldShowFallback` block and the `getFallbackReason`/`<TOLDFallbackDisplay>` block to drop the `onRetry` prop:

```tsx
  if (shouldShowFallback()) {
    const getFallbackReason = (): "no-aircraft" | "no-data" | "calculation-failed" => {
      if (!toldData) return "calculation-failed";
      if (toldData.errors.some((e) => e.type === "aircraft_not_found")) return "no-aircraft";
      if (toldData.errors.some((e) => e.type === "missing_data")) return "no-data";
      return "calculation-failed";
    };

    return (
      <TOLDFallbackDisplay
        aircraftModel={aircraftModel}
        airports={airports}
        reason={getFallbackReason()}
      />
    );
  }
```

(c) Update the three cell-helper signatures and bodies to drop `isCalculating`:

```tsx
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "TBD";
    return value.toLocaleString();
  };

  const getDisplayValue = (
    value: number | null | undefined,
    hasErrors: boolean,
  ): string => {
    if (hasErrors) return "Error";
    return formatNumber(value);
  };

  const getCellClasses = (
    value: number | null | undefined,
    hasErrors: boolean,
  ): string => {
    const baseClasses = "py-2 px-4 text-right";
    if (hasErrors) return `${baseClasses} text-red-600 dark:text-red-400`;
    if (value === null || value === undefined)
      return `${baseClasses} text-gray-500 dark:text-gray-400`;
    return baseClasses;
  };

  const getAvailableRunwayCellClasses = (
    value: number | null | undefined,
    hasErrors: boolean,
  ): string => {
    const baseClasses = "py-2 px-4 text-right";
    if (hasErrors) return `${baseClasses} text-red-600 dark:text-red-400`;
    if (value === null || value === undefined)
      return `${baseClasses} text-gray-500 dark:text-gray-400`;
    if (value < 0) return `${baseClasses} text-red-600 dark:text-red-400`;
    return baseClasses;
  };

  const results = toldData?.results;
  const hasErrors = toldData?.hasErrors || false;
```

(d) Delete the line `const isCalculating = toldData?.isCalculating || false;`.

(e) In the JSX `<TOLDErrorDisplay>` element, remove the `onRetry={toldData.retryCalculation}` and `onClear={toldData.clearErrors}` props (both are already optional on the receiver).

(f) Inside every TOLD table `<td>` in this file, **every** call to the three helpers currently has the form `helper(value, isCalculating, hasErrors)`. Drop the `isCalculating` argument so it becomes `helper(value, hasErrors)`. There are roughly 18 such call sites (3 helpers × 6 cells). Each one is mechanical — find any `isCalculating,` token inside a helper-call argument list and remove it (plus the surrounding whitespace).

After this edit, `isCalculating` should no longer appear anywhere in `TakeoffPerformance.tsx`.

- [ ] **Step 4.6: Run targeted tests**

```
npx jest src/components/Altitudes.test.tsx src/components/Calculations.test.tsx
```

Expected: PASS.

- [ ] **Step 4.7: Full suite + lint**

```
npm test -- --watchAll=false
npm run lint
```

Expected: PASS.

- [ ] **Step 4.8: Commit**

```
git add src/components/Altitudes.tsx src/components/Altitudes.test.tsx src/components/Calculations.tsx src/components/TakeoffPerformance.tsx
git commit -m "$(cat <<'EOF'
Move Calculations to render-time pure derivation (issue #98)

<Calculations> now derives PAs/DAs and the TOLD view model during render
via the new derived.ts helpers, and passes them straight to dumb display
children. Removes 6 useState + ~10 useCallback + 2 useEffect.

<Altitudes> becomes a pure display component (PAs/DAs as props, no
internal useEffect, no onPressureUpdate callback).

<TakeoffPerformance>'s toldData shape sheds isCalculating,
retryCalculation, and clearErrors — none are meaningful once results
are derived from state. TOLDErrorDisplay's onRetry/onClear are already
optional.

This is the structural fix for issue #98: there is no longer any path
for derived state to fall out of sync with the form inputs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Regression test — operating column updates on rerender

**Files:**
- Modify: `src/components/Calculations.test.tsx`

- [ ] **Step 5.1: Add regression tests**

Append inside the `describe("Calculations", ...)` block in `src/components/Calculations.test.tsx`:

```tsx
  it("updates operating Density Altitude immediately when operating temperature changes (issue #98)", () => {
    const initial: WorksheetData = {
      ...mockWorksheetData,
      altitude: [4472, 10000, 4321],
      altimeter: [29.92, 29.92, 29.92],
      temp: [20, 20, 20],
    };
    const { rerender } = render(<Calculations state={initial} />);

    const firstDA = screen
      .getByText("Density Altitude (feet)")
      .closest("tr")!
      .querySelectorAll("td")[2].textContent;

    const updated: WorksheetData = {
      ...initial,
      temp: [20, 35, 20], // operating column hotter
    };
    rerender(<Calculations state={updated} />);

    const secondDA = screen
      .getByText("Density Altitude (feet)")
      .closest("tr")!
      .querySelectorAll("td")[2].textContent;

    expect(secondDA).not.toBe(firstDA);
    expect(secondDA).not.toBe("-");
  });

  it("updates operating Rate of Climb when operating PA changes (issue #98)", () => {
    const initial: WorksheetData = {
      ...mockWorksheetData,
      altitude: [4472, 6000, 4321],
      altimeter: [29.92, 29.92, 29.92],
      temp: [20, 20, 20],
      weight: 2700,
    };
    const { rerender } = render(<Calculations state={initial} />);

    const firstROC = screen
      .getByText("Rate of Climb (MGW)")
      .closest("tr")!
      .querySelectorAll("td")[2].textContent;

    rerender(
      <Calculations
        state={{
          ...initial,
          altitude: [4472, 12000, 4321], // raise operating altitude
        }}
      />
    );

    const secondROC = screen
      .getByText("Rate of Climb (MGW)")
      .closest("tr")!
      .querySelectorAll("td")[2].textContent;

    expect(secondROC).not.toBe(firstROC);
  });
```

- [ ] **Step 5.2: Run the new tests**

```
npx jest src/components/Calculations.test.tsx
```

Expected: PASS.

- [ ] **Step 5.3: Commit**

```
git add src/components/Calculations.test.tsx
git commit -m "$(cat <<'EOF'
Regression tests for issue #98 — operating column updates on rerender

Two tests: (1) operating Density Altitude reflects a new operating temp
without await/timers, (2) operating Rate of Climb reflects a new
operating altitude. Both would have failed under the previous
useEffect-driven chain when array references were mutated in place.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Defense in depth — fix `mergeWeatherData` mutation

**Files:**
- Modify: `src/utils/weatherDataMapper.ts`
- Modify: `src/utils/weatherDataMapper.test.ts`

- [ ] **Step 6.1: Add failing regression tests**

Append inside `describe("Weather Data Mapper", ...)` in `src/utils/weatherDataMapper.test.ts`:

```ts
  describe("mergeWeatherData immutability (issue #98 regression)", () => {
    it("does not mutate the existing temp array when merging in API temp values", () => {
      const existing = {
        temp: [25, 12, 26] as [number | null, number | null, number | null],
      };
      const originalTempRef = existing.temp;
      const merged = mergeWeatherData(existing, {
        temp: [22, 9, 24] as [number | null, number | null, number | null],
      });
      expect(merged.temp).not.toBe(originalTempRef);
      expect(existing.temp).toEqual([25, 12, 26]); // unchanged
      expect(merged.temp).toEqual([22, 9, 24]);
    });

    it("does not mutate the existing altimeter array when merging", () => {
      const existing = {
        altimeter: [30.12, 29.85, 30.11] as [
          number | null,
          number | null,
          number | null,
        ],
      };
      const originalRef = existing.altimeter;
      const merged = mergeWeatherData(existing, {
        altimeter: [30.0, 29.9, 30.0] as [
          number | null,
          number | null,
          number | null,
        ],
      });
      expect(merged.altimeter).not.toBe(originalRef);
      expect(existing.altimeter).toEqual([30.12, 29.85, 30.11]);
    });

    it("does not mutate the existing altitude array; honors -1 sentinel for operating slot", () => {
      const existing = {
        altitude: [4472, 10000, 4321] as [
          number | null,
          number | null,
          number | null,
        ],
      };
      const originalRef = existing.altitude;
      const merged = mergeWeatherData(existing, {
        altitude: [5000, -1, 5000] as [
          number | null,
          number | null,
          number | null,
        ],
      });
      expect(merged.altitude).not.toBe(originalRef);
      // departure + arrival updated, operating preserved because -1 means "don't update"
      expect(merged.altitude).toEqual([5000, 10000, 5000]);
      expect(existing.altitude).toEqual([4472, 10000, 4321]);
    });
  });
```

- [ ] **Step 6.2: Confirm failure**

```
npx jest src/utils/weatherDataMapper.test.ts -t "issue #98 regression"
```

Expected: FAIL — `merged.temp` shares a reference with `existing.temp`.

- [ ] **Step 6.3: Make `mergeWeatherData` immutable**

In `src/utils/weatherDataMapper.ts`, replace the existing `temp` block inside `mergeWeatherData` (around line 533) with:

```ts
  if (apiData.temp) {
    const next = (
      result.temp ? [...result.temp] : [null, null, null]
    ) as [number | null, number | null, number | null];
    apiData.temp.forEach((val, i) => {
      if (val !== undefined && val !== -1) {
        next[i] = val;
      }
    });
    result.temp = next;
  }
```

Replace the existing `altimeter` block (around line 542) with:

```ts
  if (apiData.altimeter) {
    const next = (
      result.altimeter ? [...result.altimeter] : [null, null, null]
    ) as [number | null, number | null, number | null];
    apiData.altimeter.forEach((val, i) => {
      if (val !== undefined && val !== -1) {
        next[i] = val;
      }
    });
    result.altimeter = next;
  }
```

Replace the existing `altitude` block (around line 555) with:

```ts
  if (apiData.altitude) {
    if (result.altitude) {
      const next = [...result.altitude] as [
        number | null,
        number | null,
        number | null,
      ];
      if (apiData.altitude[0] !== undefined) next[0] = apiData.altitude[0];
      if (apiData.altitude[2] !== undefined) next[2] = apiData.altitude[2];
      // Operating slot: -1 sentinel means "don't update"; otherwise overwrite.
      if (apiData.altitude[1] !== undefined && apiData.altitude[1] !== -1) {
        next[1] = apiData.altitude[1];
      }
      result.altitude = next;
    } else {
      result.altitude = [...apiData.altitude] as [
        number | null,
        number | null,
        number | null,
      ];
    }
  }
```

The previous code had a dead `existingOperatingAltitude` save/restore that always negated the operating-altitude update from the API. The new code respects the `-1` sentinel correctly.

- [ ] **Step 6.4: Run the suite**

```
npx jest src/utils/weatherDataMapper.test.ts
```

Expected: PASS (all existing + 3 new tests).

- [ ] **Step 6.5: Commit**

```
git add src/utils/weatherDataMapper.ts src/utils/weatherDataMapper.test.ts
git commit -m "$(cat <<'EOF'
mergeWeatherData: stop mutating input arrays (issue #98)

The previous implementation shallow-copied the top-level result but
mutated result.temp / result.altimeter / result.altitude in place,
since they shared references with existingData. After setState, the
top-level state changed but the inner array references didn't, so
useEffect dependency arrays in <Altitudes>/<ClimbPerformance>/<Calculations>
silently skipped recomputation. The render-time refactor already
sidesteps this, but the mutation is still a defect — any future
memoized selector, React Compiler annotation, or strict-mode check
would be misled.

Also drop the existingOperatingAltitude save/restore dance, which was
a workaround that accidentally suppressed legitimate API operating-altitude
updates. The new block honors the -1 "don't update" sentinel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Defense in depth — fix the airport / area-of-ops mappers too

`mapAirportSpecificWeatherData` and `mapWeatherDataToWorksheet` write into `result.temp[i]` / `result.altimeter[i]` arrays they themselves created — so today they aren't capable of leaking. Still, keeping the pattern consistent across the file removes a foot-gun for future contributors who pass an existing array into `result` and inherit references.

**Files:**
- Modify: `src/utils/weatherDataMapper.ts`

- [ ] **Step 7.1: Make the in-function writes immutable**

In `src/utils/weatherDataMapper.ts`, lines ~91 and ~97 (inside `mapAirportSpecificWeatherData`), replace:

```ts
    if (sel.temp !== null) {
      const temp = sel.temp;
      if (!options.validateData || isValidTemperature(temp)) {
        if (!result.temp) result.temp = [-1, -1, -1];
        result.temp[index] = temp;
      }
    }
    if (sel.altimeter !== null) {
      if (!options.validateData || isValidAltimeter(sel.altimeter)) {
        if (!result.altimeter) result.altimeter = [-1, -1, -1];
        result.altimeter[index] = sel.altimeter;
      }
    }
```

with:

```ts
    if (sel.temp !== null) {
      const temp = sel.temp;
      if (!options.validateData || isValidTemperature(temp)) {
        const next = (result.temp ? [...result.temp] : [-1, -1, -1]) as [
          number | null,
          number | null,
          number | null,
        ];
        next[index] = temp;
        result.temp = next;
      }
    }
    if (sel.altimeter !== null) {
      if (!options.validateData || isValidAltimeter(sel.altimeter)) {
        const next = (result.altimeter
          ? [...result.altimeter]
          : [-1, -1, -1]) as [number | null, number | null, number | null];
        next[index] = sel.altimeter;
        result.altimeter = next;
      }
    }
```

In `mapWeatherDataToWorksheet`, lines ~284 and ~294, replace:

```ts
        if (!options.validateData || isValidTemperature(areaOfOps.opTemp)) {
          if (!result.data.temp) result.data.temp = [-1, -1, -1];
          result.data.temp[1] = areaOfOps.opTemp;
        } else {
```

with:

```ts
        if (!options.validateData || isValidTemperature(areaOfOps.opTemp)) {
          const next = (result.data.temp
            ? [...result.data.temp]
            : [-1, -1, -1]) as [number | null, number | null, number | null];
          next[1] = areaOfOps.opTemp;
          result.data.temp = next;
        } else {
```

And replace:

```ts
        if (!options.validateData || isValidAltimeter(areaOfOps.opAltimeter)) {
          if (!result.data.altimeter) result.data.altimeter = [-1, -1, -1];
          result.data.altimeter[1] = areaOfOps.opAltimeter;
        } else {
```

with:

```ts
        if (!options.validateData || isValidAltimeter(areaOfOps.opAltimeter)) {
          const next = (result.data.altimeter
            ? [...result.data.altimeter]
            : [-1, -1, -1]) as [number | null, number | null, number | null];
          next[1] = areaOfOps.opAltimeter;
          result.data.altimeter = next;
        } else {
```

- [ ] **Step 7.2: Full test suite**

```
npm test -- --watchAll=false
```

Expected: PASS.

- [ ] **Step 7.3: Commit**

```
git add src/utils/weatherDataMapper.ts
git commit -m "$(cat <<'EOF'
Make airport/areaOfOps weather mappers immutable too (issue #98)

mapAirportSpecificWeatherData and mapWeatherDataToWorksheet both
wrote temp/altimeter array indices in place. The new code copies
before writing, matching mergeWeatherData and removing the last
in-place-mutation footgun in the weather pipeline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Full validation — tests, lint, build, manual smoke

**Files:** none modified

- [ ] **Step 8.1: Full test suite**

```
npm test -- --watchAll=false
```

Expected: PASS, no skipped tests beyond those already skipped on `main`.

- [ ] **Step 8.2: Lint**

```
npm run lint
```

Expected: clean.

- [ ] **Step 8.3: Production build**

```
npm run build
```

Expected: PASS — confirms there are no TS errors and the bundler accepts the simplified components.

- [ ] **Step 8.4: Manual smoke in the dev server**

Start the dev server:

```
npm run dev
```

In the browser, load the URL from issue #98:

```
http://localhost:3000/?pilot=Me&date=2026-05-11&time=18:00&acType=C182T&tailN=N23423&airport=KOGD,KTVY&route=OGD/238/43&position=40.9626,-112.9829&wind=259,260,264,267,267||7,8,13,18,21||30,23,15,7,-1&turb=0&cielVis=0&mtnObsc=0&temp=25,12,26&altimeter=30.12,29.85,30.11&altitude=4472,10000,4321&rwy=5195,6102&weight=3000&duration=2.5&mtnEndorse=0&mtnCert=0
```

Confirm visually:
1. Operating column shows non-empty Pressure Altitude and Density Altitude rows in the Altitudes table (the reproducer for issue #98).
2. Click **Fetch Weather** and confirm Operating PA/DA, Rate of Climb, and TOLD distances all change in response to the updated temp/altimeter values from the API.
3. Manually edit Operating Temperature in the Aircraft Performance table — Operating PA, DA, and Rate of Climb update immediately on each keystroke.
4. Toggle °F/°C — temperatures redraw and downstream calculations stay consistent.
5. Change Weight — TOLD ground roll/obstacle and % MGW update.

If any of these fail, stop and capture the failure with browser devtools / a screenshot before continuing.

- [ ] **Step 8.5: No commit needed** — this task is validation only.

---

## Spec coverage check

Running mentally against `docs/superpowers/specs/2026-05-10-issue-98-calculation-recompute-design.md`:

- "Design / Principle" → Tasks 3, 4 (display-only children + render-time orchestrator)
- "New file: `src/utils/derived.ts`" → Tasks 1, 2
- "`Altitudes`" → Task 4
- "`ClimbPerformance`" → Task 3
- "`Calculations`" → Task 4
- "`TakeoffPerformance`" → Task 4
- "`weatherDataMapper` — defense in depth" → Tasks 6, 7
- "Tests / New" → Tasks 1, 2 (derived), Task 6 (regression)
- "Tests / Updated" → Task 4 (Altitudes.test), Task 5 (Calculations regression)
- "Manual validation" → Task 8
- "Non-goals" → respected (no spinners, no state lib, no input refactor)
- "Risks" → addressed (`onRetry` removal, error boundary kept, render cost negligible)

No gaps.
