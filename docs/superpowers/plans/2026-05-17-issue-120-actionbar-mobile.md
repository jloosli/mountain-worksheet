# Issue #120 — ActionBar Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the sticky `ActionBar` so it occupies ~72px instead of ~360px on phone-sized viewports (issue #120), by stacking its status row above its action row below the `sm` breakpoint and hiding the redundant subtitle on mobile.

**Architecture:** Single-file restructure of `src/components/ActionBar.tsx`. The outer flex container becomes `flex-col` on mobile and `sm:flex-row` on tablet+. The per-state status block and the per-state action buttons (plus Checklist) live in two separate sibling `<div>`s — the action buttons and the Checklist trigger are merged into one shared wrapper so they all land on Row 2 on mobile and on the right side on desktop. Subtitles are `hidden sm:block`. The Checklist's left-border divider is `sm:`-only.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-17-issue-120-actionbar-mobile-design.md`.

---

## File Structure

- `src/components/ActionBar.tsx` — restructure the `return (...)` JSX. The per-state branches each emit two siblings (a status `<div>` and the actions go into a shared `<div>` outside the branch). The `FetchButton` helper component below is unchanged.
- `src/components/ActionBar.test.tsx` — add three regression tests covering: (a) outer wrapper carries `flex-col` and `sm:flex-row`, (b) `ready`/`fetched` subtitles carry `hidden sm:block`, (c) Checklist divider classes are `sm:`-prefixed.

No other files change.

---

## Task 1: Regression tests for responsive layout classes (write first, expect failures)

**Files:**
- Modify: `src/components/ActionBar.test.tsx` (append new `describe` block)

The Tailwind breakpoints `sm:` and `md:` are not evaluated by JSDom — `window.matchMedia("(min-width: 640px)")` returns nothing meaningful in the test environment. The reliable signal that the responsive change is in place is the presence of the responsive class names on the rendered DOM. These tests assert classnames directly.

- [ ] **Step 1: Add the regression `describe` block to `ActionBar.test.tsx`**

Append the following at the end of `src/components/ActionBar.test.tsx` (after the existing `describe("ActionBar — Checklist trigger", ...)` block, before EOF):

```tsx
describe("ActionBar — responsive mobile layout (issue #120)", () => {
  const fetched = {
    ...baseProps,
    state: "fetched" as const,
    weatherLastUpdated: new Date("2026-05-12T14:31:00Z"),
  };
  const ready = {
    ...baseProps,
    state: "ready" as const,
    worksheetData: {
      ...empty,
      airport: ["KOGD", "KLGU"] as [string, string],
      date: "2026-05-12",
      time: "18:00",
    },
  };

  function getInnerWrapper(container: HTMLElement): HTMLElement {
    // Inner flex container: the `<div>` carrying `max-w-5xl`
    const el = container.querySelector(".max-w-5xl");
    if (!el) throw new Error("inner wrapper not found");
    return el as HTMLElement;
  }

  it("outer wrapper stacks on mobile and rows on sm+", () => {
    const { container } = render(<ActionBar {...fetched} />);
    const wrapper = getInnerWrapper(container);
    expect(wrapper.className).toMatch(/\bflex-col\b/);
    expect(wrapper.className).toMatch(/\bsm:flex-row\b/);
  });

  it("fetched subtitle is hidden on mobile", () => {
    render(<ActionBar {...fetched} />);
    const subtitle = screen.getByText(
      /Review the weather below, then proceed to the decision/i
    );
    expect(subtitle.className).toMatch(/\bhidden\b/);
    expect(subtitle.className).toMatch(/\bsm:block\b/);
  });

  it("ready subtitle is hidden on mobile", () => {
    render(<ActionBar {...ready} />);
    const subtitle = screen.getByText(/ready to fetch weather/i);
    expect(subtitle.className).toMatch(/\bhidden\b/);
    expect(subtitle.className).toMatch(/\bsm:block\b/);
  });

  it("Checklist divider is sm:-only", () => {
    render(<ActionBar {...baseProps} state="incomplete" fetchDisabled={true} />);
    const checklistBtn = screen.getByRole("button", { name: /Checklist/i });
    const slot = checklistBtn.parentElement;
    if (!slot) throw new Error("Checklist slot not found");
    expect(slot.className).toMatch(/\bsm:border-l\b/);
    // Plain `border-l` must NOT appear unprefixed — the divider is gated by sm:.
    expect(slot.className).not.toMatch(/(^|\s)border-l(\s|$)/);
  });
});
```

- [ ] **Step 2: Run the new tests, expect them to fail**

Run:

```bash
npx jest src/components/ActionBar.test.tsx -t "responsive mobile layout"
```

