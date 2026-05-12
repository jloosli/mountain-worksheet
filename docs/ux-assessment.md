# Mountain Worksheet — UX Assessment

_Reviewed 2026-05-10. Scope: usability of the existing flow, not visual redesign._

## The core flow problem

The page is **eight stacked sections of equal visual weight** — Instructions, Sortie Info, Quals, Weather, Aircraft Perf, Calculations, Checklist, Footer — with no sense of sequence or destination. A pilot opening this for the first time has no idea whether to start at the top, click `Fetch Weather` first, or scroll to Calculations. The actual workflow ("fill sortie info → fetch → review → decide") is documented only inside the collapsed `Instructions and Notes` section.

Everything below flows from this: the tool computes great numbers, but doesn't *narrate the decision* the pilot is trying to make.

---

## High-impact changes (flow & decision)

### 1. Add a Go/No-Go summary at the top of `Calculations`
_File: `src/components/Calculations.tsx`_

Right now the most important signals are scattered:

- Density altitude is row 3 in `Altitudes` (`Altitudes.tsx:38-42`)
- Available runway remaining (negative = bad) is row 3 in `TakeoffPerformance` (`TakeoffPerformance.tsx:272-323`)
- AIRMET flags (turb/cielVis/mtnObsc) live on the input side, never re-surfaced
- Climb rate vs. terrain is just a number with no context

A pilot has to mentally synthesize ~10 values into "is this safe?". Surface that synthesis: a single panel with traffic-light banding for `Runway margin`, `Density altitude`, `Climb performance`, `Weather warnings`, `Quals`. Anything red = a no-go discussion. This is by far the biggest information-conveyance win.

### 2. Make the Fetch Weather button explain itself
_File: `src/components/WorksheetHeader.tsx:134-153`_

The button is `disabled` when inputs are missing but says nothing about *what's missing*. Add a tooltip or sublabel: "Need departure airport and date/time first." Better: move (or duplicate) the button into the Weather section as a primary action — currently the button is at the top of the page, but the data lands further down, so users do a scroll-up → click → scroll-down dance.

### 3. Sequence the page visually
_Files: `src/components/AppContainer.tsx:126-138`, `AppInputs.tsx:27-44`_

Number the sections or add a sticky "step" indicator:

1. **Flight details** (sortie + quals)
2. **Weather** (fetch + review)
3. **Performance** (auto-filled, override as needed)
4. **Decision** (calculations + go/no-go)

Even just numbered headings ("1. Flight Details", "2. Weather") would establish intent. Today every `h2` is identical weight.

See `docs/numbered-step-shell-mockup.html` for a concrete mockup of this.

### 4. Group Sortie Info by concept
_File: `src/components/SortieInfo.tsx:206-381`_

11 fields in one flat 2-column grid is high cognitive load. Visible sub-groupings would help a lot:

- **Pilot & Aircraft**: Pilot, AC Model, Tail #
- **When**: Date, Time (UTC), Duration, + local-time helper
- **Where**: Departure, Area of Ops/Route, Arrival, Operating Altitude
- **Weight**: Takeoff Weight

Also: **operating altitude is currently in two places** — Sortie Info (editable, `SortieInfo.tsx:339-350`) and Aircraft Performance (read-only `—`, `AircraftPerformance.tsx:377-381`). Pick one home; the duplicate read-only field adds noise without information.

---

## Medium-impact (friction reduction)

### 5. Explain the blue-tinted cells
_Files: `WeatherInfo.tsx:170-185`, `AircraftPerformance.tsx:149-181`_

The API-populated styling is a great touch, but a pilot has no idea blue means "fetched from weather.gov — you can still override." Add a tiny legend once at the top of the weather/perf section: `■ Fetched from weather.gov · type to override`.

### 6. Make the local-time helper actionable
_File: `SortieInfo.tsx:144-204`_

Current: `06/15/26 1300 local (UTC-7), 3 hours from now` — the operationally useful fact (*how soon*) is at the end. Flip it: lead with "**In 3 hours** — 13:00 local, Sun 15 Jun (UTC-7)". Bonus: color the relative-time chip amber if the sortie is in the past or >12 h out, since weather forecasts beyond ~12 h are coarser.

### 7. Soften the Reset button
_File: `WorksheetHeader.tsx:107-112`_

Big red `Reset Worksheet` next to `Copy Link` is a misclick magnet. The action does `window.location.reload()` — irreversible. Either: (a) require confirmation, (b) make it a secondary-styled link with an "Are you sure?" inline confirm, or (c) toast an "Undo" for 10 s by stashing the prior URL.

### 8. Show consequences of unchecked Quals
_File: `MountainQuals.tsx`_

The two checkboxes (`mtnEndorse`, `mtnCert`) are collected but never re-surfaced. If unchecked, callouts in the Go/No-Go panel (`Mountain Endorsement required for departure/arrival at this airport`, `SQTR required for mountain search`) make the inputs feel load-bearing instead of decorative.

### 9. Surface AIRMET flags downstream
_Files: `WeatherInfo.tsx:353-415` → `WeatherWarningsPanel.tsx`_

The Turb / Ceil-Vis / Mtn-Obsc checkboxes appear as inputs but vanish from the rest of the page. Echo them in the Calculations area (or the Go/No-Go panel) with the same `WeatherWarningsPanel` styling — that panel already exists; just feed it the AIRMETs.

---

## Polish

### 10. Lift / link the Mountain Flying Checklist
It's last, after Calculations (`AppContainer.tsx:136`), but a pilot typically uses it *during* preflight, not after the numbers. Either move it up, or add a sticky "Checklist" jump-link in the header.

### 11. Print / PDF export
Notes say "upload this document to Sortie Files" (`InstructionsAndNotes.tsx:71`), but there's no print-optimized view. A `@media print` stylesheet + a "Print/PDF" button gives pilots a real artifact for the mission record.

### 12. Mobile tables
`WeatherInfo` and `AircraftPerformance` both rely on `overflow-x-auto` — usable but cramped. A breakpoint that stacks weather as "per-altitude cards" and aircraft perf as "per-phase cards" would be friendlier on a phone in the cockpit/FBO.

---

## Suggested sequencing

If sequencing the work: **#1 (Go/No-Go panel) → #2 (Fetch button affordance) → #3 (numbered sections) → #4 (group Sortie Info)**. That set alone changes the tool from "a calculator with sections" into "a guided pre-flight decision aid" without any visual redesign.
