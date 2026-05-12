# Worksheet UI Redesign — Phase 4: Weather Merge + AirportCard + Runway Dropdown

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-component (`WeatherInfo` + `AircraftPerformance`) Step 2 body with a single `WeatherSection` that has three sub-headings — **Aloft** (winds aloft table), **At airports** (three `AirportCard`s), **Advisories** (three checkboxes). Introduce a runway dropdown on each airport card whose options come from the fetched airport data and whose default selection is the shortest non-helipad runway.

**Architecture:** A new `AirportCard` component renders one of three variants — `departure`, `operating`, or `arrival` — each composing the same row primitives (label + value/input) but with different field sets. A new `WeatherSection` component composes three internal blocks under their Tailwind `uppercase` headings: an inline winds-aloft table (ported verbatim from `WeatherInfo`), a 3-column grid of `AirportCard`s, and an inline advisories block (ported verbatim from `WeatherInfo`). The runway dropdown options live in a new top-level local state in `AppContainer` (`airportRunways: [RunwayOption[] | null, RunwayOption[] | null]`), populated via a new `onAirportInfoUpdate` callback on `WeatherDataIntegration` that fires after each successful fetch. `rwy[0|1]` continues to store only the *selected runway length* — the mapper already defaults it to the shortest, so the dropdown simply surfaces the existing data. After wiring, `WeatherInfo.tsx`, `WeatherInfo.test.tsx`, `AircraftPerformance.tsx`, and `AircraftPerformance.test.tsx` are deleted.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `@heroicons/react/24/outline` (existing), Jest + Testing Library.

**Read before starting:** `docs/superpowers/plans/2026-05-11-worksheet-ui-redesign-index.md` for series context, the Phase 3 plan `docs/superpowers/plans/2026-05-12-worksheet-ui-3-action-bar.md` for the action-bar/derived-state baseline this builds on, and `docs/numbered-step-shell-mockup.html` — specifically the Step 2 body (lines ~411–582). The three sub-headings (`Aloft`, `At airports`, `Advisories`) use the same `text-xs font-semibold uppercase tracking-wider text-slate-500` style established in Phase 2's Sortie Details (Pilot & Aircraft / When / Where / Pilot Qualifications). The three airport cards live in a `grid grid-cols-1 md:grid-cols-3 gap-3` and share the same outer chrome (`rounded-lg border border-slate-200 bg-white`); only the bottom half differs by variant.

---

## File Structure

**Create:**

- `src/components/AirportCard.tsx` — one airport card; variant prop (`departure | operating | arrival`) picks the bottom-half field set. Departure/arrival show field elevation + runway dropdown; operating shows the cruise altitude with a deep-link back to Step 1.
- `src/components/AirportCard.test.tsx` — colocated tests covering the three variants, the runway dropdown rendering, helipad filtering, and change callbacks.
- `src/components/WeatherSection.tsx` — Step 2 composition. Renders the three sub-heading blocks plus the legend chip; replaces both `WeatherInfo` and `AircraftPerformance` mounts. Includes private `WindsAloftTable` and `WeatherAdvisories` subcomponents in the same file (not exported — they have no other call sites).
- `src/components/WeatherSection.test.tsx` — colocated tests covering the three sub-heading anchors, dropdown wiring, and that user updates flow through `onUpdate`.

**Modify:**

- `src/utils/types.ts` — add the `RunwayOption` type used by `AirportCard` + `WeatherSection` + `AppContainer`.
- `src/components/WeatherDataIntegration.tsx` — add `onAirportInfoUpdate?: (info: { departure: RunwayOption[] | null; arrival: RunwayOption[] | null }) => void` prop; call it after the API resolves, before `onDataUpdate`.
- `src/components/AppContainer.tsx` — add `airportRunways` local state, wire it via `onAirportInfoUpdate`, pass it to `AppInputs`.
- `src/components/AppInputs.tsx` — accept `airportRunways` prop; replace `<WeatherInfo>` + `<AircraftPerformance>` with `<WeatherSection>`.
- `src/components/AppInputs.test.tsx` — replace the two child mocks (`WeatherInfo`, `AircraftPerformance`) with one `WeatherSection` mock; update the assertions that referenced the old test ids.

**Delete:**

- `src/components/WeatherInfo.tsx`
- `src/components/WeatherInfo.test.tsx`
- `src/components/AircraftPerformance.tsx`
- `src/components/AircraftPerformance.test.tsx`

**Out of scope (do not add here):**

- StepShell card-header badge (`Fetched 14:31 UTC`) — deferred, same as Phase 3.
- The legend chip text "Blue cells fetched from aviationweather.gov — type to override" is rendered, but the existing blue-vs-manual styling logic is ported verbatim from `WeatherInfo`/`AircraftPerformance` — no new logic.
- The deep-link arrow on the Operating card (`<a href="#step-sortie">`) routes to Step 1 — this is a plain anchor; scroll-margin/scroll-spy is already wired from Phase 1.
- Print stylesheet, "For reference only" disclaimer, slide-overs — Phase 5.
- AIRMET flag echoes in the Decision/Go-No-Go panel — separate follow-up.
- Storing the runway list in URL state — `airportRunways` is local-only; sharing a URL preserves the *selected* runway length but a re-fetch is needed to repopulate the dropdown options. Acceptable trade-off: the dropdown is purely a UI affordance for changing the default; calculations only use `rwy[i]`.

---

## Task 1: Surface airport runway info from `WeatherDataIntegration`

**Files:**
- Modify: `src/utils/types.ts`
- Modify: `src/components/WeatherDataIntegration.tsx`

Goal: when a weather fetch resolves, the integration component should also surface the list of runways for each airport so `AppContainer` can populate the dropdown options. No existing behaviour changes — this is a pure additive callback.

- [ ] **Step 1: Add the `RunwayOption` type**

Open `src/utils/types.ts` and append at the end of the file:

```ts
/**
 * Minimal runway shape used by AirportCard's runway dropdown. A subset of
 * AirportResponse.runway from the AviationWeather API — only what the UI
 * needs to render the option label (id + length) and filter out helipads
 * (alignment === null).
 */
export interface RunwayOption {
  id: string;
  length: number;
  alignment: number | null;
}
```

