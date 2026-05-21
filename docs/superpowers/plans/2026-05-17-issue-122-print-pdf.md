# Issue #122 — Print/PDF Briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print the worksheet as a single-page US-letter briefing by adding a dedicated `<PrintBriefing>` component, wiring the existing inert `Print briefing` button to `window.print()`, and removing the current multi-page print behavior (which expands the Instructions and Checklist slide-overs as appendices).

**Architecture:** A new `PrintBriefing` component is mounted inside `AppContainer` and rendered via `hidden print:block`; the rest of the app receives `print:hidden`. Both the screen `<Calculations>` path and the print `<PrintBriefing>` path call the same derivation helpers (`computePressureColumns`, `computeTOLDViewModel`, `calculateManeuveringSpeeds`), so there is one source of truth. The `Print briefing` button is moved from the `all-done`-only branch into the persistent right cluster of `ActionBar` and wired to `window.print()` via a new `onPrint` prop.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`print:` variants and arbitrary `text-[9pt]` values), Jest + React Testing Library. No new dependencies.

**Read before starting:** `docs/superpowers/specs/2026-05-17-issue-122-print-pdf-design.md` (the validated spec for this work), plus `src/components/Calculations.tsx` to see the existing derivation calls (lines 21–29) that `PrintBriefing` will mirror.

---

## File Structure

**Create:**

- `src/components/PrintBriefing.tsx` — pure render of a one-page briefing from `WorksheetData`. Computes its derived values inline using `computePressureColumns`, `computeTOLDViewModel`, and `calculateManeuveringSpeeds`. Renders `hidden print:block` so it has no visible footprint on screen.
- `src/components/PrintBriefing.test.tsx` — colocated Jest tests covering identity/route, weather, per-phase env, TOLD coloring, climb, maneuvering, footer, and the no-aircraft fallback.

**Modify:**

- `src/app/globals.css` — replace the existing `@media print` block (lines 43–78) with a minimal reset: `@page`, white background, suppress shadows, declare `print-color-adjust: exact` for the briefing's accent classes.
- `src/components/ActionBar.tsx` — add an `onPrint: () => void` prop, move the existing `Print briefing` button out of the `all-done`-only branch and into the persistent right cluster next to `Checklist`, wire it to `onPrint`.
- `src/components/ActionBar.test.tsx` — extend the existing tests so they (a) assert the Print button renders in every state, (b) verify clicking it calls `onPrint`. Keep the existing `all-done` button checks but drop the Print assertion from there (only `Acknowledge` remains there).
- `src/components/AppContainer.tsx` — add `handlePrint` that calls `window.print()`, pass it through `WeatherDataIntegration`'s `renderButton` into `ActionBar`, mount `<PrintBriefing state={state} />` as a sibling of the screen tree, and add `print:hidden` to the screen-only regions (`WorksheetHeader`, `Stepper`, `ActionBar` wrapper is handled inside `ActionBar.tsx`, `<main>`, the two `<SlideOver>` mounts, `<footer>`).
- `src/components/AppContainer.test.tsx` — assert `<PrintBriefing>` renders, the Print button exists, and clicking it invokes a mocked `window.print`.

**No deletes.** The Phase-5 slide-over `print:` utility classes (`print:static`, `print:break-before-page`, etc.) become unused after this work; leaving them in place is harmless and can be cleaned up separately.

---

## Task 1: Replace the global print stylesheet

**Files:**
- Modify: `src/app/globals.css:43-78`

- [ ] **Step 1: Replace the existing `@media print` block**

Open `src/app/globals.css` and replace the entire `@media print { … }` block (lines 43–78) with:

```css
@page {
  size: letter portrait;
  margin: 0.4in;
}

@media print {
  /* Force two-color rendering and remove dark-mode backgrounds. */
  html, body {
    background: #ffffff !important;
    color: #0f172a !important;
  }

  /* Suppress effects that don't print well. */
  *, *::before, *::after {
    box-shadow: none !important;
    text-shadow: none !important;
    animation: none !important;
    transition: none !important;
  }

  /* Preserve the small set of accent colors used by PrintBriefing
     (red margin-remaining, amber AIRMET) across browsers. */
  .print-keep-color {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: PASS (no CSS rules — Tailwind/PostCSS will still process the file).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "Replace multi-page print stylesheet with single-page reset"
```

---

## Task 2: `PrintBriefing` skeleton — identity + route + quals

**Files:**
- Create: `src/components/PrintBriefing.tsx`
- Create: `src/components/PrintBriefing.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/PrintBriefing.test.tsx`:

```tsx
// src/components/PrintBriefing.test.tsx
import { render, screen } from "../test-utils/test-utils";
import PrintBriefing from "./PrintBriefing";
import type { WorksheetData } from "@/utils/types";

const emptyState: WorksheetData = {
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

const fullState: WorksheetData = {
  ...emptyState,
  pilot: "Loosli",
  date: "2026-05-17",
  time: "18:00",
  duration: 3,
  acType: "T182T",
  tailN: "N911CP",
  airport: ["KOGD", "KLGU"],
  route: "Wasatch Range",
  position: [41.2, -111.97],
  mtnEndorse: true,
  mtnCert: false,
};

describe("PrintBriefing — identity, route, quals", () => {
  it("renders the briefing title and timestamp scaffold", () => {
    render(<PrintBriefing state={fullState} />);
    expect(
      screen.getByRole("heading", { name: /Briefing/i })
    ).toBeInTheDocument();
  });

  it("renders the identity line with pilot, AC/tail, UTC date+time, duration", () => {
    render(<PrintBriefing state={fullState} />);
    expect(screen.getByText(/Loosli/)).toBeInTheDocument();
    expect(screen.getByText(/T182T/)).toBeInTheDocument();
    expect(screen.getByText(/N911CP/)).toBeInTheDocument();
    expect(screen.getByText(/2026-05-17/)).toBeInTheDocument();
    expect(screen.getByText(/18:00/)).toBeInTheDocument();
  });

  it("renders the route line with departure → arrival, area, and position", () => {
    render(<PrintBriefing state={fullState} />);
    expect(screen.getByText(/KOGD/)).toBeInTheDocument();
    expect(screen.getByText(/KLGU/)).toBeInTheDocument();
    expect(screen.getByText(/Wasatch Range/)).toBeInTheDocument();
    expect(screen.getByText(/41\.2/)).toBeInTheDocument();
  });

  it("renders quals chips with ✓ / ✗", () => {
    render(<PrintBriefing state={fullState} />);
    const endorse = screen.getByText(/Mtn Endorse/);
    expect(endorse.textContent).toMatch(/✓/);
    const cert = screen.getByText(/Mtn Cert/);
    expect(cert.textContent).toMatch(/✗/);
  });

  it("renders em-dash placeholders for missing identity fields", () => {
    render(<PrintBriefing state={emptyState} />);
    // Every placeholder is the same em-dash; at minimum one should appear.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/PrintBriefing.test.tsx`
Expected: FAIL — `Cannot find module './PrintBriefing'`.

- [ ] **Step 3: Create the component scaffold**

Create `src/components/PrintBriefing.tsx`:

```tsx
import type { WorksheetData } from "@/utils/types";

interface PrintBriefingProps {
  state: WorksheetData;
}

const dash = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  return String(v);
};

const tick = (v: boolean): string => (v ? "✓" : "✗");

export default function PrintBriefing({ state }: PrintBriefingProps) {
  const [dep, arr] = state.airport;
  const [lat, lon] = state.position;
  const position =
    lat !== null && lon !== null
      ? `${lat.toFixed(2)}, ${lon.toFixed(2)}`
      : "—";

  return (
    <section
      className="hidden print:block text-[9pt] leading-tight text-slate-900"
      aria-label="Print briefing"
    >
      <header className="flex items-baseline justify-between border-b border-slate-400 pb-1 mb-2">
        <h2 className="text-[12pt] font-bold tracking-tight">
          CAP Mountain Flying Worksheet — Briefing
        </h2>
      </header>

      <div className="mb-1.5">
        <span className="font-semibold">Pilot:</span> {dash(state.pilot)}
        <span className="mx-2">·</span>
        <span className="font-semibold">AC:</span>{" "}
        {dash(state.acType)} / {dash(state.tailN)}
        <span className="mx-2">·</span>
        <span className="font-semibold">UTC:</span>{" "}
        {dash(state.date)} {dash(state.time)}
        <span className="mx-2">·</span>
        <span className="font-semibold">Duration:</span>{" "}
        {state.duration !== null ? `${state.duration} h` : "—"}
        <span className="mx-2">·</span>
        <span>Mtn Endorse {tick(state.mtnEndorse)}</span>
        <span className="mx-2">·</span>
        <span>Mtn Cert {tick(state.mtnCert)}</span>
      </div>

      <div className="mb-2">
        <span className="font-semibold">Route:</span> {dash(dep)} →{" "}
        {dash(arr)}
        <span className="mx-2">·</span>
        <span className="font-semibold">Area:</span> {dash(state.route)}
        <span className="mx-2">·</span>
        <span className="font-semibold">Position:</span> {position}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/PrintBriefing.test.tsx`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintBriefing.tsx src/components/PrintBriefing.test.tsx
git commit -m "PrintBriefing: identity, route, and quals scaffold"
```

---

## Task 3: `PrintBriefing` — weather conditions (winds aloft + AIRMETs)

**Files:**
- Modify: `src/components/PrintBriefing.tsx`
- Modify: `src/components/PrintBriefing.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `src/components/PrintBriefing.test.tsx`:

```tsx
const stateWithWeather: WorksheetData = {
  ...fullState,
  wind: [
    [340, 320, 300, 280, 270],
    [10, 15, 20, 25, 30],
    [10, 5, 0, -5, -10],
  ] as [(number | null)[], (number | null)[], (number | null)[]],
  turb: true,
  cielVis: false,
  mtnObsc: true,
};

describe("PrintBriefing — weather conditions", () => {
  it("renders a winds-aloft table with rows for 3k/6k/9k/12k/15k", () => {
    render(<PrintBriefing state={stateWithWeather} />);
    for (const altLabel of ["3,000", "6,000", "9,000", "12,000", "15,000"]) {
      expect(screen.getByText(altLabel)).toBeInTheDocument();
    }
  });

  it("renders wind direction, velocity, and temperature for each altitude", () => {
    render(<PrintBriefing state={stateWithWeather} />);
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByText("270")).toBeInTheDocument();
    // -10 °C at 15k should appear with a minus sign
    expect(screen.getByText("-10")).toBeInTheDocument();
  });

  it("renders em-dashes for missing wind cells", () => {
    const partial = {
      ...stateWithWeather,
      wind: [
        [340, null, null, null, null],
        [10, null, null, null, null],
        [10, null, null, null, null],
      ] as [(number | null)[], (number | null)[], (number | null)[]],
    };
    render(<PrintBriefing state={partial} />);
    // At minimum the 6k/9k/12k/15k cells should contain em-dashes.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(12);
  });

  it("renders AIRMET chips for turb / cielVis / mtnObsc", () => {
    render(<PrintBriefing state={stateWithWeather} />);
    const turb = screen.getByText(/Turb/);
    expect(turb.textContent).toMatch(/✓/);
    const cielVis = screen.getByText(/Ceil\/Vis/);
    expect(cielVis.textContent).toMatch(/✗/);
    const mtnObsc = screen.getByText(/Mtn Obsc/);
    expect(mtnObsc.textContent).toMatch(/✓/);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx jest src/components/PrintBriefing.test.tsx -t "weather conditions"`