Expected: 4 failures. The failures will be className-mismatch assertions like `Expected: stringMatching /\bflex-col\b/   Received: "mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-2.5 md:px-6"`. This confirms the tests are correctly observing the *current* (broken) layout, so when we change the layout they will turn green.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/components/ActionBar.test.tsx
git commit -m "$(cat <<'EOF'
test(action-bar): regression tests for issue #120 mobile layout

Asserts that the inner wrapper uses flex-col on mobile and sm:flex-row
on tablet+, that the ready/fetched subtitles are hidden on mobile, and
that the Checklist divider is sm:-only. Tests fail against the current
implementation by design.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Committing failing tests separately makes the bisect history clean: the next commit is the one that flips them green.

---

## Task 2: Restructure ActionBar JSX and apply responsive classes

**Files:**
- Modify: `src/components/ActionBar.tsx` (replace the `return (...)` body of the default export)

The change is interrelated — the JSX restructure (splitting status from actions, merging actions with Checklist) and the responsive class additions land together. Do them in one edit, then run tests once.

- [ ] **Step 1: Replace the `ActionBar` default-export function**

Open `src/components/ActionBar.tsx`. Replace the entire `export default function ActionBar(...)` definition (from `export default function` through its matching closing `}`) with the implementation below. The imports at the top of the file, the `formatHhMmZ` / `formatClockUtc` helpers above the function, the `ActionBarProps` interface, and the `FetchButton` helper component below the function all stay exactly as they are today.

```tsx
export default function ActionBar({
  state,
  worksheetData,
  weatherLastUpdated,
  onFetch,
  fetchDisabled,
  isFetching,
  onOpenChecklist,
}: ActionBarProps) {
  return (
    <div className="sticky top-[44px] z-10 border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_8px_-6px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-stretch gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6">
        {state === "incomplete" && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <ExclamationCircleIcon className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Add departure airport, arrival airport, date, and time to fetch weather
              </div>
            </div>
          </div>
        )}

        {state === "ready" && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Sortie details ready
              </div>
              <div className="hidden sm:block text-xs text-slate-600 dark:text-slate-400">
                {worksheetData.airport[0] || "—"} → {worksheetData.airport[1] || "—"} · departing {formatHhMmZ(worksheetData.time)} · ready to fetch weather
              </div>
            </div>
          </div>
        )}

        {state === "fetched" && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Weather fetched
                {weatherLastUpdated && (
                  <>
                    {" "}
                    · <span className="font-mono text-slate-700 dark:text-slate-300">{formatClockUtc(weatherLastUpdated)}</span>
                  </>
                )}
              </div>
              <div className="hidden sm:block text-xs text-slate-600 dark:text-slate-400">
                Review the weather below, then proceed to the decision.
              </div>
            </div>
          </div>
        )}

        {state === "all-done" && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <StarIcon className="h-5 w-5 text-slate-900 shrink-0 dark:text-slate-100" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                All checks complete — verdict ready for review
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 shrink-0">
          {state === "incomplete" && (
            <FetchButton onClick={onFetch} disabled={true} isLoading={isFetching} />
          )}

          {state === "ready" && (
            <FetchButton onClick={onFetch} disabled={fetchDisabled} isLoading={isFetching} />
          )}

          {state === "fetched" && (
            <>
              <button
                type="button"
                onClick={onFetch}
                disabled={fetchDisabled || isFetching}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <ArrowPathIcon className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                {isFetching ? "Loading…" : "Re-fetch"}
              </button>
              <a
                href="#step-decision"
                className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Review decision
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </a>
            </>
          )}

          {state === "all-done" && (
            <>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <PrinterIcon className="h-3.5 w-3.5" />
                Print briefing
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Acknowledge &amp; proceed
              </button>
            </>
          )}

          <div className="flex items-center sm:ml-0.5 sm:border-l sm:border-slate-200 sm:pl-2.5 dark:sm:border-slate-700">
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
        </div>
      </div>
    </div>
  );
}
```

Summary of what changed relative to the original:

1. **Inner wrapper classes** (line ~49 in original): added `flex-col items-stretch gap-2`, prefixed the original row-flex classes with `sm:` (`sm:flex-row sm:items-center sm:justify-between sm:gap-4`). Removed plain `items-center justify-between gap-4`.
2. **Per-state JSX shape**: each state branch used to be a `<>…</>` fragment containing both the status `<div>` and the actions `<div>` (or trailing FetchButton). Now each state branch renders only the status `<div>`. The action contents move into a shared trailing `<div className="flex items-center justify-end gap-2 shrink-0">` that wraps all four states' button sets plus the Checklist trigger.
3. **Checklist slot classes**: was `shrink-0 pl-2.5 ml-0.5 border-l border-slate-200 dark:border-slate-700 flex items-center`; now `flex items-center sm:ml-0.5 sm:border-l sm:border-slate-200 sm:pl-2.5 dark:sm:border-slate-700`. The `shrink-0` is removed because the slot now lives inside an already-shrunk container, and the visual divider is `sm:`-only.
4. **Subtitle classes** in `ready` and `fetched` states: added `hidden sm:block` to the `text-xs` `<div>`s.