- [ ] **Step 2: Add `onAirportInfoUpdate` prop to `WeatherDataIntegration`**

In `src/components/WeatherDataIntegration.tsx`, update the imports near the top to include `RunwayOption`:

```tsx
import type { RunwayOption, WorksheetData } from "@/utils/types";
```

Then add the new optional prop to the `WeatherDataIntegrationProps` interface (around line 34):

```tsx
interface WeatherDataIntegrationProps {
  worksheetData: Partial<WorksheetData>;
  onDataUpdate: (data: Partial<WorksheetData>) => void;
  onTimestampUpdate?: (timestamp: Date) => void;
  onAirportInfoUpdate?: (info: {
    departure: RunwayOption[] | null;
    arrival: RunwayOption[] | null;
  }) => void;
  disabled?: boolean;
  hideBox?: boolean;
  renderButton?: (props: {
    onClick: () => void;
    disabled: boolean;
    isLoading: boolean;
  }) => ReactNode;
}
```

Destructure the new prop in the component signature (around line 61):

```tsx
export default function WeatherDataIntegration({
  worksheetData,
  onDataUpdate,
  onTimestampUpdate,
  onAirportInfoUpdate,
  disabled = false,
  hideBox = false,
  renderButton,
}: WeatherDataIntegrationProps) {
```

- [ ] **Step 3: Fire the callback after the API resolves**

The `apiAirports` array is already available locally inside `fetchWeatherData` (currently used at line ~140 to look up lat/lon). Extend that block so it also surfaces runway info. Find the existing `findAirport` helper (around line 145–148) and the `depAirport` / `arrAirport` lookups (lines 147–148). Immediately after those two assignments, add:

```tsx
        if (onAirportInfoUpdate) {
          const extractRunways = (
            airport:
              | {
                  runway?: Array<{
                    id: string;
                    length: number;
                    alignment: number | null;
                  }>;
                }
              | undefined
          ): RunwayOption[] | null => {
            if (!airport?.runway || airport.runway.length === 0) return null;
            return airport.runway.map((r) => ({
              id: r.id,
              length: r.length,
              alignment: r.alignment,
            }));
          };
          onAirportInfoUpdate({
            departure: extractRunways(depAirport as { runway?: Array<{ id: string; length: number; alignment: number | null }> }),
            arrival: extractRunways(arrAirport as { runway?: Array<{ id: string; length: number; alignment: number | null }> }),
          });
        }
```

Note: `depAirport` and `arrAirport` are typed as `{ icaoId: string; lat: number; lon: number }` at the existing call site because that's all lat/lon math needs. The cast above narrows them to the runway-bearing shape — the underlying API response already carries `runway`, the local type is just narrower than reality.

Also add `onAirportInfoUpdate` to the `useCallback` dependency array at the end of `fetchWeatherData` (currently `[worksheetData, onDataUpdate, canFetchWeather, onTimestampUpdate]`). It becomes:

```tsx
    [worksheetData, onDataUpdate, canFetchWeather, onTimestampUpdate, onAirportInfoUpdate]
```

- [ ] **Step 4: Run the existing test suite to verify nothing broke**

Run: `npx jest src/components/WeatherDataIntegration`
Expected: PASS — no behaviour change for callers that don't pass the new prop.

- [ ] **Step 5: Commit**

```bash
git add src/utils/types.ts src/components/WeatherDataIntegration.tsx
git commit -m "Surface runway info from WeatherDataIntegration

Adds optional onAirportInfoUpdate callback. After each successful
fetch the component now hands the departure/arrival runway lists
(id + length + alignment) up to the parent, alongside the existing
onDataUpdate / onTimestampUpdate callbacks. No-op for callers that
don't pass the new prop; consumed in the next commit."
```

---

## Task 2: Store `airportRunways` in `AppContainer`

**Files:**
- Modify: `src/components/AppContainer.tsx`

Goal: hold the runway lists in local state so they can flow down to `AirportCard` via `AppInputs` → `WeatherSection`.

- [ ] **Step 1: Update imports**

In `src/components/AppContainer.tsx`, change the type import (currently `import type { WorksheetData } from "@/utils/types";`) to:

```tsx
import type { RunwayOption, WorksheetData } from "@/utils/types";
```

- [ ] **Step 2: Add the `airportRunways` state**

Inside the `AppContainer()` function body, immediately after the line `const [weatherLastUpdated, setWeatherLastUpdated] = useState<Date | null>(null);`, add:

```tsx
  const [airportRunways, setAirportRunways] = useState<
    [RunwayOption[] | null, RunwayOption[] | null]
  >([null, null]);

  const handleAirportInfoUpdate = (info: {
    departure: RunwayOption[] | null;
    arrival: RunwayOption[] | null;
  }) => {
    setAirportRunways([info.departure, info.arrival]);
  };
```

- [ ] **Step 3: Wire the callback on `<WeatherDataIntegration>`**

Find the existing `<WeatherDataIntegration>` block in the JSX (currently has `worksheetData`, `onDataUpdate`, `onTimestampUpdate`, `hideBox`, `renderButton`). Add `onAirportInfoUpdate` right after `onTimestampUpdate`:

```tsx
      <WeatherDataIntegration
        worksheetData={state}
        onDataUpdate={handleWeatherDataUpdate}
        onTimestampUpdate={handleWeatherTimestampUpdate}
        onAirportInfoUpdate={handleAirportInfoUpdate}
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

- [ ] **Step 4: Run the AppContainer test**

Run: `npx jest src/components/AppContainer.test.tsx`
Expected: PASS — no test changes; `AppContainer` rendering is unchanged. The new state is wired but not yet consumed by any child; Task 5 threads it through `<AppInputs>`.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppContainer.tsx
git commit -m "Hold airportRunways in AppContainer

Adds local (non-URL) state for the runway lists surfaced by
WeatherDataIntegration's new onAirportInfoUpdate callback. Not yet
consumed — Task 5 threads it through AppInputs to the new
AirportCard dropdowns. Selected runway length stays in
WorksheetData.rwy (URL state); the option list is ephemeral and
re-populates on each fetch."
```

