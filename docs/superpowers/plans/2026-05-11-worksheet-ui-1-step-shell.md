# Worksheet UI Redesign — Phase 1: Step Shell Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a sticky 3-pill stepper above the worksheet that scroll-spies the three logical sections (Sortie Details, Weather, Decision), and relocate `InstructionsAndNotes` from the top of the page to the bottom alongside `MountainFlyingChecklist`. No inner-component refactors — this phase is purely navigational.

**Architecture:** One new client component (`Stepper`) using `IntersectionObserver` for scroll-spy. `AppInputs` is reshaped so its rendered children fall under two semantic `<section>` elements with `id` anchors; `AppContainer` wraps `Calculations` in a third anchor. Heroicons used for the separator caret. No state changes — step colors are hardcoded in this phase (Phase 3 will derive them from real data).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `@heroicons/react/24/outline`, Jest + Testing Library (existing setup).

**Read before starting:** `docs/superpowers/plans/2026-05-11-worksheet-ui-redesign-index.md` for the full series context, and skim `docs/numbered-step-shell-mockup.html` for the visual target.

---

## File Structure

**Create:**
- `src/components/Stepper.tsx` — sticky 3-pill nav with `IntersectionObserver` scroll-spy
- `src/components/Stepper.test.tsx` — colocated component test

**Modify:**
- `src/components/AppContainer.tsx` — render `<Stepper>` below header; wrap `<Calculations>` in `<section id="step-decision">`; move `<InstructionsAndNotes>` from above `<AppInputs>` to below `<MountainFlyingChecklist>`
- `src/components/AppInputs.tsx` — replace the single outer flex `<div>` with two semantic `<section>` elements: `id="step-sortie"` (wraps `SortieInfo` + `MountainQuals`) and `id="step-weather"` (wraps `WeatherInfo` + `AircraftPerformance`)
- `src/components/AppContainer.test.tsx` — assert new order; assert stepper is present
- `src/components/AppInputs.test.tsx` — assert the two section anchors exist

**Anchor ids used (kept consistent across all 5 phases):**
- `step-sortie` (Step 1, slate / active)
- `step-weather` (Step 2, emerald / complete once fetched)
- `step-decision` (Step 3, amber / warning when verdict has cautions)

---

## Task 1: Stepper component — skeleton + render test

**Files:**
- Create: `src/components/Stepper.tsx`
- Create: `src/components/Stepper.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/Stepper.test.tsx
import { render, screen } from "@testing-library/react";
import Stepper from "./Stepper";

const defaultSteps = [
  { id: "step-sortie",   number: 1, label: "Sortie Details", status: "active"   as const },
  { id: "step-weather",  number: 2, label: "Weather",        status: "pending"  as const },
  { id: "step-decision", number: 3, label: "Decision",       status: "pending"  as const },
];

describe("Stepper", () => {
  it("renders all step labels and numbers", () => {
    render(<Stepper steps={defaultSteps} />);
    expect(screen.getByText("Sortie Details")).toBeInTheDocument();
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders each step as an anchor pointing to its section id", () => {
    render(<Stepper steps={defaultSteps} />);
    expect(screen.getByRole("link", { name: /Sortie Details/ })).toHaveAttribute("href", "#step-sortie");
    expect(screen.getByRole("link", { name: /Weather/ })).toHaveAttribute("href", "#step-weather");
    expect(screen.getByRole("link", { name: /Decision/ })).toHaveAttribute("href", "#step-decision");
  });

  it("uses the active-step className when activeId is explicitly set", () => {
    render(<Stepper steps={defaultSteps} activeId="step-weather" />);
    const weather = screen.getByRole("link", { name: /Weather/ });
    expect(weather).toHaveAttribute("data-active", "true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/Stepper.test.tsx`
Expected: FAIL — `Cannot find module './Stepper'`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/Stepper.tsx
"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

export type StepStatus = "pending" | "active" | "complete" | "warning";

export interface StepperStep {
  id: string;
  number: number;
  label: string;
  status: StepStatus;
  /** Optional small badge text rendered after the label (e.g. "8 of 11", "●", "⚠ 1"). */
  badge?: string;
}

interface StepperProps {
  steps: StepperStep[];
  /** If set, this id is the active pill. If undefined, scroll-spy picks the active id. */
  activeId?: string;
}

const circleBg: Record<StepStatus, string> = {
  pending:  "bg-slate-300",
  active:   "bg-slate-900",
  complete: "bg-emerald-500",
  warning:  "bg-amber-500",
};

const badgeColor: Record<StepStatus, string> = {
  pending:  "text-slate-500",
  active:   "text-slate-900",
  complete: "text-emerald-600",
  warning:  "text-amber-600",
};

