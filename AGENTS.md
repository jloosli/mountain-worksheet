# CAP Mountain Flying Worksheet - AI Agent Instructions

A Next.js 16.x web application (App Router, TypeScript, Tailwind CSS v4, Vercel) that helps Civil Air Patrol pilots plan mountain flying operations by computing density altitude, takeoff/landing distances, maneuvering speeds, and climb performance from aircraft POH data.

## Key Architecture

- `src/app/` — App Router pages and layouts
- `src/components/` — UI components; `AppContainer` owns all state, `AppInputs` owns user inputs, `Calculations` derives results during render
- `src/utils/types.ts` — Core types: `WorksheetData`, `Aircraft`, `TOLDResults`, `TOLDInputs`
- `src/data/aircraft.json` — POH performance tables indexed by weight × altitude × temperature
- `src/utils/interpolation.ts` — Trilinear interpolation across POH tables
- `src/utils/toldCalculations.ts`, `maneuveringCalculations.ts`, `formulas.ts` — Calculations
- `src/utils/derived.ts` — Pure helpers (`computePressureColumns`, `computeTOLDViewModel`) used by `<Calculations>` during render
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

## Derived State Pattern

`<Calculations>`, `<Altitudes>`, `<ClimbPerformance>`, and `<TakeoffPerformance>` derive every display value during render via pure helpers (mostly from `src/utils/derived.ts`). Do not introduce `useState`/`useEffect` to cache derived values that can be recomputed from props — table lookups in this codebase are sub-millisecond, and the previous effect-driven chain caused issue #98 (stale calculations after weather fetch when array references were mutated in place). If you need to add a new derived value, add a pure function to `derived.ts` and call it from `<Calculations>`.

Weather-data mappers in `src/utils/weatherDataMapper.ts` must also return new arrays, never mutate inputs — `setState` only triggers downstream recomputation when reference equality changes.

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

## Agent skills

### Issue tracker

Issues live as GitHub issues in `jloosli/mountain-worksheet`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map 1:1 to label strings of the same name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, both created lazily. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
