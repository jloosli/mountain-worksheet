# Issue #120 — ActionBar mobile layout

## Problem

On mobile viewports (~360–420px wide), the sticky `ActionBar` at the top of the Weather step consumes ~360px of vertical scroll real estate before any actual weather data is visible. The status text — "Weather fetched · 05:17z / Review the weather below, then proceed to the decision." — wraps into ~9 short lines because three action buttons (`Re-fetch`, `Review decision`, `Checklist`) plus a left-border divider occupy nearly all of the bar's horizontal space, leaving the status column with almost no room.

The root cause is structural: `ActionBar` uses a single `flex items-center justify-between gap-4` row with no responsive breakpoint, so the layout cannot relax into a mobile-appropriate form. The same crowding affects every `ActionBarState` (`incomplete`, `ready`, `fetched`, `all-done`), not just `fetched` — `fetched` is just the worst case because it has the longest subtitle and the most buttons.

## Goal

On mobile, present the same information and controls in a compact, predictable two-row layout. On `sm` and up, the bar's appearance is byte-identical to today.

## Design

### Layout — outer wrapper

The inner container at `ActionBar.tsx:49` changes from:

```
flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-2.5 md:px-6
```

to:

```
flex w-full max-w-5xl flex-col items-stretch gap-2 px-4 py-2.5
  sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6
```

On mobile: column flex, full-width children, gap-2 between rows.
On `sm+`: existing row flex, unchanged spacing.

### Layout — per-state action group

Each state (`incomplete`, `ready`, `fetched`, `all-done`) currently renders:

- a status `<div>` (icon + title + optional subtitle) with `flex-1 min-w-0`
- an action `<div>` (one or more buttons) with `shrink-0`

These two divs become Row 1 and Row 2 on mobile automatically thanks to the parent `flex-col`. To right-align buttons on Row 2 (mobile), the action `<div>` gets `justify-end`:

```
flex items-center gap-2 shrink-0  →  flex items-center justify-end gap-2 shrink-0
```