export default function Stepper({ steps, activeId }: StepperProps) {
  const [scrollSpyId, setScrollSpyId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (activeId !== undefined) return; // explicit control wins
    if (typeof IntersectionObserver === "undefined") return; // SSR / jsdom safety
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.sort(
          (a, b) =>
            a.target.getBoundingClientRect().top -
            b.target.getBoundingClientRect().top
        )[0];
        setScrollSpyId(topMost.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    steps.forEach((step) => {
      const el = document.getElementById(step.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [steps, activeId]);

  const currentId = activeId ?? scrollSpyId ?? steps[0]?.id;

  return (
    <nav
      aria-label="Worksheet steps"
      className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75"
    >
      <div className="mx-auto max-w-5xl px-4 py-2.5 md:px-6">
        <ol className="flex items-center gap-1.5 overflow-x-auto text-sm">
          {steps.map((step, i) => {
            const isActive = currentId === step.id;
            return (
              <Fragment key={step.id}>
                {i > 0 && (
                  <li aria-hidden="true" className="text-slate-300">
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </li>
                )}
                <li className="shrink-0">
                  <a
                    href={`#${step.id}`}
                    data-active={isActive || undefined}
                    className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 transition-all data-[active]:ring-2 data-[active]:ring-slate-900 data-[active]:shadow-sm"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${circleBg[step.status]} font-mono text-xs font-semibold text-white`}
                    >
                      {step.number}
                    </span>
                    <span
                      className={
                        isActive
                          ? "font-medium text-slate-900"
                          : "text-slate-700"
                      }
                    >
                      {step.label}
                    </span>
                    {step.badge && (
                      <span
                        className={`text-xs font-medium ${badgeColor[step.status]}`}
                      >
                        {step.badge}
                      </span>
                    )}
                  </a>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/Stepper.test.tsx`
Expected: PASS — all three tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/Stepper.tsx src/components/Stepper.test.tsx
git commit -m "Add Stepper component for worksheet UI redesign

Sticky 3-pill nav with IntersectionObserver-based scroll-spy. Per-step
status (pending/active/complete/warning) drives the numbered-circle
color. Caller can override scroll-spy via the activeId prop."
```

---

## Task 2: Add anchor ids to AppInputs sections

**Files:**
- Modify: `src/components/AppInputs.tsx` (whole render block, lines 27–44)
- Modify: `src/components/AppInputs.test.tsx` (add anchor assertion)

- [ ] **Step 1: Update the test to assert the anchors exist**

Open `src/components/AppInputs.test.tsx` and add this test inside the existing `describe` block:

```tsx
it("wraps Sortie Details and Weather in semantic sections with stable anchor ids", () => {
  const { container } = render(
    <AppInputs state={defaultState} onStateUpdate={() => {}} />
  );
  expect(container.querySelector("#step-sortie")).not.toBeNull();
  expect(container.querySelector("#step-weather")).not.toBeNull();
});
```

(If `defaultState` doesn't already exist in the test file, mirror the literal from `AppContainer.tsx:36-78` or import the existing fixture used by other tests in that file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/AppInputs.test.tsx`
Expected: FAIL — `#step-sortie` not found.

- [ ] **Step 3: Restructure the AppInputs render**

Replace the JSX `return` block (currently lines 27–44 of `src/components/AppInputs.tsx`) with:

```tsx
return (
  <div className="flex w-full max-w-4xl flex-col gap-8">
    <section id="step-sortie" className="flex flex-col gap-8 scroll-mt-[60px]">
      <SortieInfo onUpdate={handleUpdate} initialData={state} />
      <MountainQuals onUpdate={handleUpdate} initialData={state} />
    </section>
    <section id="step-weather" className="flex flex-col gap-8 scroll-mt-[60px]">
      <WeatherInfo
        onUpdate={handleUpdate}
        initialData={state}
        lastUpdated={weatherLastUpdated}
        useFahrenheit={useFahrenheit}
      />
      <AircraftPerformance
        onUpdate={handleUpdate}
        initialData={state}
        worksheetData={state}
        useFahrenheit={useFahrenheit}
      />
    </section>
  </div>
);
```

`scroll-mt-[60px]` accounts for the ~44px-tall sticky stepper plus padding so anchor jumps don't hide section headers under it. (Phase 3 increases this when the action bar adds a second sticky stripe.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/AppInputs.test.tsx`
Expected: PASS — anchor assertion green, no other AppInputs tests broken.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppInputs.tsx src/components/AppInputs.test.tsx
git commit -m "Wrap AppInputs children in step-sortie and step-weather sections

Adds stable anchor ids used by the new Stepper. No visual change beyond
the wrapping <section> element."
```

---

## Task 3: Wrap Calculations in step-decision anchor + integrate Stepper + relocate InstructionsAndNotes

**Files:**
- Modify: `src/components/AppContainer.tsx` (the JSX `return`, lines 114–151)
- Modify: `src/components/AppContainer.test.tsx`

- [ ] **Step 1: Update the test**

Open `src/components/AppContainer.test.tsx` and add (inside the existing top-level `describe`):

```tsx
it("renders the worksheet Stepper above the inputs", () => {
  render(<AppContainer />);
  expect(screen.getByRole("navigation", { name: /worksheet steps/i })).toBeInTheDocument();
});

it("wraps Calculations in the step-decision anchor", () => {
  const { container } = render(<AppContainer />);
  const anchor = container.querySelector("#step-decision");
  expect(anchor).not.toBeNull();
});

it("renders InstructionsAndNotes below MountainFlyingChecklist", () => {
  const { container } = render(<AppContainer />);
  const all = Array.from(container.querySelectorAll("details > summary"));
  const labels = all.map((s) => s.textContent ?? "");
  const checklistIdx = labels.findIndex((t) => t.includes("Mountain Flying Checklist"));
  const instructionsIdx = labels.findIndex((t) => t.includes("Instructions and Notes"));
  expect(checklistIdx).toBeGreaterThan(-1);
  expect(instructionsIdx).toBeGreaterThan(-1);
  expect(instructionsIdx).toBeGreaterThan(checklistIdx);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/AppContainer.test.tsx`
Expected: FAIL — `navigation` not found; `#step-decision` not found; InstructionsAndNotes still above.

- [ ] **Step 3: Update the AppContainer imports**

At the top of `src/components/AppContainer.tsx`, add:

```tsx
import Stepper from "@/components/Stepper";
```

- [ ] **Step 4: Replace the `<main>` block**

Replace the existing `<main>...</main>` (currently lines 126–138) with:

```tsx
<Stepper
  steps={[
    { id: "step-sortie",   number: 1, label: "Sortie Details", status: "active" },
    { id: "step-weather",  number: 2, label: "Weather",        status: "pending" },
    { id: "step-decision", number: 3, label: "Decision",       status: "pending" },
  ]}
/>
<main className="flex-1 w-full flex justify-center px-2 md:px-8 pb-20">
  <div className="w-full max-w-5xl flex flex-col gap-16 items-center">
    <AppInputs
      state={state}
      onStateUpdate={handleUpdate}
      weatherLastUpdated={weatherLastUpdated ?? undefined}
      useFahrenheit={useFahrenheit}
    />
    <section id="step-decision" className="w-full flex justify-center scroll-mt-[60px]">
      <Calculations state={state} />
    </section>
    <MountainFlyingChecklist />
    <InstructionsAndNotes />
  </div>
</main>
```

(Step statuses are hardcoded here. Phase 3 wires them to derived state.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/components/AppContainer.test.tsx`
Expected: PASS — Stepper nav present, `#step-decision` present, InstructionsAndNotes ordered after the Checklist.

- [ ] **Step 6: Run the full test suite to catch regressions**

Run: `npx jest`
Expected: PASS — no other tests broken. If `AppContainer.test.tsx` had a snapshot assertion, update it (`-u`) once you've eyeballed that the new structure is what you want.

- [ ] **Step 7: Visual smoke test**

```bash
npm run dev
```

Open <http://localhost:3000>. Verify by eye:

1. A sticky bar with three pills (Sortie Details / Weather / Decision) appears below the dark header.
2. Clicking each pill scrolls to the right section and that section's heading is visible (not hidden under the stepper).
3. As you scroll, the active pill (with the slate ring around it) tracks the section in view.
4. `Instructions and Notes` now lives at the bottom of the page, after `Mountain Flying Checklist`.

If any of those fail, fix and re-run `npx jest`. Don't commit until visual smoke passes.

- [ ] **Step 8: Commit**

```bash
git add src/components/AppContainer.tsx src/components/AppContainer.test.tsx
git commit -m "Wire Stepper into AppContainer and relocate Instructions

- Renders Stepper below the worksheet header with three hardcoded
  steps (real status derivation comes in phase 3).
- Wraps Calculations in #step-decision anchor for stepper navigation.
- Moves InstructionsAndNotes from the top of main to the bottom,
  alongside MountainFlyingChecklist."
```

---

## Verification — full phase

- [ ] All four commits are on the branch:
  ```bash
  git log --oneline -4
  ```
  Expected: the three commits from tasks 1–3 plus the existing tip.

- [ ] Jest is green:
  ```bash
  npx jest
  ```

- [ ] TypeScript is clean:
  ```bash
  npx tsc --noEmit
  ```

- [ ] Manual checklist (in a browser):
  - Stepper sticks to the top of the viewport on scroll
  - Each pill's anchor link scrolls to the right section with a comfortable offset
  - Scroll-spy highlights the pill matching the section currently in view
  - Mountain Flying Checklist and Instructions and Notes both render at the bottom, in that order, both still collapsible
  - No console errors

---

## Out of scope for Phase 1 (do **not** add here)

- `StepShell` component (numbered circle + left rail + section card) — Phase 2
- Slim header / Fetch button relocation — Phase 3
- Weather section merge / airport cards — Phase 4
- Slide-overs for Instructions and Checklist — Phase 5
- Real step status derivation from state — Phase 3