Expected: FAIL — `Unable to find an element with the text: 3,000`.

- [ ] **Step 3: Add the weather block to the component**

Replace the contents of the `<section>` in `src/components/PrintBriefing.tsx` so the existing identity/route blocks are followed by a weather block. Add this above the closing `</section>`:

```tsx
      {/* ---- Conditions ---- */}
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-x-4 break-inside-avoid">
        <div>
          <div className="font-semibold mb-0.5">Winds aloft</div>
          <table className="w-full border-collapse text-[8pt]">
            <thead>
              <tr className="border-b border-slate-400">
                <th className="text-left pr-2 font-medium">Alt</th>
                <th className="text-right pr-2 font-medium">Dir</th>
                <th className="text-right pr-2 font-medium">Vel</th>
                <th className="text-right font-medium">Temp</th>
              </tr>
            </thead>
            <tbody>
              {WIND_LABELS.map((label, idx) => (
                <tr key={label} className="border-b border-slate-200">
                  <td className="py-0.5 pr-2">{label}</td>
                  <td className="py-0.5 pr-2 text-right">
                    {dash(state.wind[0][idx] ?? null)}
                  </td>
                  <td className="py-0.5 pr-2 text-right">
                    {dash(state.wind[1][idx] ?? null)}
                  </td>
                  <td className="py-0.5 text-right">
                    {dash(state.wind[2][idx] ?? null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="self-start">
          <div className="font-semibold mb-0.5">Advisories</div>
          <ul className="space-y-0.5 text-[8pt]">
            <li>
              <span className={state.turb ? "print-keep-color text-amber-700 font-semibold" : "text-slate-500"}>
                Turb {tick(state.turb)}
              </span>
            </li>
            <li>
              <span className={state.cielVis ? "print-keep-color text-amber-700 font-semibold" : "text-slate-500"}>
                Ceil/Vis {tick(state.cielVis)}
              </span>
            </li>
            <li>
              <span className={state.mtnObsc ? "print-keep-color text-amber-700 font-semibold" : "text-slate-500"}>
                Mtn Obsc {tick(state.mtnObsc)}
              </span>
            </li>
          </ul>
        </div>
      </div>
```

Add this constant at the top of the file, just below the imports:

```tsx
const WIND_LABELS = ["3,000", "6,000", "9,000", "12,000", "15,000"] as const;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/PrintBriefing.test.tsx`
Expected: PASS (all tests including the new weather block).

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintBriefing.tsx src/components/PrintBriefing.test.tsx
git commit -m "PrintBriefing: winds aloft table and AIRMET advisories"
```

---

## Task 4: `PrintBriefing` — per-phase environment + TOLD

**Files:**
- Modify: `src/components/PrintBriefing.tsx`
- Modify: `src/components/PrintBriefing.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `src/components/PrintBriefing.test.tsx`:

```tsx
const stateWithPerf: WorksheetData = {
  ...fullState,
  weight: 3000,
  rwy: [4000, 6500],
  temp: [20, 10, 15] as [number, number, number],
  altimeter: [29.92, 29.92, 29.92] as [number, number, number],
  altitude: [4000, 8000, 4500] as [number, number, number],
};

describe("PrintBriefing — per-phase environment", () => {
  it("renders rows for Actual Altitude, OAT, Altimeter, PA, DA across dep/op/arr", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText(/Actual Altitude/i)).toBeInTheDocument();
    expect(screen.getByText(/OAT/i)).toBeInTheDocument();
    expect(screen.getByText(/Altimeter/i)).toBeInTheDocument();
    expect(screen.getByText(/Pressure Alt/i)).toBeInTheDocument();
    expect(screen.getByText(/Density Alt/i)).toBeInTheDocument();
    // Three column headers
    expect(screen.getByText(/Departure/i)).toBeInTheDocument();
    expect(screen.getByText(/Operating/i)).toBeInTheDocument();
    expect(screen.getByText(/Arrival/i)).toBeInTheDocument();
  });

  it("renders the entered altitudes formatted with thousands separators", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText("4,000")).toBeInTheDocument();
    expect(screen.getByText("8,000")).toBeInTheDocument();
    expect(screen.getByText("4,500")).toBeInTheDocument();
  });
});

describe("PrintBriefing — TOLD", () => {
  it("renders TOLD rows when aircraft and inputs are present", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText(/TO Ground Roll/i)).toBeInTheDocument();
    expect(screen.getByText(/Landing Ground Roll/i)).toBeInTheDocument();
    expect(screen.getByText(/Runway remaining/i)).toBeInTheDocument();
  });

  it("applies the negative-margin class when runway remaining is negative", () => {
    // Pick a tiny runway so the calculation comes back negative.
    const tightRwy: WorksheetData = {
      ...stateWithPerf,
      rwy: [100, 100] as [number, number],
    };
    const { container } = render(<PrintBriefing state={tightRwy} />);
    const reds = container.querySelectorAll(".print-margin-bad");
    expect(reds.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx jest src/components/PrintBriefing.test.tsx -t "per-phase environment"`