(`justify-end` is a no-op on `sm+` because the parent's `justify-between` already pins the action group to the right.)

### Layout — trailing Checklist slot

The Checklist button at `ActionBar.tsx:149–159` lives in its own trailing slot with a left-border divider:

```
shrink-0 pl-2.5 ml-0.5 border-l border-slate-200 dark:border-slate-700 flex items-center
```

The `border-l` makes sense as a separator only inside a single row. On mobile, the Checklist slot is at the *start* of Row 2 (or wherever flex packs it), so the divider becomes meaningless visual noise. Make the divider and its spacing `sm:`-only:

```
shrink-0 flex items-center
  sm:pl-2.5 sm:ml-0.5 sm:border-l sm:border-slate-200 dark:sm:border-slate-700
```

On mobile, the Checklist button joins the per-state action group as a flat sibling. To make this happen, the Checklist slot needs to be part of the same Row-2 cluster as the per-state actions. The simplest structural change: keep the Checklist slot in its current position in the JSX (it sits *outside* each state's action `<div>`), and on mobile let the parent flex wrap them adjacent. Since the parent is `flex-col` on mobile, both the per-state action `<div>` and the Checklist `<div>` are siblings stacked vertically — that would put Checklist on Row 3, not Row 2.

To keep Checklist on Row 2 with the other buttons on mobile, wrap the per-state action group **and** the Checklist slot in a shared parent `<div className="flex items-center justify-end gap-2 sm:gap-2">`. This wrapper exists in all four states; render the per-state buttons inside it followed by the Checklist trailing slot.

#### Proposed JSX shape

```tsx
<div className="sticky top-[44px] z-10 ...">
  <div className="mx-auto flex w-full max-w-5xl flex-col items-stretch gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6">
    {/* Status block — per-state */}
    {state === "incomplete" && <IncompleteStatus ... />}
    {state === "ready" && <ReadyStatus ... />}
    {state === "fetched" && <FetchedStatus ... />}
    {state === "all-done" && <AllDoneStatus ... />}

    {/* Action group — per-state buttons + Checklist */}
    <div className="flex items-center justify-end gap-2 shrink-0">
      {state === "incomplete" && <FetchButton ... />}
      {state === "ready" && <FetchButton ... />}
      {state === "fetched" && <><RefetchButton /><ReviewDecisionLink /></>}
      {state === "all-done" && <><PrintButton /><AcknowledgeButton /></>}
      <div className="flex items-center sm:ml-0.5 sm:border-l sm:border-slate-200 sm:pl-2.5 dark:sm:border-slate-700">
        <ChecklistButton onClick={onOpenChecklist} />
      </div>
    </div>
  </div>
</div>
```

The action group becomes a single flex row that lives in Row 2 on mobile, and packs to the right on `sm+`. Whether the per-state buttons are kept inline as today or extracted into the small named sub-components shown above is implementation-flavor; either preserves behavior.

### Layout — subtitle text

The subtitle prose inside the `ready` and `fetched` status blocks is redundant once the bar is no longer covering the weather data. On mobile, hide it to keep Row 1 a single line:

- `ActionBar.tsx:72` — `<div className="text-xs text-slate-600 dark:text-slate-400">` → add `hidden sm:block`.
- `ActionBar.tsx:95` — same addition.

(The `incomplete` and `all-done` states do not have subtitles, so no change there.)

### Final mobile layout (illustrative)

```
┌──────────────────────────────────────────┐
│ ✓  Weather fetched · 05:17z              │  ← Row 1: status (subtitle hidden)
│ [↻ Re-fetch] [Review decision ▾] [☰ Cl…] │  ← Row 2: actions, right-aligned
└──────────────────────────────────────────┘
```

Approximate height: ~72px (down from ~360px in the bug screenshot).

## Files changed

- `src/components/ActionBar.tsx` — the structural change above.
- `src/components/ActionBar.test.tsx` — add regression assertions described below.

## Testing

Existing assertions in `ActionBar.test.tsx` (presence of "Weather fetched" text, Re-fetch button click handler, etc.) must continue to pass.

New tests:

1. **Outer wrapper has responsive flex direction.** Render `ActionBar` and query the inner container; assert it carries both `flex-col` and `sm:flex-row` classes. This is the structural change that fixes #120 — asserting the classnames is the most reliable way to lock in the fix in JSDom, which does not evaluate Tailwind breakpoints.
2. **Subtitle is hidden on mobile.** For `state="fetched"` and `state="ready"`, locate the subtitle node and assert it has `hidden sm:block` classes.
3. **Checklist divider is `sm`-only.** Locate the Checklist slot and assert its border/padding classes are `sm:`-prefixed.

No visual regression test is added — we don't run one today and this change does not warrant introducing the dependency. Manual verification on a real mobile viewport is part of the implementation acceptance.

## Manual verification

Per `AGENTS.md`, UI changes require browser verification:

1. `npm run dev`, open the worksheet on a phone-sized viewport (375–414px).
2. Fill in airports + date + time, fetch weather.
3. Confirm the ActionBar is two short rows (~72px total), status on top, action buttons right-aligned on the second row, no wrapped prose.
4. Resize to ≥640px; confirm the bar collapses back to a single row identical to current behavior.
5. Repeat for each state: empty (incomplete), filled-but-not-fetched (ready), fetched, all-done.

## Out of scope

- `WeatherSection`, `WeatherDataIntegration`, airport cards — unaffected by this change.
- Icon-only mobile buttons — rejected during brainstorming; would hurt CTA discoverability.
- Kebab/overflow menu — rejected; the two-row layout removes the need.
- Desktop layout changes — none.

## Risks

- The `sm:` breakpoint is 640px in Tailwind v4 defaults. Tablets in portrait at ~768px will stay on the desktop layout, which is correct given that the bug only appears at narrow phone widths. If the project later wants the stacked layout to kick in at a different breakpoint, swap `sm:` for `md:` uniformly.
- Restructuring the JSX into a single action group wrapper is the riskiest part (it touches every state); each per-state branch must still render the same buttons in the same order. Existing tests assert button presence per state and will catch regressions.