---

## Task 3: `AirportCard` component

**Files:**
- Create: `src/components/AirportCard.tsx`
- Create: `src/components/AirportCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/AirportCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import AirportCard from "./AirportCard";
import type { RunwayOption } from "@/utils/types";

const noOp = () => {};

const baseProps = {
  temperature: null,
  altimeter: null,
  onTemperatureChange: noOp,
  onAltimeterChange: noOp,
  apiPopulated: { temperature: false, pressure: false, runway: false },
  useFahrenheit: false,
};

describe("AirportCard — departure variant", () => {
  it("renders the airport code in the header", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
      />
    );
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("KOGD")).toBeInTheDocument();
  });

  it("renders the field elevation when provided", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
      />
    );
    expect(screen.getByText(/4,473 ft/)).toBeInTheDocument();
  });

  it("renders the runway dropdown with id + length options, helipads excluded", () => {
    const runways: RunwayOption[] = [
      { id: "16/34", length: 5500, alignment: 160 },
      { id: "03/21", length: 8103, alignment: 30 },
      { id: "H1", length: 60, alignment: null }, // helipad
    ];
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
        runways={runways}
        selectedRunwayLength={5500}
        onRunwaySelect={noOp}
      />
    );
    const select = screen.getByRole("combobox", { name: /Runway/i });
    const options = Array.from(
      select.querySelectorAll("option")
    ) as HTMLOptionElement[];
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toMatch(/16\/34/);
    expect(options[0].textContent).toMatch(/5,500/);
    expect(options[1].textContent).toMatch(/03\/21/);
    expect(options[1].textContent).toMatch(/8,103/);
    expect(select).toHaveValue("5500");
  });

  it("renders a 'Not fetched' placeholder when runways is null", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
        runways={null}
        selectedRunwayLength={null}
        onRunwaySelect={noOp}
      />
    );
    expect(screen.queryByRole("combobox", { name: /Runway/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Fetch weather to load runways/i)).toBeInTheDocument();
  });

  it("calls onRunwaySelect with the chosen runway length", () => {
    const onRunwaySelect = jest.fn();
    const runways: RunwayOption[] = [
      { id: "16/34", length: 5500, alignment: 160 },
      { id: "03/21", length: 8103, alignment: 30 },
    ];
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
        runways={runways}
        selectedRunwayLength={5500}
        onRunwaySelect={onRunwaySelect}
      />
    );
    fireEvent.change(screen.getByRole("combobox", { name: /Runway/i }), {
      target: { value: "8103" },
    });
    expect(onRunwaySelect).toHaveBeenCalledWith(8103);
  });

  it("calls onTemperatureChange and onAltimeterChange on input", () => {
    const onTemperatureChange = jest.fn();
    const onAltimeterChange = jest.fn();
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
        temperature={20}
        altimeter={29.92}
        onTemperatureChange={onTemperatureChange}
        onAltimeterChange={onAltimeterChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/Temperature/i), {
      target: { value: "22" },
    });
    expect(onTemperatureChange).toHaveBeenCalledWith("22");
    fireEvent.change(screen.getByLabelText(/Altimeter/i), {
      target: { value: "30.01" },
    });
    expect(onAltimeterChange).toHaveBeenCalledWith("30.01");
  });
});

describe("AirportCard — operating variant", () => {
  it("renders the operating header and altitude link to step-sortie", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="operating"
        operatingAltitude={11500}
      />
    );
    expect(screen.getByText("Operating")).toBeInTheDocument();
    const altitudeLink = screen.getByRole("link", { name: /11,500 ft/i });
    expect(altitudeLink).toHaveAttribute("href", "#step-sortie");
  });

  it("does not render runway dropdown or field elev for operating variant", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="operating"
        operatingAltitude={11500}
      />
    );
    expect(screen.queryByRole("combobox", { name: /Runway/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Field elev/i)).not.toBeInTheDocument();
  });
});

describe("AirportCard — arrival variant", () => {
  it("renders the arrival header with the airport code", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="arrival"
        airportCode="KLGU"
        fieldElev={4457}
      />
    );
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("KLGU")).toBeInTheDocument();
    expect(screen.getByText(/4,457 ft/)).toBeInTheDocument();
  });
});

describe("AirportCard — useFahrenheit", () => {
  it("displays the stored Celsius value converted to Fahrenheit", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        temperature={20} // 20 °C = 68 °F
        useFahrenheit={true}
      />
    );
    const tempInput = screen.getByLabelText(/Temperature/i) as HTMLInputElement;
    expect(tempInput.value).toBe("68");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/AirportCard.test.tsx`
Expected: FAIL — `Cannot find module './AirportCard'`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/AirportCard.tsx
"use client";

import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import type { RunwayOption } from "@/utils/types";
import { celciusToFarenheit } from "@/utils/formulas";

type AirportCardVariant = "departure" | "operating" | "arrival";

interface AirportCardCommonProps {
  variant: AirportCardVariant;
  temperature: number | null;
  altimeter: number | null;
  onTemperatureChange: (value: string) => void;
  onAltimeterChange: (value: string) => void;
  apiPopulated: { temperature: boolean; pressure: boolean; runway: boolean };
  useFahrenheit?: boolean;
}

interface AirportCardAirportProps extends AirportCardCommonProps {
  variant: "departure" | "arrival";
  airportCode?: string;
  fieldElev?: number | null;
  runways?: RunwayOption[] | null;
  selectedRunwayLength?: number | null;
  onRunwaySelect?: (length: number) => void;
}

interface AirportCardOperatingProps extends AirportCardCommonProps {
  variant: "operating";
  operatingAltitude?: number | null;
}

type AirportCardProps = AirportCardAirportProps | AirportCardOperatingProps;

const formatTemperatureValue = (
  stored: number | null,
  useFahrenheit: boolean
): string => {
  if (stored === null || stored === undefined) return "";
  if (useFahrenheit) return Math.round(celciusToFarenheit(stored)).toString();
  return parseFloat(stored.toFixed(1)).toString();
};

