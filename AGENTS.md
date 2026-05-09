# CAP Mountain Flying Worksheet - AI Agent Instructions

A Next.js 16.x web application (App Router, TypeScript, Tailwind CSS v4, Vercel) that helps Civil Air Patrol pilots plan mountain flying operations by computing density altitude, takeoff/landing distances, maneuvering speeds, and climb performance from aircraft POH data.

## Key Architecture

- `src/app/` — App Router pages and layouts
- `src/components/` — UI components; `AppContainer` owns all state, `AppInputs` owns user inputs, `Calculations` renders results
- `src/utils/types.ts` — Core types: `WorksheetData`, `Aircraft`, `TOLDResults`, `TOLDInputs`
- `src/data/aircraft.json` — POH performance tables indexed by weight × altitude × temperature
- `src/utils/interpolation.ts` — Trilinear interpolation across POH tables
- `src/utils/toldCalculations.ts`, `maneuveringCalculations.ts`, `formulas.ts` — Calculations
- `src/app/api/aviation-weather/route.ts` — Proxy to `aviationweather.gov` (avoids CORS)

## URL State Management

State is persisted to URL query strings via `src/utils/urlState.ts` + `src/utils/useUrlState.ts` using the `qs` library.

**Format rules (non-obvious):**
- Arrays → comma-separated (`?numbers=1,2,3`)
- Booleans → `"1"` / `"0"`
- 2D arrays → `||` row separator (`?wind=,90,180||5,10,15`)
- Null elements within arrays → preserved as empty slots (`,90,180` means `[null, 90, 180]`); omitted only for top-level null values
- Spaces → `+` (not `%20`)
- `initialState` is used as type hints during deserialization to restore correct types

**Wind null semantics:** `null` ≠ `0` in the wind field. `0` is a valid direction/velocity; `null` means no data for that altitude. Use `??` not `||` when reading for display.

## Input Component State Pattern

`AircraftPerformance` receives both `initialData` (its owned fields) and `worksheetData` (full state) — both recreated on every `onUpdate`. A `useEffect` watching either prop will fire on every keystroke, not just external changes, causing feedback loops that clear fields mid-entry.

**Correct pattern:**
- Keep a local string state for the raw input display value
- Track last-pushed value in a `useRef`
- In prop-watching `useEffect`s, only sync local state when incoming value differs from the last-pushed value
- `min`/`max` on `<input type="number">` do not block state — validate in `onChange` before calling `onUpdate`

## Development

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all tests
npx jest src/path/to/file.test.ts  # Single test file
```

## Testing (Required)

**Every code change must include new or updated tests.** No exceptions.

- New utilities → unit tests in `src/utils/__tests__/`
- New/modified components → tests co-located as `ComponentName.test.tsx`
- Bug fixes → regression test that would have caught the bug

Jest + React Testing Library. Next.js navigation hooks are mocked in `jest.setup.ts`. Custom render wrapper in `src/test-utils/test-utils.ts`. CI runs tests, lint, and build on every push/PR to `main`.

**POH null values:** Some aircraft have `null` entries at extreme altitudes/temperatures. `trilinearInterpolate` handles nulls via fallback average; callers of `bilinearInterpolate` variants should validate inputs are within table bounds or wrap in `try/catch`.
