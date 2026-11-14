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
- `src/components/` — UI components; `AppContainer` holds the weather session (`useUrlReducer`) and evaluates the worksheet once per render; `AppInputs`, `Calculations` and `PrintBriefing` render that evaluation
- `src/utils/types.ts` — Core types: `WorksheetData`, `Aircraft`, `TOLDCalculationParams`
- `src/data/aircraft.json` — POH performance tables indexed by weight × altitude × temperature
- `src/utils/interpolation.ts` — Trilinear (takeoff: weight × altitude × temperature) and bilinear (landing, from a single-weight table, and climb: altitude × temperature) interpolation across POH tables
- `src/utils/toldCalculations.ts`, `maneuveringCalculations.ts`, `formulas.ts` — Calculations
- `src/utils/worksheetEvaluation.ts` — `evaluateWorksheet(state, session)`: the one pure function that assembles every notification, computed value, Limit check and step status. It owns the two-pass ordering (performance notifications first, then values withheld against every notification in force). Test cross-cutting behaviour here, not by rendering `AppContainer`
- `src/utils/weatherSession.ts` — The weather session as a pure reducer: the worksheet plus this session's memory (last fetch, operating-temperature change, rejected entries, link load). Events `edit`/`fetchApplied`/`entryRejected`; selectors `sessionNotifications`/`weatherStatus`/`canFetch`. One `FETCHED_FIELDS` table maps each fetched field to the fetch inputs it depends on, for both staleness and fetch-Warning retirement. Its state (less the worksheet) is `evaluateWorksheet`'s `session`. Test session behaviour by replaying events on the reducer
- `src/utils/derived.ts` — Per-calculation helpers (`computePressureColumns`, `computeTOLDViewModel`, `computeClimbViewModel`) that `evaluateWorksheet` composes; TOLD results are per airport, each value `computed`/`withheld`/`unavailable`, with notifications
- `src/utils/provenance.ts` — `substitutionsFor(value, notifications)`: the one rule for which Cautions a value rests on (its inputs' Cautions, plus any Notification whose `covers` takes in an input). Screen markers, Briefing refs and Limit check points all use it
- `src/utils/limitChecks.ts` — Limit checks (the worksheet's own limits, ADR 0002): derived by `evaluateWorksheet`, shown as callouts at the top of their owning step, summarized in the action bar, and listed in the Briefing's Worksheet limits table and the checklist slide-over; never notifications, never affect step status
- `src/app/api/aviation-weather/route.ts` — Proxy to `aviationweather.gov` (avoids CORS)

## Planning Docs Are Historical

`tasks/` (early PRDs and task lists) and `docs/superpowers/` (dated specs and implementation plans) record work that has already shipped. Do not treat them as current requirements: file paths, component names, and behavior in them may be out of date. `docs/ux-assessment.md` and the `docs/*-mockup.html` files are the design rationale behind the step-based layout that has since been built. For how things work now, trust the code, `GLOSSARY.md`, and `docs/adr/`; for open work, check GitHub issues.

## Development

Work in your own worktree, never the main checkout: it may hold someone else's uncommitted work. `scripts/worktree.sh new <branch>` creates one off an up-to-date `main` and installs dependencies; `scripts/worktree.sh rm <branch>` removes it after merge.

A pre-commit hook formats staged files. Run `npm run typecheck`, `npm run lint` and `npm test` before pushing. To land a PR (Copilot review loop, merge, cleanup), use the `land-pr` skill.

Every derived value goes through `evaluateWorksheet`; the review rules (derived state, input components, wind nulls, POH gaps, required tests) are in `CODING_STANDARDS.md`. Read `docs/url-state.md` before touching `urlState.ts`/`useUrlReducer.ts` or adding a URL field.

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