const formatThousands = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const cellInputClass = (apiPopulated: boolean): string => {
  const base =
    "num-mono text-right rounded px-2 py-1 w-24 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";
  return apiPopulated
    ? `${base} bg-blue-50 border border-blue-300 dark:bg-blue-900/20 dark:border-blue-600`
    : `${base} bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-600`;
};

const headerVariantLabel: Record<AirportCardVariant, string> = {
  departure: "Departure",
  operating: "Operating",
  arrival: "Arrival",
};

export default function AirportCard(props: AirportCardProps) {
  const variantLabel = headerVariantLabel[props.variant];

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
      <header className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-baseline justify-between gap-2 dark:bg-slate-800 dark:border-slate-700">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {variantLabel}
        </span>
        {props.variant === "operating" ? (
          <span className="text-xs text-slate-500">Cruise · area of ops</span>
        ) : (
          <span className="num-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            {props.airportCode || "—"}
          </span>
        )}
      </header>
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`temp-${props.variant}`}
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
          >
            Temperature
          </label>
          <input
            id={`temp-${props.variant}`}
            type="number"
            value={formatTemperatureValue(props.temperature, !!props.useFahrenheit)}
            onChange={(e) => props.onTemperatureChange(e.target.value)}
            min={props.useFahrenheit ? "-22" : "-30"}
            max={props.useFahrenheit ? "131" : "55"}
            className={cellInputClass(
              props.variant !== "operating" && props.apiPopulated.temperature
            )}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`alt-${props.variant}`}
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
          >
            Altimeter
          </label>
          <input
            id={`alt-${props.variant}`}
            type="number"
            step="0.01"
            min="28.00"
            max="31.00"
            value={props.altimeter ?? ""}
            onChange={(e) => props.onAltimeterChange(e.target.value)}
            className={cellInputClass(
              props.variant !== "operating" && props.apiPopulated.pressure
            )}
          />
        </div>

        <div className="border-t border-dashed border-slate-200 -mx-4 dark:border-slate-700"></div>

        {props.variant === "operating" ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Altitude
            </span>
            <a
              href="#step-sortie"
              title="Set in Sortie Details"
              className="num-mono text-sm text-slate-900 dark:text-slate-100 inline-flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-400 group"
            >
              {props.operatingAltitude !== null && props.operatingAltitude !== undefined
                ? `${formatThousands(props.operatingAltitude)} ft`
                : "—"}
              <ArrowUpRightIcon className="h-3 w-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
            </a>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Field elev
              </span>
              <span className="num-mono text-sm text-slate-900 dark:text-slate-100">
                {props.fieldElev !== null && props.fieldElev !== undefined
                  ? `${formatThousands(props.fieldElev)} ft`
                  : "—"}
              </span>
            </div>
            <RunwayRow
              runways={props.runways ?? null}
              selectedLength={props.selectedRunwayLength ?? null}
              onSelect={props.onRunwaySelect}
              variant={props.variant}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface RunwayRowProps {
  runways: RunwayOption[] | null;
  selectedLength: number | null;
  onSelect?: (length: number) => void;
  variant: "departure" | "arrival";
}

function RunwayRow({
  runways,
  selectedLength,
  onSelect,
  variant,
}: RunwayRowProps) {
  // Filter helipads (alignment === null) from the list.
  const validRunways = runways?.filter((r) => r.alignment !== null) ?? null;

  return (
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor={`rwy-${variant}`}
        className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
      >
        Runway
      </label>
      {!validRunways || validRunways.length === 0 ? (
        <span className="text-xs text-slate-400 italic">
          Fetch weather to load runways
        </span>
      ) : (
        <select
          id={`rwy-${variant}`}
          value={selectedLength ?? ""}
          onChange={(e) => onSelect?.(Number(e.target.value))}
          className="num-mono text-right bg-white border border-slate-300 rounded px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          {validRunways.map((r) => (
            <option key={r.id} value={r.length}>
              {r.id} · {formatThousands(r.length)} ft
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
```

Notes on the implementation:
- The Fahrenheit conversion uses the existing `celciusToFarenheit` helper from `src/utils/formulas`. Worksheet state always stores °C, the UI swaps presentation only.
- API-populated styling (`bg-blue-50 border-blue-300`) is applied only for the `departure` and `arrival` variants — `operating` is manual-entry, matching the existing `AircraftPerformance` behaviour at line ~159–168.
- The runway dropdown's `value` is the runway length (number, coerced to string by `<select>`). Length is unique enough at a single airport for the dropdown UX; if a real-world airport has two runways with identical length, the first one in API order wins — acceptable for v1.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/AirportCard.test.tsx`
Expected: PASS — all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/AirportCard.tsx src/components/AirportCard.test.tsx
git commit -m "Add AirportCard component with departure/operating/arrival variants

Card-shaped airport block matching the Step 2 'At airports' grid in
the mockup. Departure/arrival show field elevation + a runway
dropdown populated from RunwayOption[] (helipads filtered, default
value = current selected length). Operating shows a deep-link to
Step 1 for the cruise altitude. Blue cells highlight API-populated
temperature + altimeter for dep/arr; operating stays plain bg-white
since it's manual entry."
```

---

## Task 4: `WeatherSection` composition

**Files:**
- Create: `src/components/WeatherSection.tsx`
- Create: `src/components/WeatherSection.test.tsx`

`WeatherSection` is the Step 2 body. It renders the legend chip and three sub-sections — **Aloft**, **At airports**, **Advisories** — and is the single child mounted inside the Step 2 `StepShell` in `AppInputs`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/WeatherSection.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import WeatherSection from "./WeatherSection";
import type { RunwayOption, WorksheetData } from "@/utils/types";

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
  wind: [
    Array(5).fill(null) as (number | null)[],
    Array(5).fill(null) as (number | null)[],
    Array(5).fill(null) as (number | null)[],
  ] as [(number | null)[], (number | null)[], (number | null)[]],
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

const populated: WorksheetData = {
  ...empty,
  airport: ["KOGD", "KLGU"],
  temp: [20, 5, 18],
  altimeter: [29.92, 29.92, 29.92],
  altitude: [4473, 11500, 4457],
  rwy: [5500, 5861],
};

describe("WeatherSection — sub-headings", () => {
  it("renders the three sub-headings", () => {
    render(
      <WeatherSection
        state={empty}
        onUpdate={() => {}}
        airportRunways={[null, null]}
      />
    );
    expect(screen.getByText("Aloft")).toBeInTheDocument();
    expect(screen.getByText("At airports")).toBeInTheDocument();
    expect(screen.getByText("Advisories")).toBeInTheDocument();
  });

  it("renders three airport cards under 'At airports'", () => {
    render(
      <WeatherSection
        state={populated}
        onUpdate={() => {}}
        airportRunways={[null, null]}
      />
    );
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("Operating")).toBeInTheDocument();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("KOGD")).toBeInTheDocument();
    expect(screen.getByText("KLGU")).toBeInTheDocument();
  });
});

describe("WeatherSection — runway dropdown wiring", () => {
  it("renders runway options from airportRunways and updates rwy on change", () => {
    const onUpdate = jest.fn();
    const depRunways: RunwayOption[] = [
      { id: "16/34", length: 5500, alignment: 160 },
      { id: "03/21", length: 8103, alignment: 30 },
    ];
    render(
      <WeatherSection
        state={populated}
        onUpdate={onUpdate}
        airportRunways={[depRunways, null]}
      />
    );
    const select = screen.getAllByRole("combobox", { name: /Runway/i })[0];
    fireEvent.change(select, { target: { value: "8103" } });
    expect(onUpdate).toHaveBeenCalledWith({ rwy: [8103, 5861] });
  });
});

describe("WeatherSection — advisories", () => {
  it("renders three advisory checkboxes and toggles on click", () => {
    const onUpdate = jest.fn();
    render(
      <WeatherSection
        state={populated}
        onUpdate={onUpdate}
        airportRunways={[null, null]}
      />
    );
    const turbCheckbox = screen.getByLabelText(/AIRMET Tango/i);
    fireEvent.click(turbCheckbox);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ turb: true })
    );
  });
});

describe("WeatherSection — winds aloft", () => {
  it("renders the 5-column aloft table with the right altitude headers", () => {
    render(
      <WeatherSection
        state={empty}
        onUpdate={() => {}}
        airportRunways={[null, null]}
      />
    );
    expect(screen.getByText(/3,000/)).toBeInTheDocument();
    expect(screen.getByText(/6,000/)).toBeInTheDocument();
    expect(screen.getByText(/9,000/)).toBeInTheDocument();
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
    expect(screen.getByText(/15,000/)).toBeInTheDocument();
  });

  it("calls onUpdate with the new wind array when a cell changes", () => {
    const onUpdate = jest.fn();
    render(
      <WeatherSection
        state={empty}
        onUpdate={onUpdate}
        airportRunways={[null, null]}
      />
    );
    // First wind-direction input — the 3,000 ft column.
    const dirInputs = screen.getAllByLabelText(/Wind direction at/i);
    fireEvent.change(dirInputs[0], { target: { value: "270" } });
    expect(onUpdate).toHaveBeenCalled();
    const call = onUpdate.mock.calls[0][0];
    expect(call.wind[0][0]).toBe(270);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/WeatherSection.test.tsx`
Expected: FAIL — `Cannot find module './WeatherSection'`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/WeatherSection.tsx
"use client";

import AirportCard from "@/components/AirportCard";
import { isApiPopulatedData } from "@/utils/weatherDataMapper";
import { celciusToFarenheit, farenheitToCelcius } from "@/utils/formulas";
import type { RunwayOption, WorksheetData } from "@/utils/types";

interface WeatherSectionProps {
  state: WorksheetData;
  onUpdate: (data: Partial<WorksheetData>) => void;
  airportRunways: [RunwayOption[] | null, RunwayOption[] | null];
  useFahrenheit?: boolean;
}

const ALOFT_ALTITUDES = ["3,000", "6,000", "9,000", "12,000", "15,000"];

export default function WeatherSection({
  state,
  onUpdate,
  airportRunways,
  useFahrenheit = false,
}: WeatherSectionProps) {
  const apiPopulated = isApiPopulatedData(state);

  const handleWindChange = (
    row: 0 | 1 | 2,
    col: number,
    rawValue: string
  ) => {
    const numValue: number | null = rawValue === "" ? null : Number(rawValue);
    let isValid = true;
    if (numValue !== null) {
      if (row === 0) isValid = numValue >= 0 && numValue <= 359 && Number.isInteger(numValue);
      else if (row === 1) isValid = numValue >= 0 && numValue <= 150 && Number.isInteger(numValue);
      else {
        const celsiusValue = useFahrenheit ? farenheitToCelcius(numValue) : numValue;
        isValid = celsiusValue >= -50 && celsiusValue <= 50;
      }
    }
    if (!isValid) return;
    const stored = row === 2 && numValue !== null && useFahrenheit
      ? farenheitToCelcius(numValue)
      : numValue;
    const newWind = state.wind.map((arr) => [...arr]) as [
      (number | null)[],
      (number | null)[],
      (number | null)[],
    ];
    newWind[row][col] = stored;
    onUpdate({ wind: newWind });
  };

  const handleAirportTempChange = (
    index: 0 | 1 | 2,
    rawValue: string
  ) => {
    const num = rawValue === "" ? null : Number(rawValue);
    const stored = num !== null && useFahrenheit ? farenheitToCelcius(num) : num;
    const next = [...state.temp] as [number | null, number | null, number | null];
    next[index] = stored;
    onUpdate({ temp: next });
  };

  const handleAirportAltimeterChange = (
    index: 0 | 1 | 2,
    rawValue: string
  ) => {
    const num = rawValue === "" ? null : Number(rawValue);
    const isValid = num === null || (num >= 28.0 && num <= 31.0);
    const next = [...state.altimeter] as [
      number | null,
      number | null,
      number | null,
    ];
    next[index] = isValid ? num : null;
    onUpdate({ altimeter: next });
  };

  const handleRunwaySelect = (index: 0 | 1, length: number) => {
    const next = [...state.rwy] as [number | null, number | null];
    next[index] = length;
    onUpdate({ rwy: next });
  };

  const handleAdvisoryToggle = (
    field: "turb" | "cielVis" | "mtnObsc"
  ) => {
    onUpdate({ [field]: !state[field] } as Partial<WorksheetData>);
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 text-blue-900 px-2.5 py-1 text-xs dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100">
        <span className="inline-block h-3 w-3 rounded-sm bg-blue-100 border border-blue-400 dark:bg-blue-900/40 dark:border-blue-600"></span>
        Blue cells fetched from{" "}
        <a
          href="https://aviationweather.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline"
        >
          aviationweather.gov
        </a>{" "}
        — type to override
      </div>

      <WindsAloftBlock
        wind={state.wind}
        apiPopulatedWind={apiPopulated.wind}
        apiPopulatedTemp={apiPopulated.temperature}
        useFahrenheit={useFahrenheit}
        onChange={handleWindChange}
      />

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          At airports
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AirportCard
            variant="departure"
            airportCode={state.airport[0]}
            fieldElev={state.altitude[0]}
            temperature={state.temp[0]}
            altimeter={state.altimeter[0]}
            useFahrenheit={useFahrenheit}
            apiPopulated={apiPopulated}
            onTemperatureChange={(v) => handleAirportTempChange(0, v)}
            onAltimeterChange={(v) => handleAirportAltimeterChange(0, v)}
            runways={airportRunways[0]}
            selectedRunwayLength={state.rwy[0]}
            onRunwaySelect={(length) => handleRunwaySelect(0, length)}
          />
          <AirportCard
            variant="operating"
            operatingAltitude={state.altitude[1]}
            temperature={state.temp[1]}
            altimeter={state.altimeter[1]}
            useFahrenheit={useFahrenheit}
            apiPopulated={apiPopulated}
            onTemperatureChange={(v) => handleAirportTempChange(1, v)}
            onAltimeterChange={(v) => handleAirportAltimeterChange(1, v)}
          />
          <AirportCard
            variant="arrival"
            airportCode={state.airport[1]}
            fieldElev={state.altitude[2]}
            temperature={state.temp[2]}
            altimeter={state.altimeter[2]}
            useFahrenheit={useFahrenheit}
            apiPopulated={apiPopulated}
            onTemperatureChange={(v) => handleAirportTempChange(2, v)}
            onAltimeterChange={(v) => handleAirportAltimeterChange(2, v)}
            runways={airportRunways[1]}
            selectedRunwayLength={state.rwy[1]}
            onRunwaySelect={(length) => handleRunwaySelect(1, length)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Advisories
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.turb}
              onChange={() => handleAdvisoryToggle("turb")}
              className="rounded border-slate-300"
            />
            <span>
              AIRMET Tango (turbulence) —{" "}
              <a
                href="https://aviationweather.gov/gfa/#gairmet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                AIRMET
              </a>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.cielVis}
              onChange={() => handleAdvisoryToggle("cielVis")}
              className="rounded border-slate-300"
            />
            <span>
              Ceiling / Vis &lt; 10sm/2000′ —{" "}
              <a
                href="https://aviationweather.gov/gfa/#cigvis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Ceiling/Vis
              </a>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.mtnObsc}
              onChange={() => handleAdvisoryToggle("mtnObsc")}
              className="rounded border-slate-300"
            />
            <span>
              AIRMET Sierra (mtn obscuration) —{" "}
              <a
                href="https://aviationweather.gov/gfa/#gairmet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                AIRMET
              </a>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

interface WindsAloftBlockProps {
  wind: [(number | null)[], (number | null)[], (number | null)[]];
  apiPopulatedWind: boolean;
  apiPopulatedTemp: boolean;
  useFahrenheit: boolean;
  onChange: (row: 0 | 1 | 2, col: number, rawValue: string) => void;
}

function WindsAloftBlock({
  wind,
  apiPopulatedWind,
  apiPopulatedTemp,
  useFahrenheit,
  onChange,
}: WindsAloftBlockProps) {
  const cellClass = (apiPopulated: boolean) => {
    const base =
      "w-full text-center rounded border p-1 focus:outline-none focus:ring-2 focus:ring-slate-300";
    return apiPopulated
      ? `${base} bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-600`
      : `${base} bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600`;
  };

  const displayTemp = (raw: number | null | undefined): string => {
    if (raw === null || raw === undefined) return "";
    return useFahrenheit
      ? Math.round(celciusToFarenheit(raw)).toString()
      : parseFloat(raw.toFixed(1)).toString();
  };

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Aloft
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <th className="border border-slate-200 p-2 text-left font-semibold dark:border-slate-700"></th>
              {ALOFT_ALTITUDES.map((alt) => (
                <th
                  key={alt}
                  className="border border-slate-200 p-2 num-mono dark:border-slate-700"
                >
                  {alt}′
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num-mono">
            <tr>
              <td className="border border-slate-200 p-2 font-sans dark:border-slate-700">
                Wind Dir (°)
              </td>
              {ALOFT_ALTITUDES.map((alt, idx) => (
                <td
                  key={alt}
                  className="border border-slate-200 p-1 dark:border-slate-700"
                >
                  <input
                    type="number"
                    min={0}
                    max={359}
                    aria-label={`Wind direction at ${alt} ft`}
                    value={wind[0][idx] ?? ""}
                    onChange={(e) => onChange(0, idx, e.target.value)}
                    className={cellClass(apiPopulatedWind)}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 p-2 font-sans dark:border-slate-700">
                Wind Vel (kt)
              </td>
              {ALOFT_ALTITUDES.map((alt, idx) => (
                <td
                  key={alt}
                  className="border border-slate-200 p-1 dark:border-slate-700"
                >
                  <input
                    type="number"
                    min={0}
                    max={150}
                    aria-label={`Wind velocity at ${alt} ft`}
                    value={wind[1][idx] ?? ""}
                    onChange={(e) => onChange(1, idx, e.target.value)}
                    className={cellClass(apiPopulatedWind)}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 p-2 font-sans dark:border-slate-700">
                Temp (°{useFahrenheit ? "F" : "C"})
              </td>
              {ALOFT_ALTITUDES.map((alt, idx) => (
                <td
                  key={alt}
                  className="border border-slate-200 p-1 dark:border-slate-700"
                >
                  <input
                    type="number"
                    aria-label={`Temperature at ${alt} ft`}
                    value={displayTemp(wind[2][idx])}
                    onChange={(e) => onChange(2, idx, e.target.value)}
                    className={cellClass(apiPopulatedTemp)}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Notes:
- The winds-aloft table is ported from `WeatherInfo.tsx` (lines ~260–352) with one structural change: the value cells use `aria-label` instead of relying on label association, so the tests can `getAllByLabelText(/Wind direction at/i)` without DOM nesting tricks. The validation logic (0–359 / 0–150 / temperature range) is preserved.
- `isApiPopulatedData` is imported from the existing `weatherDataMapper` — same source as `WeatherInfo` and `AircraftPerformance` use today.
- The advisory checkboxes preserve the AIRMET deep-links from the existing `WeatherInfo`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/WeatherSection.test.tsx`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/WeatherSection.tsx src/components/WeatherSection.test.tsx
git commit -m "Add WeatherSection composing Aloft / At airports / Advisories

Single Step 2 body that replaces the previous WeatherInfo +
AircraftPerformance split. Three sub-headings:
- Aloft: winds + temperatures table (ported from WeatherInfo)
- At airports: 3-up grid of AirportCards (departure / operating /
  arrival)
- Advisories: turb / cielVis / mtnObsc checkboxes with AIRMET links

Runway dropdown options come in via the new airportRunways prop;
selection updates state.rwy on change. Aloft table cells use
aria-label so the test suite can target them by row + altitude."
```

---

## Task 5: Wire `WeatherSection` into `AppInputs`

**Files:**
- Modify: `src/components/AppInputs.tsx`
- Modify: `src/components/AppInputs.test.tsx`

- [ ] **Step 1: Update `AppInputs.test.tsx` mocks**

Open `src/components/AppInputs.test.tsx` and replace the two existing `jest.mock("./WeatherInfo", …)` and `jest.mock("./AircraftPerformance", …)` blocks (lines ~31–75) with one combined mock for `WeatherSection`:

```tsx
jest.mock("./WeatherSection", () => {
  return function MockWeatherSection({
    onUpdate,
  }: {
    onUpdate: (data: Partial<WorksheetData>) => void;
  }) {
    return (
      <div data-testid="weather-section">
        <button
          data-testid="update-weather-btn"
          onClick={() =>
            onUpdate({
              wind: [
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0],
              ],
            })
          }
        >
          Update Weather
        </button>
        <button
          data-testid="update-performance-btn"
          onClick={() => onUpdate({ temp: [20, 20, 20] })}
        >
          Update Performance
        </button>
      </div>
    );
  };
});
```

Then update every assertion that referenced `weather-info` or `aircraft-performance` to look for `weather-section` instead. Specifically:

The "renders all child components" test becomes:

```tsx
  it("renders all child components", () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    expect(screen.getByTestId("sortie-info")).toBeInTheDocument();
    expect(screen.getByTestId("weather-section")).toBeInTheDocument();
  });
```

The "passes worksheet data and timestamp to WeatherInfo" test becomes:

```tsx
  it("passes worksheet data to WeatherSection", () => {
    const testState = {
      ...defaultState,
      wind: [
        [0, 260, 270, 340, 345],
        [0, 5, 7, 13, 17],
        [0, 6, 1, -11, -17],
      ],
    };

    render(<AppInputs state={testState} onStateUpdate={mockOnStateUpdate} />);

    expect(screen.getByTestId("weather-section")).toBeInTheDocument();
  });
```

The "passes worksheet data to AircraftPerformance" test is deleted (folded into the one above; the merge is the point).

The "passes weather timestamp to WeatherInfo" test is deleted — `weatherLastUpdated` no longer flows into `WeatherSection` (the action bar now owns that display). The `weatherLastUpdated` prop on `AppInputs` is dropped in Step 2 below, so this test no longer makes sense.

The "renders with different initial states" test loses the two old test ids:

```tsx
    expect(screen.getByTestId("sortie-info")).toBeInTheDocument();
    expect(screen.getByTestId("weather-section")).toBeInTheDocument();
```

The "handles updates from child components" test keeps its existing structure — the mock still exposes `update-weather-btn` and `update-performance-btn` test ids.

- [ ] **Step 2: Update `AppInputs.tsx`**

Replace the entire contents of `src/components/AppInputs.tsx` with:

```tsx
"use client";

import { type ReactNode } from "react";
import SortieInfo from "@/components/SortieInfo";
import StepShell from "@/components/StepShell";
import WeatherSection from "@/components/WeatherSection";
import type { RunwayOption, WorksheetData } from "@/utils/types";

interface WorksheetFormProps {
  state: WorksheetData;
  onStateUpdate: (updates: Partial<WorksheetData>) => void;
  airportRunways: [RunwayOption[] | null, RunwayOption[] | null];
  useFahrenheit?: boolean;
}

export default function AppInputs({
  state,
  onStateUpdate,
  airportRunways,
  useFahrenheit,
}: WorksheetFormProps): ReactNode {
  const handleUpdate = (data: Partial<WorksheetData>) => {
    onStateUpdate(data);
  };

  return (
    <div className="flex w-full flex-col space-y-6">
      <StepShell
        id="step-sortie"
        number={1}
        status="active"
        title="Sortie Details"
        subtitle="Who's flying, when, and where"
      >
        <SortieInfo onUpdate={handleUpdate} initialData={state} />
      </StepShell>
      <StepShell
        id="step-weather"
        number={2}
        status="pending"
        title="Weather"
        subtitle="Winds aloft, terminal conditions, and advisories"
      >
        <WeatherSection
          state={state}
          onUpdate={handleUpdate}
          airportRunways={airportRunways}
          useFahrenheit={useFahrenheit}
        />
      </StepShell>
    </div>
  );
}
```

Changes from the previous file:
- Imports drop `WeatherInfo` and `AircraftPerformance`, add `WeatherSection`.
- Drops the `weatherLastUpdated` prop — it's not needed anymore (`ActionBar` displays the timestamp in the fetched state from Phase 3).
- Adds the required `airportRunways` prop, passed through to `WeatherSection`.
- Removes the duplicate render of `<AircraftPerformance>` after `<WeatherInfo>` — `WeatherSection` is one node.

- [ ] **Step 3: Update `AppContainer.tsx` to pass `airportRunways` and drop `weatherLastUpdated`**

In `src/components/AppContainer.tsx`, find the `<AppInputs>` block. Add `airportRunways={airportRunways}` and remove the now-unused `weatherLastUpdated={weatherLastUpdated ?? undefined}` line. The block becomes:

```tsx
          <AppInputs
            state={state}
            onStateUpdate={handleUpdate}
            useFahrenheit={useFahrenheit}
            airportRunways={airportRunways}
          />
```

- [ ] **Step 4: Run the relevant tests**

Run: `npx jest src/components/AppInputs.test.tsx src/components/AppContainer.test.tsx`
Expected: PASS — both suites green.

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: PASS across all suites. The two existing `WeatherInfo.test.tsx` and `AircraftPerformance.test.tsx` suites will still run and pass — they're deleted in Task 6, not here, because the component files they exercise haven't been removed yet.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppInputs.tsx src/components/AppInputs.test.tsx src/components/AppContainer.tsx
git commit -m "Replace WeatherInfo + AircraftPerformance with WeatherSection

AppInputs now mounts a single WeatherSection inside the Step 2
StepShell instead of stacking WeatherInfo and AircraftPerformance.
The airportRunways prop threads through from AppContainer; the
obsolete weatherLastUpdated prop is dropped (ActionBar owns the
last-fetched display since Phase 3). Test mocks collapse from two
children to one (weather-section); two tests that asserted on
per-child wiring are merged or deleted accordingly."
```

---

## Task 6: Delete obsolete `WeatherInfo` and `AircraftPerformance`

**Files:**
- Delete: `src/components/WeatherInfo.tsx`
- Delete: `src/components/WeatherInfo.test.tsx`
- Delete: `src/components/AircraftPerformance.tsx`
- Delete: `src/components/AircraftPerformance.test.tsx`

- [ ] **Step 1: Verify no other component imports them**

Run: `grep -rn "from .*WeatherInfo\|from .*AircraftPerformance" src/`
Expected: zero matches outside of the two files themselves.

If any matches remain (e.g. a stray import in a sibling component), stop and fix them before deleting — they would otherwise cause runtime errors in Step 3.

- [ ] **Step 2: Delete the four files**

Run:

```bash
rm src/components/WeatherInfo.tsx \
   src/components/WeatherInfo.test.tsx \
   src/components/AircraftPerformance.tsx \
   src/components/AircraftPerformance.test.tsx
```

- [ ] **Step 3: Run the full test suite**

Run: `npx jest`
Expected: PASS across all remaining suites. The two deleted test files will not be collected.

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors in any file. (Pre-existing errors unrelated to this phase are out of scope, but verify the count hasn't grown.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove obsolete WeatherInfo and AircraftPerformance components

WeatherSection (introduced in the previous commit) covers all of
their responsibilities — winds aloft, advisories, and per-airport
performance fields — under three sub-headings backed by the new
AirportCard. The four deleted files have no remaining call sites."
```

---

## Verification — full phase

- [ ] All six task commits land cleanly:
  ```bash
  git log --oneline -8
  ```

- [ ] Jest is green:
  ```bash
  npx jest
  ```

- [ ] TypeScript introduces no new errors in files this phase touches:
  ```bash
  npx tsc --noEmit 2>&1 | grep -E "AirportCard|WeatherSection|AppInputs|AppContainer|WeatherDataIntegration|types\.ts"
  ```
  Expected: empty.

- [ ] Visual checklist (in a browser at `localhost:3000`):
  - Step 2 ("Weather") shows three sub-headings in order — **Aloft**, **At airports**, **Advisories** — each with the slate-500 uppercase label style used in Phase 2's Sortie Details sub-groups.
  - **Aloft** renders the 3-row × 5-column winds table (Wind Dir / Wind Vel / Temp) with API-populated cells highlighted blue.
  - **At airports** renders three cards left-to-right: Departure (with airport code, temp/altimeter, field elev, runway dropdown), Operating (temp/altimeter, altitude with deep-link arrow to Step 1), Arrival (mirror of Departure).
  - Before a fetch, the runway slot reads "Fetch weather to load runways" (slate-400 italic).
  - After fetch, each dropdown defaults to the shortest non-helipad runway and lists all valid runways as `<id> · <length> ft`. Picking a different runway updates the takeoff/landing calculations in Step 3.
  - The °C / °F toggle in the header still flips temperatures across the aloft row, the airport cards, and the previously-existing performance fields.
  - The legend chip "Blue cells fetched from aviationweather.gov — type to override" appears once at the top of Step 2.
  - The stepper, action bar, and slim header from Phases 1–3 are visually unchanged.
  - No browser console errors.

- [ ] URL sharing sanity check (manual): fetch weather, change the departure runway from shortest to a longer option, click `Copy link`, paste into a new tab. The selected runway length persists (because it lives in `rwy[0]`). The dropdown shows "Fetch weather to load runways" in the new tab until the recipient re-fetches — that's expected behaviour (option lists are local state, not URL state).

---

## Out of scope for Phase 4 (do **not** add here)

- StepShell card-header `Fetched 14:31 UTC` badge — same deferral as Phase 3.
- "For reference only" inline disclaimer in Decision — Phase 5.
- Slide-overs for Instructions and Mountain Flying Checklist — Phase 5.
- `@media print` stylesheet — Phase 5.
- Auto-derivation of the `all-done` action-bar state from a Go/No-Go verdict — separate plan.
- Storing the runway option list in URL state — see "out of scope" note at the top; selection persists, options do not.
- Soft-warning behaviour when the operating altitude is above the highest aloft band — separate polish-batch follow-up plan.
- "Quals echoed downstream" (recommendation #8 from the UX assessment) — separate polish-batch plan.
