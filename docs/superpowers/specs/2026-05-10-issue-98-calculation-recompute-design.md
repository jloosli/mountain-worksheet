# Issue #98 — Calculations don't refresh after weather fetch

## Problem

After clicking **Fetch Weather**, downstream calculations (operating pressure altitude, density altitude, rate of climb, TOLD) sometimes fail to update even though the underlying input values (temperature, altimeter, altitude) clearly changed. The worksheet displays stale results. Reproduces with the URL from issue #98.

## Root cause

Two issues compound.

### 1. In-place array mutation in `mergeWeatherData`

`src/utils/weatherDataMapper.ts` builds the merged worksheet data with a shallow copy:

```ts
const result = { ...existingData };  // result.temp === existingData.temp (same reference)

if (apiData.temp) {
  if (!result.temp) result.temp = [null, null, null];
  apiData.temp.forEach((val, i) => {
    if (val !== undefined && val !== -1) {
      result.temp![i] = val;   // mutates the array shared with existingData
    }
  });
}
```

The same pattern is used for `altimeter` and `altitude`, and in `mapAirportSpecificWeatherData`. When the user already has values typed (the issue URL has `temp=25,12,26`), `existingData.temp` is a populated array, so `result.temp` is that same array. The function mutates it in place. After `setState((prev) => ({ ...prev, ...merged }))`, the top-level state object is new, but `state.temp` is still the same array reference as before.

### 2. Effect-driven derived state in `<Calculations>` / `<Altitudes>`

The calculation chain is built on `useState` + `useEffect`:

- `<Altitudes>` accepts `altitudes`/`altimeters`/`temperatures`, computes pressure altitudes in a `useEffect`, stores them in local `useState`, **and pushes them back up** to `<Calculations>` via an `onPressureUpdate` callback.
- `<Calculations>` stores PAs in its own `useState`, then has a `useEffect` that triggers `performTOLDCalculation` whenever PAs (or temp/rwy/weight) change. The result is set via `setToldResults`, etc.
- `<ClimbPerformance>` has another `useEffect` watching PAs/OATs to recompute climb rates into local state.

Every link in this chain compares dependencies by reference (`Object.is`). When the array references don't change (because of issue #1), the entire chain freezes. Even if we patched #1, the chain remains fragile: any future change that lifts derived state or memoizes a callback incorrectly can reintroduce the same class of bug.

## Goals

- Calculations always reflect current form state immediately after any input change (typed value, weather fetch, °F/°C toggle, etc.).
- Architecture is simple enough that the bug class can't easily recur.
- Calculation algorithms (`formulas.ts`, `toldCalculations.ts`, `maneuveringCalculations.ts`) are unchanged — they already work in isolation.
- No new dependencies.

## Non-goals

- Adding a state-management library (Zustand/Redux). `useUrlState` + lifted state in `AppContainer` stays.
- Refactoring input components (`AircraftPerformance`, `WeatherInfo`, etc.). Their local string-state pattern is documented in `AGENTS.md` and is correct.
- Loading spinners for TOLD. The calculation is synchronous and sub-millisecond.
- Caching/memoization for performance. With cheap table lookups, plain re-computation per render is fine.

## Design

### Principle

`state` (the form data) is the only source of truth. Derived values are computed by **pure functions called during render** in `<Calculations>`. Display components are dumb — they receive what they show as props and have no derived-state logic.

This eliminates the effect-driven propagation chain entirely. There is no "stale" state because there is no derived state.

### New file: `src/utils/derived.ts`

Pure functions wrapping the existing calculation utilities. No algorithm changes.

```ts
// All inputs/outputs are plain values. Functions never throw — they return
// nulls / structured error shapes for missing or invalid data.

export function computePressureColumns(
  altitudes: [number | null, number | null, number | null],
  altimeters: [number | null, number | null, number | null],
  temperatures: [number | null, number | null, number | null],
): {
  PAs: [number | null, number | null, number | null];
  DAs: [number | null, number | null, number | null];
};

export interface TOLDViewModel {
  results: {
    takeoffGroundRoll: { departure: number | null; arrival: number | null };
    takeoff50ftObstacle: { departure: number | null; arrival: number | null };
    landingGroundRoll: { departure: number | null; arrival: number | null };
    landing50ftObstacle: { departure: number | null; arrival: number | null };
    availableRunwayRemainingTakeoffGroundRoll: { departure: number | null; arrival: number | null };
    availableRunwayRemainingTakeoff50ft: { departure: number | null; arrival: number | null };
  } | null;
  status: 'success' | 'invalid_inputs' | 'error';
  errors: TOLDError[];
  warnings: TOLDError[];
  extrapolationWarnings: TOLDError[];
  errorSummary: { count: number; critical: number; warnings: number; messages: string[] } | null;
  warningSummary: { count: number; validation: number; extrapolation: number; messages: string[] } | null;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export function computeTOLDViewModel(
  state: WorksheetData,
  PAs: [number | null, number | null, number | null],
): TOLDViewModel;
```

