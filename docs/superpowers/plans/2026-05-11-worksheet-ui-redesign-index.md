# Worksheet UI Redesign — Master Index

**Source:** `docs/numbered-step-shell-mockup.html` (validated 2026-05-10), `docs/ux-assessment.md`

This redesign turns the Mountain Worksheet from a long stack of equal-weight sections into a guided 3-step flow with a sticky stepper and state-aware action bar. The work is broken into **5 sequenced plans**, each shipping as its own PR. Run them in order — each builds on the structure the previous one established.

## Plans in this series

| Phase | Plan file | What ships |
|---|---|---|
| 1 | `2026-05-11-worksheet-ui-1-step-shell.md` | Sticky 3-pill stepper above existing content with scroll-spy; existing sections gain `id` anchors; `InstructionsAndNotes` moves from page-top to page-bottom alongside `MountainFlyingChecklist` |
| 2 | `2026-05-11-worksheet-ui-2-step-cards.md` | New `StepShell` component (numbered circle + left-rail spine + section card); existing sections refactored to drop their outer cards and render inside `StepShell`; Sortie Details sub-headings (Pilot & Aircraft / When / Where / Pilot Qualifications); duplicate Operating Altitude removed |
| 3 | `2026-05-11-worksheet-ui-3-action-bar.md` | Slim header (Reset / Copy link / °F only); sticky state-aware action bar with morphing button (incomplete / ready / fetched / all-done); Fetch Weather migrates from header to action bar |
| 4 | `2026-05-11-worksheet-ui-4-weather-merge.md` | Weather and Aircraft Performance merge into one Step 2 with three subgroups (Aloft / At airports / Advisories); airport-card layout; runway dropdown defaulting to shortest |
| 5 | `2026-05-11-worksheet-ui-5-slideovers-print.md` | Decision section with "For reference only" inline disclaimer; Instructions and Checklist convert from bottom accordions to slide-over panels (`?` icon in header, "Checklist" button in action bar); `@media print` stylesheet for the Sortie Files PDF artifact |

## Out of scope (separate plans)

- **Go / No-Go panel** (assessment rec #1) — the highest-leverage info-architecture work, but distinct from the layout shell. Mocked in `docs/decision-panel-mockup.html`. A future plan will design and implement the panel; this index covers only what's in `numbered-step-shell-mockup.html`.
- **Soften Reset button** (rec #7), **Quals echoed downstream** (rec #8), **AIRMET flag echoes** (rec #9), **Mobile responsiveness for tables** (rec #12) — small polish items, batched as a follow-up plan.

## Architectural decisions shared across phases

**State** stays lifted in `AppContainer.tsx` via the existing `useUrlState` hook. No new state library. The "action bar state" (Phase 3) is a *derived* value computed from the existing state pieces, not a new state.

**New shared components** introduced across phases:

| Component | Phase | Responsibility |
|---|---|---|
| `Stepper` | 1 | Sticky 3-pill nav with scroll-spy |
| `StepShell` | 1 | Numbered card wrapper with left-rail spine and header chip |
| `ActionBar` | 3 | Sticky state-aware action bar driven by a derived state machine |
| `SlideOver` | 5 | Generic right-side panel built on `@headlessui/react` `Dialog` |
| `AirportCard` | 4 | One-airport card with METAR-driven + reference fields |

**Styling**: Tailwind v4 is already configured via `@import "tailwindcss"` in `src/app/globals.css`. The mockup uses only Tailwind utility classes — port them directly. Heroicons are already available (`@heroicons/react/24/outline`); replace inline SVGs from the mockup with Heroicons equivalents.

**Testing**: TDD for component logic (state derivation, scroll-spy, slide-over toggling). Visual layout changes verified manually in `npm run dev`. Existing tests for `WorksheetHeader`, `AppContainer`, `AppInputs`, etc. are updated as needed in the phase that touches them.

**Commit cadence**: each task ends in a commit. Each phase ends in a PR.

## Reading order for the engineer

1. Read this index.
2. Open the mockup in a browser:
   ```
   open docs/numbered-step-shell-mockup.html
   ```
   Cycle through all four states in the bottom-right demo chip to see the action bar morph (Phase 3 outcome) — that's the target end state for the whole series.
3. Pick up the Phase 1 plan and start there.