Expected: FAIL — `Unable to find an element with the text: Actual Altitude`.

- [ ] **Step 3: Wire in the derivation helpers and add the env+TOLD blocks**

Add the imports at the top of `src/components/PrintBriefing.tsx`, replacing the existing import line:

```tsx
import type { WorksheetData } from "@/utils/types";
import {
  computePressureColumns,
  computeTOLDViewModel,
  type Triple,
} from "@/utils/derived";
```

Add helper functions just under the existing `dash`/`tick` helpers:

```tsx
const fmtFt = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : Math.round(v).toLocaleString();

const fmtNum = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : v.toLocaleString();
```

Inside the component, after destructuring `state.position`, compute derived values:

```tsx
  const { PAs, DAs } = computePressureColumns(
    state.altitude,
    state.altimeter,
    state.temp,
  );
  const told = computeTOLDViewModel(state, PAs);
```

Add the env + TOLD blocks just before the closing `</section>`:

```tsx
      {/* ---- Per-phase environment ---- */}
      <table className="w-full border-collapse text-[8pt] mb-2 break-inside-avoid">
        <thead>
          <tr className="border-b border-slate-400">
            <th className="text-left pr-2 font-medium"></th>
            <th className="text-right pr-2 font-medium">Departure</th>
            <th className="text-right pr-2 font-medium">Operating</th>
            <th className="text-right font-medium">Arrival</th>
          </tr>
        </thead>
        <tbody>
          {ENV_ROWS.map((row) => (
            <tr key={row.label} className="border-b border-slate-200">
              <td className="py-0.5 pr-2">{row.label}</td>
              <td className="py-0.5 pr-2 text-right">{row.fmt(row.read(state, PAs, DAs)[0])}</td>
              <td className="py-0.5 pr-2 text-right">{row.fmt(row.read(state, PAs, DAs)[1])}</td>
              <td className="py-0.5 text-right">{row.fmt(row.read(state, PAs, DAs)[2])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---- TOLD ---- */}
      {state.acType && (
        <table className="w-full border-collapse text-[8pt] mb-2 break-inside-avoid">
          <thead>
            <tr className="border-b border-slate-400">
              <th className="text-left pr-2 font-medium" colSpan={3}>
                Takeoff &amp; Landing ({state.acType})
              </th>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="text-left pr-2 font-medium"></th>
              <th className="text-right pr-2 font-medium">
                {dash(state.airport[0])}
              </th>
              <th className="text-right font-medium">
                {dash(state.airport[1])}
              </th>
            </tr>
          </thead>
          <tbody>
            <TOLDRow
              label="TO Ground Roll"
              dep={told.results?.takeoffGroundRoll.departure ?? null}
              arr={told.results?.takeoffGroundRoll.arrival ?? null}
            />
            <TOLDRow
              label="TO over 50' obstacle"
              dep={told.results?.takeoff50ftObstacle.departure ?? null}
              arr={told.results?.takeoff50ftObstacle.arrival ?? null}
            />
            <TOLDRow
              label="Landing Ground Roll"
              dep={told.results?.landingGroundRoll.departure ?? null}
              arr={told.results?.landingGroundRoll.arrival ?? null}
            />
            <TOLDRow
              label="Landing over 50' obstacle"
              dep={told.results?.landing50ftObstacle.departure ?? null}
              arr={told.results?.landing50ftObstacle.arrival ?? null}
            />
            <TOLDRow
              label="Runway remaining (50' obstacle)"
              dep={told.results?.availableRunwayRemainingTakeoff50ft.departure ?? null}
              arr={told.results?.availableRunwayRemainingTakeoff50ft.arrival ?? null}
              colorNegative
            />
          </tbody>
        </table>
      )}
```

Add these module-level helpers just below the imports:

```tsx
type EnvReader = (
  s: WorksheetData,
  PAs: Triple,
  DAs: Triple,
) => [number | null, number | null, number | null];

const ENV_ROWS: ReadonlyArray<{
  label: string;
  read: EnvReader;
  fmt: (v: number | null) => string;
}> = [
  {
    label: "Actual Altitude (ft)",
    read: (s) => s.altitude,
    fmt: fmtFt,
  },
  {
    label: "OAT (°C)",
    read: (s) => s.temp,
    fmt: fmtNum,
  },
  {
    label: "Altimeter (inHg)",
    read: (s) => s.altimeter,
    fmt: (v) => (v === null ? "—" : v.toFixed(2)),
  },
  {
    label: "Pressure Alt (ft)",
    read: (_s, PAs) => PAs,
    fmt: fmtFt,
  },
  {
    label: "Density Alt (ft)",
    read: (_s, _PAs, DAs) => DAs,
    fmt: fmtFt,
  },
];

function TOLDRow({
  label,
  dep,
  arr,
  colorNegative,
}: {
  label: string;
  dep: number | null;
  arr: number | null;
  colorNegative?: boolean;
}) {
  const cellClass = (v: number | null) => {
    if (colorNegative && v !== null && v < 0) {
      return "py-0.5 text-right print-keep-color print-margin-bad text-red-700 font-semibold";
    }
    return "py-0.5 text-right";
  };
  return (
    <tr className="border-b border-slate-200">
      <td className="py-0.5 pr-2">{label}</td>
      <td className={cellClass(dep) + " pr-2"}>{fmtFt(dep)}</td>
      <td className={cellClass(arr)}>{fmtFt(arr)}</td>
    </tr>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/PrintBriefing.test.tsx`