Climb-rate computation can stay inside `<ClimbPerformance>` as a pure inline helper (it's already close to the display and only used there). The point is no `useState` / `useEffect` for it.

### `src/components/Altitudes.tsx`

- Remove `useState` and `useEffect`.
- Remove `onPressureUpdate` prop.
- Accept `PAs: [...]` and `DAs: [...]` as props.
- Pure render of the table.

### `src/components/ClimbPerformance.tsx`

- Remove all three `useState`s (`ratesOfClimb`, `percentMGW`, `aircraft`) and all three `useEffect`s.
- Look up `aircraft` from `aircraftData` inline during render.
- Compute rates of climb and percent MGW inline (small loops; already cheap).
- Existing inline `Vy` / `Va` / `Vra` / `Vx` / `serviceCeiling` helpers stay as-is.

### `src/components/Calculations.tsx`

Drastically simplified. The whole top of the component becomes roughly:

```tsx
export default function Calculations({ state }: { state: WorksheetData }) {
  const { PAs, DAs } = computePressureColumns(state.altitude, state.altimeter, state.temp);
  const toldData = computeTOLDViewModel(state, PAs);
  const maneuveringSpeeds = state.acType ? calculateManeuveringSpeeds(state.acType) : null;

  return (
    <div ...>
      <h2>Calculations</h2>
      {!state.acType && <p>Select an aircraft model...</p>}
      <Altitudes altitudes={state.altitude} PAs={PAs} DAs={DAs} />
      <ClimbPerformance aircraftModel={state.acType} weight={state.weight} OATs={state.temp} PAs={PAs} altimeters={state.altimeter} />
      <TOLDErrorBoundary>
        <TakeoffPerformance aircraftModel={state.acType} airports={state.airport} toldData={toldData} />
      </TOLDErrorBoundary>
      <ManeuveringPerformance aircraftModel={state.acType} maneuveringSpeeds={maneuveringSpeeds ?? undefined} />
    </div>
  );
}
```

Deleted: `useState` × 6, `useCallback` × ~10, `useEffect` × 2, all the `format*`/`get*`/`has*`/`handle*Update` helpers, `retryTOLDCalculation`, `clearTOLDErrors`. The `setToldErrors` call inside `TOLDErrorBoundary.onError` is replaced by `console.error` only — render-time errors are already caught by the boundary's `componentDidCatch`.

### `src/components/TakeoffPerformance.tsx`

- Remove `retryCalculation` and `clearErrors` from the `toldData` prop type — they no longer mean anything (results are derived from `state`).
- `isCalculating` field is removed (it was always `false` in practice with the new model; remove the field rather than carry a dead `false`).
- `TOLDFallbackDisplay`'s `onRetry` callsite drops to `undefined`.

### `src/utils/weatherDataMapper.ts` — defense in depth

Fix the in-place mutation so this class of bug can't bite anywhere else:

- `mapAirportSpecificWeatherData` (lines ~91, ~97): build a fresh array (`result.temp ??= [null, null, null]; result.temp = [...result.temp]; result.temp[index] = temp;`), or accumulate into a local and assign once.
- `mergeWeatherData` (lines ~534, ~543, ~557): clone the existing array before writing indices. Example:
  ```ts
  if (apiData.temp) {
    const next = result.temp ? [...result.temp] : [null, null, null];
    apiData.temp.forEach((val, i) => {
      if (val !== undefined && val !== -1) next[i] = val;
    });
    result.temp = next as WorksheetData['temp'];
  }
  ```
- Remove the `existingOperatingAltitude` save/restore dance in the `altitude` block — it's a workaround for the mutation issue that also accidentally drops the API's operating altitude. The cleaner version preserves the operating slot only when the API marker `-1` is present.

After this fix, derived computation would still work (we compute from `state` every render), but the mutation fix ensures any other consumer that relies on reference equality (memoized selectors, effect deps, React Compiler annotations, etc.) won't be silently broken.

## Tests

### New
- `src/utils/__tests__/derived.test.ts`
  - `computePressureColumns`: returns nulls for missing inputs; correct values for known PA/DA examples; handles the `-1` sentinel from old serialized state.
  - `computeTOLDViewModel`: returns `status: 'invalid_inputs'` when `acType` or `weight` is missing; returns `status: 'success'` with results when inputs are valid; surfaces validation/extrapolation warnings; returns expected `errorSummary`/`warningSummary` shapes.

### Updated
- `src/components/Altitudes.test.tsx` — render with `PAs`/`DAs` props directly; no callback. Verify table cells.
- `src/components/ClimbPerformance.test.tsx` — verify a `PAs`/`OATs` prop change produces a new render's rates without await.
- `src/components/Calculations.test.tsx` — verify changing `state.temp[1]` in a parent wrapper causes operating PA/DA and operating rate of climb to update on next render. This is the regression test for issue #98.
- `src/utils/weatherDataMapper.test.ts` — assert `mergeWeatherData(existing, apiData)` returns a new array reference for any of `temp`/`altimeter`/`altitude` that it modifies. Locks down the mutation fix.

### Manual validation (after implementation)
- Load the URL from issue #98 in the dev server, click **Fetch Weather**, confirm operating PA/DA, rate of climb, and TOLD all change.
- Type new values into temp/altimeter/altitude/weight/rwy and confirm downstream calculations update immediately.
- Toggle °F/°C and confirm temps still drive correct calculations.

## What is explicitly unchanged

- `src/utils/useUrlState.ts` and URL state mechanism.
- All calculation algorithms in `formulas.ts`, `toldCalculations.ts`, `maneuveringCalculations.ts`, `interpolation.ts`.
- Weather API integration in `WeatherDataIntegration.tsx` and `aviationWeatherApi.ts` (apart from the merger fix).
- Input components — `AircraftPerformance`, `WeatherInfo`, `SortieInfo`, etc.
- `TOLDErrorBoundary` — kept as a safety net for render-time throws.

## Risks

- **TOLD "retry" button removal**: The current UI exposes a retry affordance in `TOLDFallbackDisplay`. With derived calculations, errors clear automatically when inputs change, so retry is meaningless. We will simply not pass `onRetry`, and the fallback display already handles its absence.
- **TOLD calculation throwing during render**: `calculateTOLDForMultipleAirports` already returns a structured error object rather than throwing for known failure modes. Unexpected throws are caught by `<TOLDErrorBoundary>`. No new failure surface.
- **Re-render cost**: Negligible (sub-millisecond table lookups). Confirmed during design discussion that this is acceptable in exchange for simplicity.
