# CAP Mountain Flying Worksheet - AI Agent Instructions

A Next.js 16.x web application (App Router, TypeScript, Tailwind CSS v4, Vercel) that helps Civil Air Patrol pilots plan mountain flying operations by computing density altitude, takeoff/landing distances, maneuvering speeds, and climb performance from aircraft POH data.

**Source of truth for the domain:** the app digitizes the Rocky Mountain Region CAP Mountain Flight Worksheet v2, committed at `docs/reference/mountain-flight-worksheet-v2.pdf` ([original on SharePoint](https://rmrcapgov.sharepoint.com/sites/RockyMountainReginCivilAirPatrolStaff/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FRockyMountainReginCivilAirPatrolStaff%2FShared%20Documents%2FPublicly%2Daccessible%20web%20files%2FOperations%2FMission%20Training%2FMountain%20Flying%20Training%2FReference%20Materials%2FMountain%20Flight%20Worksheet%20v2%2Epdf&parent=%2Fsites%2FRockyMountainReginCivilAirPatrolStaff%2FShared%20Documents%2FPublicly%2Daccessible%20web%20files%2FOperations%2FMission%20Training%2FMountain%20Flying%20Training%2FReference%20Materials&p=true&ga=1)). When a calculation or its presentation is in question, check it against that worksheet and the aircraft POHs. The POH PDFs live in `poh/`, which is gitignored and local-only. A fresh checkout won't have them, so fall back to the transcribed tables in `src/data/aircraft.json` or ask the user. The worksheet's limits and rules of thumb:

- Mountain winds under 30 kt at every altitude (surface, 3,000', 6,000', 9,000', 12,000')
- Ceilings and visibility much better than marginal VFR all along the route
- Gross weight under 90% of maximum gross weight
- Rate of climb over 300 fpm all along the route; service ceiling = the altitude where rate of climb falls to 300 fpm
- Takeoff ground roll + landing ground roll less than runway length
- Runway abort point: 75% of takeoff speed by the runway midpoint
- Canyon turns: stall speed is 1.2 × Vso at 45° bank and 1.4 × Vso at 60° bank (0° and 30° flaps); entry airspeed between 1.4 × Vso and Va
- En route at or above 2,000' AGL unless descending to land
- Pressure and density altitude come from the worksheet's density altitude chart and its altimeter-setting conversion table

## Key Architecture

- `src/app/` — App Router pages and layouts
- `src/components/` — UI components; `AppContainer` owns all state, `AppInputs` owns user inputs, `Calculations` derives results during render
- `src/utils/types.ts` — Core types: `WorksheetData`, `Aircraft`, `TOLDCalculationParams`
- `src/data/aircraft.json` — POH performance tables indexed by weight × altitude × temperature
- `src/utils/interpolation.ts` — Trilinear (takeoff: weight × altitude × temperature) and bilinear (landing, from a single-weight table, and climb: altitude × temperature) interpolation across POH tables
- `src/utils/toldCalculations.ts`, `maneuveringCalculations.ts`, `formulas.ts` — Calculations
- `src/utils/derived.ts` — Pure helpers (`computePressureColumns`, `computeTOLDViewModel`) used by `<Calculations>` during render; TOLD results are per airport, each value `computed`/`withheld`/`unavailable`, with notifications
- `src/utils/limitChecks.ts` — Limit checks (the worksheet's own limits, ADR 0002): derived during render in `AppContainer`, shown as callouts at the top of their owning step and summarized in the action bar; never notifications, never affect step status
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

## Planning Docs Are Historical

`tasks/` (early PRDs and task lists) and `docs/superpowers/` (dated specs and implementation plans) record work that has already shipped. Do not treat them as current requirements: file paths, component names, and behavior in them may be out of date. `docs/ux-assessment.md` and the `docs/*-mockup.html` files are the design rationale behind the step-based layout that has since been built. For how things work now, trust the code, `GLOSSARY.md`, and `docs/adr/`; for open work, check GitHub issues.

## Development

**Always create a new git worktree before making changes.** Never edit files directly in the main checkout. Branch off an up-to-date `main` into its own worktree (e.g. `git worktree add ../mountain-worksheet-<branch> -b <branch> main`), do all work there, and remove the worktree once the PR is merged. The main checkout may hold someone else's in-progress, uncommitted work. Run `npm install` in the new worktree before running tests or the build.

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

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root, both created lazily. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