Expected: PASS (all tests, including the new env+TOLD coverage).

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintBriefing.tsx src/components/PrintBriefing.test.tsx
git commit -m "PrintBriefing: per-phase environment and TOLD with margin coloring"
```

---

## Task 5: `PrintBriefing` — climb/V-speeds + maneuvering

**Files:**
- Modify: `src/components/PrintBriefing.tsx`
- Modify: `src/components/PrintBriefing.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `src/components/PrintBriefing.test.tsx`:

```tsx
describe("PrintBriefing — climb and V-speeds", () => {
  it("renders ROC and V-speed labels when aircraft is selected", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText(/Rate of Climb \(MGW\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Rate of Climb \(Actual/i)).toBeInTheDocument();
    expect(screen.getByText(/Vx/)).toBeInTheDocument();
    expect(screen.getByText(/Vy/)).toBeInTheDocument();
    expect(screen.getByText(/Va/)).toBeInTheDocument();
    expect(screen.getByText(/Vra/)).toBeInTheDocument();
    expect(screen.getByText(/% MGW/)).toBeInTheDocument();
  });
});

describe("PrintBriefing — maneuvering speeds", () => {
  it("renders flap × bank-angle headers when aircraft is selected", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText(/Maneuvering speeds/i)).toBeInTheDocument();
    expect(screen.getByText(/0°/)).toBeInTheDocument();
    expect(screen.getByText(/45°/)).toBeInTheDocument();
    expect(screen.getByText(/60°/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx jest src/components/PrintBriefing.test.tsx -t "climb and V-speeds"`
Expected: FAIL — `Unable to find an element with the text: Rate of Climb`.

- [ ] **Step 3: Implement the climb and maneuvering blocks**

Extend `PrintBriefing.tsx`. First add these imports at the top (alongside the existing ones):

```tsx
import aircraftData from "@/data/aircraft.json";
import {
  bilinearInterpolate,
  bilinearInterpolateFlexible,
} from "@/utils/interpolation";
import { calculateVra, calculateVx } from "@/utils/formulas";
import { calculateManeuveringSpeeds } from "@/utils/maneuveringCalculations";
import type { Aircraft } from "@/utils/types";
```

Add the climb-helper functions as module-level helpers (mirroring `ClimbPerformance.tsx`):

```tsx
function lookupAircraft(model: string): Aircraft | null {
  return (aircraftData.find((a) => a.id === model) as Aircraft | undefined) ?? null;
}

function computeClimbRow(aircraft: Aircraft, PAs: Triple, OATs: Triple): Triple {
  const rates: Triple = [null, null, null];
  for (let i = 0; i < 3; i++) {
    const pa = PAs[i];
    const oat = OATs[i];
    if (pa !== null && oat !== null) {
      try {
        rates[i] = Math.round(
          bilinearInterpolateFlexible(aircraft.climbPerformance, pa, oat, {
            xAxisName: "pressureAltitudes",
            yAxisName: "temperatures",
          }),
        );
      } catch {
        rates[i] = null;
      }
    }
  }
  return rates;
}

function vySpeed(aircraft: Aircraft, pa: number | null): number | null {
  if (pa === null) return null;
  const alts = aircraft.climbPerformance.pressureAltitudes;
  let idx = alts.findIndex((p) => p >= pa);
  if (idx === -1) idx = 0;
  return aircraft.climbPerformance.climbSpeeds[idx] ?? null;
}

function vaSpeed(aircraft: Aircraft, weight: number | null): number | null {
  if (weight === null) return null;
  return Math.round(
    bilinearInterpolate(
      {
        xAxis: [1],
        yAxis: aircraft.maneuvering.weights,
        data: [aircraft.maneuvering.Va],
      },
      1,
      weight,
    ),
  );
}
```

Add the climb and maneuvering JSX inside the `state.acType &&` guard (or as separate guarded blocks) before the closing `</section>`. Place them after the existing TOLD block:

```tsx
      {/* ---- Climb + V-speeds ---- */}
      {(() => {
        if (!state.acType) return null;
        const aircraft = lookupAircraft(state.acType);
        if (!aircraft) return null;
        const ROC = computeClimbRow(aircraft, PAs, state.temp);
        const percentMGW =
          state.weight !== null
            ? Math.round((state.weight / aircraft.maxGrossWeight) * 100)
            : null;
        const ROCActual: Triple = ROC.map((r) =>
          r === null || percentMGW === null
            ? null
            : Math.round(r * (1 + (1 - percentMGW / 100))),
        ) as Triple;
        const vra = calculateVra(aircraft);
        return (
          <table className="w-full border-collapse text-[8pt] mb-2 break-inside-avoid">
            <thead>
              <tr className="border-b border-slate-400">
                <th className="text-left pr-2 font-medium" colSpan={4}>
                  Climb &amp; V-speeds ({state.acType})
                </th>
              </tr>
              <tr className="border-b border-slate-300">
                <th className="text-left pr-2 font-medium"></th>
                <th className="text-right pr-2 font-medium">Dep</th>
                <th className="text-right pr-2 font-medium">Op</th>
                <th className="text-right font-medium">Arr</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-0.5 pr-2">Rate of Climb (MGW)</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(ROC[0])}</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(ROC[1])}</td>
                <td className="py-0.5 text-right">{fmtNum(ROC[2])}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-0.5 pr-2">Rate of Climb (Actual wt)</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(ROCActual[0])}</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(ROCActual[1])}</td>
                <td className="py-0.5 text-right">{fmtNum(ROCActual[2])}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-0.5 pr-2">Vx</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(calculateVx(aircraft, PAs[0] ?? 0))}</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(calculateVx(aircraft, PAs[1] ?? 0))}</td>
                <td className="py-0.5 text-right">{fmtNum(calculateVx(aircraft, PAs[2] ?? 0))}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-0.5 pr-2">Vy</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(vySpeed(aircraft, PAs[0]))}</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(vySpeed(aircraft, PAs[1]))}</td>
                <td className="py-0.5 text-right">{fmtNum(vySpeed(aircraft, PAs[2]))}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-0.5 pr-2">Va (actual weight)</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(vaSpeed(aircraft, state.weight))}</td>
                <td className="py-0.5 pr-2 text-right"></td>
                <td className="py-0.5 text-right"></td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-0.5 pr-2">Vra</td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(vra)}</td>
                <td className="py-0.5 pr-2 text-right"></td>
                <td className="py-0.5 text-right"></td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-0.5 pr-2">% MGW</td>
                <td className="py-0.5 pr-2 text-right">
                  {percentMGW !== null ? `${percentMGW}%` : "—"}
                </td>
                <td className="py-0.5 pr-2 text-right"></td>
                <td className="py-0.5 text-right"></td>
              </tr>
            </tbody>
          </table>
        );
      })()}

      {/* ---- Maneuvering / canyon-turn speeds ---- */}
      {(() => {
        if (!state.acType) return null;
        const ms = calculateManeuveringSpeeds(state.acType);
        if (!ms) return null;
        const banks = [0, 45, 60];
        return (
          <table className="w-full border-collapse text-[8pt] mb-2 break-inside-avoid">
            <thead>
              <tr className="border-b border-slate-400">
                <th className="text-left pr-2 font-medium" colSpan={4}>
                  Maneuvering speeds (kts) ({state.acType})
                </th>
              </tr>
              <tr className="border-b border-slate-300">
                <th className="text-left pr-2 font-medium">Flaps</th>
                {banks.map((b) => (
                  <th key={b} className="text-right pr-2 font-medium">
                    {b}°
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ms.flapSettings.map((flap) => (
                <tr key={flap} className="border-b border-slate-200">
                  <td className="py-0.5 pr-2">{flap}°</td>
                  {banks.map((b) => {
                    const found = ms.speeds.find(
                      (s) => s.flapSetting === flap && s.bankAngle === b,
                    );
                    return (
                      <td key={b} className="py-0.5 pr-2 text-right">
                        {fmtNum(found ? found.speed : null)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/PrintBriefing.test.tsx`
Expected: PASS — all sections so far render.

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintBriefing.tsx src/components/PrintBriefing.test.tsx
git commit -m "PrintBriefing: climb/V-speeds and maneuvering tables"
```

---

## Task 6: `PrintBriefing` — footer + no-aircraft fallback

**Files:**
- Modify: `src/components/PrintBriefing.tsx`
- Modify: `src/components/PrintBriefing.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `src/components/PrintBriefing.test.tsx`:

```tsx
describe("PrintBriefing — footer + no-aircraft fallback", () => {
  it("renders the 'For reference only' disclaimer", () => {
    render(<PrintBriefing state={fullState} />);
    expect(screen.getByText(/For reference only/i)).toBeInTheDocument();
  });

  it("falls back to a notice and hides performance sections when no aircraft is selected", () => {
    const noAC: WorksheetData = { ...fullState, acType: "" };
    render(<PrintBriefing state={noAC} />);
    expect(
      screen.getByText(/Select an aircraft model to print performance/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/TO Ground Roll/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Maneuvering speeds/i)).not.toBeInTheDocument();
    // Identity should still render
    expect(screen.getByText(/Loosli/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx jest src/components/PrintBriefing.test.tsx -t "footer"`
Expected: FAIL — `Unable to find an element with the text: For reference only`.

- [ ] **Step 3: Add the fallback notice and footer**

In `src/components/PrintBriefing.tsx`, immediately before the TOLD `{state.acType && (...)}` block, add the no-aircraft notice:

```tsx
      {!state.acType && (
        <p className="text-[8pt] italic text-slate-700 mb-2">
          Select an aircraft model to print performance.
        </p>
      )}
```

Add the footer just before the closing `</section>`:

```tsx
      <footer className="border-t border-slate-400 pt-1 mt-1 text-[7pt] text-slate-700 flex justify-between">
        <span>
          For reference only — PIC and FRO are responsible for the go/no-go
          decision.
        </span>
        <span>mountain-worksheet.vercel.app</span>
      </footer>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/PrintBriefing.test.tsx`