Nothing else changes — `FetchButton`, the imports, the formatters, and the props interface are untouched.

- [ ] **Step 2: Run the new regression tests**

```bash
npx jest src/components/ActionBar.test.tsx -t "responsive mobile layout"
```

Expected: all 4 tests pass.

- [ ] **Step 3: Run the full ActionBar test suite**

```bash
npx jest src/components/ActionBar.test.tsx
```

Expected: all tests pass (existing tests for incomplete/ready/fetched/all-done states, Checklist, isFetching, plus the 4 new ones).

- [ ] **Step 4: Run the entire test suite**

```bash
npm test
```

Expected: all suites pass. Watch in particular for failures in `AppContainer.test.tsx` or anything that uses `ActionBar` indirectly. There should be none — the public surface (props, button labels, links, click handlers) is unchanged.

- [ ] **Step 5: Run lint and the production build**

```bash
npm run lint && npm run build
```

Expected: lint reports no errors; build succeeds. Tailwind v4 picks up the new responsive classnames at build time.

- [ ] **Step 6: Commit**

```bash
git add src/components/ActionBar.tsx
git commit -m "$(cat <<'EOF'
fix(action-bar): stack rows on mobile to fix #120

Below the sm breakpoint, the sticky ActionBar now renders status text
on row 1 and action buttons on row 2 (right-aligned), instead of
forcing a single row that wraps the status prose into ~9 short lines
and consumes ~360px of vertical scroll.

Also: hide the redundant ready/fetched subtitle on mobile, and make
the Checklist trailing divider sm:-only so it does not appear at the
top of the wrapped action row.

Fixes #120.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Manual mobile-viewport verification in Chrome

Per `AGENTS.md`: UI changes must be tested in a browser, not just via unit tests.

**Files:** none modified in this task.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Next.js dev server starts on `http://localhost:3000` (Turbopack).

- [ ] **Step 2: Open Chrome devtools at a phone viewport**

Navigate to `http://localhost:3000/`. Open devtools (Cmd+Opt+I), toggle device toolbar (Cmd+Shift+M), select "iPhone 14 Pro" (or any 390×844 preset). Reload.

- [ ] **Step 3: Verify each ActionBar state visually**

For each scenario below, visually confirm:
- The ActionBar is at most ~80px tall (two short rows, not nine).
- Row 1 shows status icon + title on a single line; no wrapped prose.
- Row 2 shows the action buttons right-aligned; the Checklist button is part of the same row, with no left-border divider.

Scenarios:

1. **incomplete** — open the page fresh, leave fields blank. ActionBar should read "Add departure airport, arrival airport, date, and time to fetch weather" + disabled "Fetch weather" button + Checklist.
2. **ready** — fill in departure (e.g. `KOGD`), arrival (`KLGU`), date, time. ActionBar should read "Sortie details ready" + enabled "Fetch weather" button + Checklist. Subtitle ("KOGD → KLGU · departing …") should NOT be visible.
3. **fetched** — click "Fetch weather", wait for the data to populate. ActionBar should read "Weather fetched · HH:MMz" + Re-fetch + Review decision + Checklist. Subtitle ("Review the weather below…") should NOT be visible.
4. **all-done** — open the Checklist panel and tick every item, then close it. ActionBar should read "All checks complete — verdict ready for review" + Print briefing + Acknowledge & proceed + Checklist.

- [ ] **Step 4: Verify desktop layout is unchanged**

In the device toolbar, switch to "Responsive" and drag the viewport to ≥640px (e.g. 1024×768). For each of the same four scenarios, the ActionBar collapses to a single row identical to the pre-fix appearance: status on the left, action buttons grouped on the right with the Checklist button separated by a thin vertical divider, and the ready/fetched subtitle visible.

- [ ] **Step 5: Stop the dev server**

In the terminal running `npm run dev`, press Ctrl+C.

- [ ] **Step 6: No commit needed**

Manual verification produces no new files. If you discovered a regression and made a fix, commit it separately with a `fix(action-bar):` message and append a step here describing the fix.

---

## Done criteria

All of the following must hold:

1. `npx jest src/components/ActionBar.test.tsx` passes (existing + 4 new regression tests).
2. `npm test` passes everywhere.
3. `npm run lint && npm run build` both succeed.
4. Manual mobile-viewport verification (Task 3) passes for all four ActionBar states.
5. `git log` shows two commits in the worktree branch: the failing-tests commit and the fix commit (and optionally the existing spec-doc commit). No fixup commits dangling.