Expected: PASS — all `PrintBriefing` tests now green.

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintBriefing.tsx src/components/PrintBriefing.test.tsx
git commit -m "PrintBriefing: footer disclaimer and no-aircraft fallback"
```

---

## Task 7: `ActionBar` — `onPrint` prop and persistent Print button

**Files:**
- Modify: `src/components/ActionBar.tsx`
- Modify: `src/components/ActionBar.test.tsx`

- [ ] **Step 1: Update the existing tests and add new coverage**

Open `src/components/ActionBar.test.tsx`. Add `onPrint: jest.fn()` to `baseProps` so it looks like:

```tsx
const baseProps = {
  worksheetData: empty,
  onFetch: jest.fn(),
  fetchDisabled: false,
  isFetching: false,
  onOpenChecklist: jest.fn(),
  onPrint: jest.fn(),
};
```

Remove the line in the all-done test that asserts `Print briefing` is in the all-done state's per-state button group:

```tsx
expect(screen.getByRole("button", { name: /Print briefing/i })).toBeInTheDocument();
```

(Keep the `Acknowledge` assertion in that test.)

Append a new describe block for the persistent Print button:

```tsx
describe("ActionBar — Print trigger", () => {
  it("renders a Print briefing button visible across all states", () => {
    for (const state of ["incomplete", "ready", "fetched", "all-done"] as const) {
      const { unmount } = render(
        <ActionBar {...baseProps} state={state} fetchDisabled={state === "incomplete"} />,
      );
      expect(
        screen.getByRole("button", { name: /Print briefing/i }),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("calls onPrint when the Print briefing button is clicked", () => {
    render(<ActionBar {...baseProps} state="incomplete" fetchDisabled={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Print briefing/i }));
    expect(baseProps.onPrint).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx jest src/components/ActionBar.test.tsx -t "Print trigger"`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name /Print briefing/i` (in `incomplete`/`ready`/`fetched` states).

- [ ] **Step 3: Update the component**

Open `src/components/ActionBar.tsx`. Update the `ActionBarProps` interface to add `onPrint`:

```tsx
interface ActionBarProps {
  state: ActionBarState;
  worksheetData: WorksheetData;
  weatherLastUpdated?: Date;
  onFetch: () => void;
  fetchDisabled: boolean;
  isFetching: boolean;
  onOpenChecklist: () => void;
  onPrint: () => void;
}
```

Update the function signature to destructure `onPrint`:

```tsx
export default function ActionBar({
  state,
  worksheetData,
  weatherLastUpdated,
  onFetch,
  fetchDisabled,
  isFetching,
  onOpenChecklist,
  onPrint,
}: ActionBarProps) {
```

Inside the `all-done` block, **remove** the `Print briefing` button (the one starting `<button … <PrinterIcon … Print briefing</button>`). Leave the `Acknowledge & proceed` button.

In the persistent right cluster (the `<div className="shrink-0 pl-2.5 ml-0.5 border-l …">` at the bottom of the component), add the Print button immediately before the `Checklist` button:

```tsx
        <div className="shrink-0 pl-2.5 ml-0.5 border-l border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
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
```

(`PrinterIcon` is already imported at the top of `ActionBar.tsx`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/ActionBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionBar.tsx src/components/ActionBar.test.tsx
git commit -m "ActionBar: promote Print briefing to persistent button with onPrint prop"
```

---

## Task 8: `AppContainer` — wire Print + mount PrintBriefing + hide screen chrome

**Files:**
- Modify: `src/components/AppContainer.tsx`
- Modify: `src/components/AppContainer.test.tsx`

- [ ] **Step 1: Add failing tests**

Open `src/components/AppContainer.test.tsx`. Append:

```tsx
describe("AppContainer — print wiring", () => {
  it("renders the Print briefing button", () => {
    render(<AppContainer />);
    expect(
      screen.getByRole("button", { name: /Print briefing/i }),
    ).toBeInTheDocument();
  });

  it("calls window.print when Print briefing is clicked", () => {
    const spy = jest.spyOn(window, "print").mockImplementation(() => {});
    render(<AppContainer />);
    fireEvent.click(screen.getByRole("button", { name: /Print briefing/i }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders the PrintBriefing region in the tree", () => {
    render(<AppContainer />);
    expect(
      screen.getByRole("region", { name: /Print briefing/i }),
    ).toBeInTheDocument();
  });
});
```

You'll also need to add `fireEvent` to the imports at the top of `AppContainer.test.tsx`:

```tsx
import { render, screen, fireEvent } from "../test-utils/test-utils";
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx jest src/components/AppContainer.test.tsx -t "print wiring"`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name /Print briefing/i`.

- [ ] **Step 3: Wire up `AppContainer`**

Open `src/components/AppContainer.tsx`. Add the `PrintBriefing` import alongside the others:

```tsx
import PrintBriefing from "@/components/PrintBriefing";
```

Add a `handlePrint` callback near the other handlers (just below `handleShare`):

```tsx
  const handlePrint = () => {
    window.print();
  };
```

Pass `onPrint={handlePrint}` to `ActionBar` inside the `renderButton` render-prop:

```tsx
          <ActionBar
            state={actionBarState}
            worksheetData={state}
            weatherLastUpdated={weatherLastUpdated ?? undefined}
            onFetch={onClick}
            fetchDisabled={disabled}
            isFetching={isLoading}
            onOpenChecklist={handleOpenChecklist}
            onPrint={handlePrint}
          />
```

Add `print:hidden` to the screen-only regions. Update these elements:

```tsx
      <WorksheetHeader
        // …existing props…
        // (no className change needed — WorksheetHeader's <header> handles its own; see below)
      />
      <Stepper steps={steps} />
      <WeatherDataIntegration
        // …existing props (ActionBar is rendered inside renderButton)…
      />
      <main className="flex-1 w-full flex justify-center pb-20 print:hidden">
        {/* existing content unchanged */}
      </main>
      <SlideOver
        isOpen={overlay === "instructions"}
        onClose={handleCloseOverlay}
        title="Instructions & Operational Notes"
      >
        <InstructionsPanel />
      </SlideOver>
      <SlideOver
        isOpen={overlay === "checklist"}
        onClose={handleCloseOverlay}
        title="Mountain Flying Checklist"
      >
        <ChecklistPanel />
      </SlideOver>
      <PrintBriefing state={state} />
      <footer className="w-full py-4 px-2 md:px-8 text-center text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 print:hidden">
        {/* existing footer content unchanged */}
      </footer>
```

Add `print:hidden` to the surrounding `<div>` of `WorksheetHeader.tsx`'s `<header>` element. Open `src/components/WorksheetHeader.tsx` and change:

```tsx
    <header className="w-full bg-slate-900 text-white shadow-md">
```

to:

```tsx
    <header className="w-full bg-slate-900 text-white shadow-md print:hidden">
```

Add `print:hidden` to `Stepper.tsx`'s root `<nav>`. Open `src/components/Stepper.tsx` and change line 76 from:

```tsx
      className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/75"
```

to:

```tsx
      className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/75 print:hidden"
```

Add `print:hidden` to the `ActionBar` sticky wrapper. Open `src/components/ActionBar.tsx` and update its outer `<div>` className from:

```tsx
    <div className="sticky top-[44px] z-10 border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_8px_-6px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900">
```

to:

```tsx
    <div className="sticky top-[44px] z-10 border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_8px_-6px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 print:hidden">
```

- [ ] **Step 4: Run the full test suite to verify everything passes**

Run: `npm test`
Expected: PASS — all suites, including the new `AppContainer` print-wiring tests and the existing tests that weren't touched.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppContainer.tsx src/components/AppContainer.test.tsx src/components/WorksheetHeader.tsx src/components/Stepper.tsx src/components/ActionBar.tsx
git commit -m "AppContainer: mount PrintBriefing, wire window.print(), hide screen chrome from print"
```

---

## Task 9: Lint, build, and manual print verification

**Files:**
- None (verification only).

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: PASS — Next.js builds without TypeScript errors.

- [ ] **Step 3: Start the dev server and verify in a browser**

Run (in a separate terminal): `npm run dev`

Open `http://localhost:3000` and fill out a realistic sortie:
- Pilot, AC type (e.g., T182T), tail number, date/time, departure/arrival, route, position
- Some weather (winds aloft + an AIRMET flag)
- Per-phase environmentals (OAT, altimeter, altitude, runway lengths)
- Weight

Click **Print briefing**. In the browser print preview:

- Confirm the printed output fits on a single US letter portrait page.
- Confirm none of these are visible in the preview: the dark header, the Stepper, the sticky ActionBar, the open/closed slide-overs, the bottom footer.
- Confirm the briefing shows: title strip, identity line, route line, winds aloft, AIRMET chips, per-phase env table, TOLD, climb/V-speeds, maneuvering speeds, and the "For reference only" footer.
- Confirm that a negative `Runway remaining` cell prints in red.

Repeat in Safari and Firefox on macOS.

- [ ] **Step 4: Open the PR**

(After all of the above are green.)

```bash
git push -u origin worktree-issue-122-print-pdf
gh pr create --title "Fix #122: single-page print briefing" --body "$(cat <<'EOF'
## Summary
- Adds a dedicated `<PrintBriefing>` component that renders only when printing, producing a one-page US letter briefing.
- Wires the existing inert `Print briefing` button to `window.print()` and promotes it to a persistent action-bar button.
- Replaces the multi-page print stylesheet (which expanded the Instructions and Checklist slide-overs as appendices) with a single-page reset.

## Test plan
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Filled sortie prints to a single page in Chrome on macOS
- [ ] Same in Safari and Firefox
- [ ] Negative runway-remaining cell stays red in print

Closes #122.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist (for the implementer)

- [ ] Every section in the spec maps to at least one task (identity/route/quals → T2; weather → T3; env+TOLD → T4; climb/V-speeds + maneuvering → T5; footer + no-aircraft fallback → T6; button wiring → T7+T8; print reset CSS → T1).
- [ ] No `TBD` / `TODO` placeholders remain.
- [ ] Type names match across tasks: `Triple`, `WorksheetData`, `Aircraft`.
- [ ] Function and prop names match across tasks: `onPrint`, `handlePrint`, `PrintBriefing`, `computePressureColumns`, `computeTOLDViewModel`, `calculateManeuveringSpeeds`.
- [ ] Each task ends with a single `git commit`; no task batches multiple unrelated changes.
- [ ] Final acceptance is a manual print-preview check on Chrome / Safari / Firefox, plus a green `npm test` + `npm run lint` + `npm run build`.
