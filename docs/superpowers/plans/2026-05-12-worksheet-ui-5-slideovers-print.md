# Worksheet UI Redesign — Phase 5: Slide-overs, Decision Disclaimer, Print Stylesheet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two bottom-of-page accordions (`InstructionsAndNotes`, `MountainFlyingChecklist`) with right-side slide-over panels triggered by a `?` icon in the slim header and a `Checklist` button on the action bar. Add a "For reference only" inline disclaimer above the calculations in the Decision step. Add a print stylesheet so the worksheet PDFs cleanly for the Sortie Files artifact, with the slide-over content expanded as appendices.

**Architecture:** A new `SlideOver` shared component wraps `@headlessui/react`'s `Dialog` + `Transition` for the screen UX (focus trap, ESC-to-close, backdrop click). To keep slide-over content addressable for print, the panels render via `Dialog` with `static={true}` so the DOM is mounted regardless of open state — Tailwind's `print:` variants then re-position them statically and force a `page-break-before` for each panel. Overlay state (`"instructions" | "checklist" | null`) is a single `useState` in `AppContainer` shared between the header trigger and the action-bar trigger so only one panel is open at a time. The existing `InstructionsAndNotes` and `MountainFlyingChecklist` components are refactored in place — their data constants and JSX move into `InstructionsPanel` / `ChecklistPanel` slide-over bodies — and the old `<details>` accordion shells (plus their bottom-of-page mounts in `AppContainer`) are deleted. The "For reference only" disclaimer is a small inline block prepended inside `Calculations` (which lives inside Step 3's `StepShell`).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `@headlessui/react` Dialog + Transition (already in use by `WeatherModal`), `@heroicons/react/24/outline`, Jest + Testing Library.

**Read before starting:** `docs/superpowers/plans/2026-05-11-worksheet-ui-redesign-index.md` for series context, `docs/numbered-step-shell-mockup.html` — specifically the slide-over CSS (lines ~66–144), the slide-over panels (lines ~636–769), the `?` icon header trigger (lines ~158–163), the Checklist action-bar button (lines ~282–290), the Decision step's "For reference only" disclaimer (lines ~606–614), and the `@media print` rules (lines ~129–144). The bottom-right "demo cycler" in the mockup is not part of Phase 5 — it's a mockup-only affordance.

---

## File Structure

**Create:**

- `src/components/SlideOver.tsx` — generic right-side panel built on `@headlessui/react` `Dialog` + `Transition`. Renders header (title + close `X` button) and a scrollable body region. Uses `static` so the DOM stays mounted for print.
- `src/components/SlideOver.test.tsx` — colocated unit tests covering open/close behaviour, ESC handling, backdrop click, and title rendering.
- `src/components/InstructionsPanel.tsx` — slide-over body for instructions + operational notes. Owns the data constants (`positionFormats`, `usingTheToolNotes`, `operationalNotes`) currently in `InstructionsAndNotes.tsx`.
- `src/components/InstructionsPanel.test.tsx` — verifies the panel renders the three sections (Special Inputs, Using the Tool, Notes) and the `Operational Notes` emphasis lines.
- `src/components/ChecklistPanel.tsx` — slide-over body for the Mountain Flying Checklist. Owns the `sections` constant currently in `MountainFlyingChecklist.tsx`.
- `src/components/ChecklistPanel.test.tsx` — verifies the seven section headings render with their bullet items.
- `src/app/print.css` — `@import`-able stylesheet with the `@media print` rules that complement Tailwind `print:` variants (slide-over re-positioning + page-break behaviour).

**Modify:**

- `src/components/WorksheetHeader.tsx` — add `?` icon button to the right of the title (left of the existing Reset/Copy link/°F cluster); wire it to a new `onOpenInstructions` callback prop.
- `src/components/WorksheetHeader.test.tsx` — assert the `?` icon button is rendered with the right `aria-label`, and that clicking it calls `onOpenInstructions`.
- `src/components/ActionBar.tsx` — add a persistent Checklist button (visible across all four states) on the right of the existing per-state action group; wire it to a new `onOpenChecklist` callback prop.
- `src/components/ActionBar.test.tsx` — assert the Checklist button renders and calls `onOpenChecklist`.
- `src/components/Calculations.tsx` — insert the "For reference only" disclaimer block above the existing children, beneath the existing aircraft-model warning. Pull the disclaimer copy from the operational notes' first item.
- `src/components/Calculations.test.tsx` — assert the disclaimer text is present and contains the link to open instructions.
- `src/components/AppContainer.tsx` — add `overlay` state and `handleOpenOverlay` / `handleCloseOverlay`; pass `onOpenInstructions` to `WorksheetHeader` and `onOpenChecklist` to `ActionBar`; mount `<InstructionsPanel>` and `<ChecklistPanel>` as siblings of `<main>`; remove the bottom-of-page `<InstructionsAndNotes />` and `<MountainFlyingChecklist />` mounts.
- `src/components/AppContainer.test.tsx` — drop the obsolete "renders InstructionsAndNotes below MountainFlyingChecklist" test (these no longer render in the main flow); add a smoke test that the two slide-over triggers exist.
- `src/app/globals.css` — import the new `print.css` (or inline the print rules directly if the project doesn't already split CSS files).

**Delete:**

- `src/components/InstructionsAndNotes.tsx`
- `src/components/MountainFlyingChecklist.tsx`

**Out of scope (do not add here):**

- StepShell card-header `Fetched 14:31 UTC` badge — deferred from Phases 3 and 4.
- Go / No-Go panel in Decision (recommendation #1 from `ux-assessment.md`) — separate plan.
- "Print briefing" and "Acknowledge & proceed" action-bar buttons in the `all-done` state — they render but stay inert until the Go/No-Go panel ships.
- AIRMET flag echoes between Step 2 advisories and Step 3 Decision warnings — separate polish-batch plan.
- Stepper field-count badges (`8 of 11`, `⚠ 1`) — separate polish-batch plan.

---

## Task 1: `SlideOver` shared component

**Files:**
- Create: `src/components/SlideOver.tsx`
- Create: `src/components/SlideOver.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SlideOver.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import SlideOver from "./SlideOver";

describe("SlideOver — open state", () => {
  it("renders the title and body when open", () => {
    render(
      <SlideOver isOpen={true} onClose={() => {}} title="Test title">
        <p>Body content</p>
      </SlideOver>
    );
    expect(screen.getByText("Test title")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("renders a Close button with an accessible label", () => {
    render(
      <SlideOver isOpen={true} onClose={() => {}} title="Test title">
        <p>Body</p>
      </SlideOver>
    );
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = jest.fn();
    render(
      <SlideOver isOpen={true} onClose={onClose} title="Test title">
        <p>Body</p>
      </SlideOver>
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("SlideOver — closed state", () => {
  it("does not show the body content visibly when closed", () => {
    render(
      <SlideOver isOpen={false} onClose={() => {}} title="Hidden title">
        <p>Hidden body</p>
      </SlideOver>
    );
    // With static=true the DOM is mounted but should be visually hidden
    // (off-screen via transform). Confirm the title is not announced to a
    // screen-reader user — the Dialog has aria-hidden when closed.
    const dialog = screen.queryByRole("dialog");
    if (dialog) {
      expect(dialog).toHaveAttribute("aria-hidden", "true");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/SlideOver.test.tsx`
Expected: FAIL — `Cannot find module './SlideOver'`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/SlideOver.tsx
"use client";

import { Fragment, type ReactNode } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function SlideOver({
  isOpen,
  onClose,
  title,
  children,
}: SlideOverProps) {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        onClose={onClose}
        // `static` keeps the panel mounted even when closed so a print
        // stylesheet can re-position it as a static appendix. Transition's
        // `show` controls visibility (transform + opacity).
        static
        className="relative z-40 print:static"
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-slate-900/40 print:hidden"
          />
        </Transition.Child>

        <Transition.Child
          as={Fragment}
          enter="ease-out duration-280"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in duration-220"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
        >
          <Dialog.Panel
            className="
              fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col
              border-l border-slate-200 bg-white shadow-2xl
              dark:border-slate-700 dark:bg-slate-900
              print:static print:max-w-none print:w-full print:border-l-0
              print:shadow-none print:break-before-page
            "
          >
            <header
              className="
                flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4
                dark:border-slate-700 dark:bg-slate-800
                print:hidden
              "
            >
              <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </Dialog.Title>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300 print:overflow-visible print:p-0">
              {children}
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}
```

Notes:
- The `static` prop on `Dialog` is the key knob — without it, Headless UI doesn't render the panel to DOM when closed, and the print stylesheet has nothing to re-position. With `static`, the panel stays mounted; `Transition`'s `show` controls visibility via Tailwind transform classes.
- The backdrop and header carry `print:hidden`; the panel itself carries `print:static print:max-w-none print:break-before-page` so it expands inline as an appendix in print.
- `Dialog.Title` automatically wires the `aria-labelledby` association, so the close button's `aria-label="Close"` plus the title text give correct screen-reader behaviour.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/SlideOver.test.tsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/SlideOver.tsx src/components/SlideOver.test.tsx
git commit -m "Add SlideOver shared component

Generic right-side panel built on @headlessui/react Dialog +
Transition. Uses static=true so the DOM stays mounted regardless of
open state — this is the hook the print stylesheet relies on to
re-position closed panels as static appendices.

Backdrop and header carry print:hidden; the panel itself carries
print:static + print:break-before-page so the body content flows
inline as a print appendix."
```

---

## Task 2: `InstructionsPanel` slide-over content

**Files:**
- Create: `src/components/InstructionsPanel.tsx`
- Create: `src/components/InstructionsPanel.test.tsx`

The data constants (`positionFormats`, `usingTheToolNotes`, `operationalNotes`) currently in `InstructionsAndNotes.tsx` move here unchanged. The `<details>` wrapper is dropped — the new component renders only the inner content. `AppContainer` (Task 5) wraps this in `<SlideOver>` for the screen UI.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/InstructionsPanel.test.tsx
import { render, screen } from "@testing-library/react";
import InstructionsPanel from "./InstructionsPanel";

describe("InstructionsPanel", () => {
  it("renders the three top-level section headings", () => {
    render(<InstructionsPanel />);
    expect(screen.getByText("Special Inputs")).toBeInTheDocument();
    expect(screen.getByText("Using the Tool")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("renders the position-format table with all 8 supported formats", () => {
    render(<InstructionsPanel />);
    // Each format row has its `entry` example in num-mono. Spot-check three.
    expect(screen.getByText("36.01N/75.50W")).toBeInTheDocument();
    expect(screen.getByText("KOGD/285/34")).toBeInTheDocument();
    expect(screen.getByText("OGD/285/34")).toBeInTheDocument();
  });

  it("emphasises the 'reference only' operational note", () => {
    render(<InstructionsPanel />);
    expect(
      screen.getByText(/This tool is for reference purposes only/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/InstructionsPanel.test.tsx`
Expected: FAIL — `Cannot find module './InstructionsPanel'`.

- [ ] **Step 3: Implement the component**

Port the existing `InstructionsAndNotes.tsx` body verbatim (the JSX inside the `<details>...</details>` wrapper) into a new top-level component. Drop the `<details>`, `<summary>`, and the outer card chrome. Keep the data constants colocated.

```tsx
// src/components/InstructionsPanel.tsx
const positionFormats: Array<{
  format: string;
  example: string;
  entry: string;
  decimal: string;
}> = [
  { format: "DD.dd (with letters)", example: "36°00'36\"N / 75°30'00\"W", entry: "36.01N/75.50W", decimal: "36.01/-75.50" },
  { format: "DD.dd (with a minus)", example: "36°00'36\"N / 75°30'00\"W", entry: "36.01/-75.50", decimal: "36.01/-75.50" },
  { format: "DD°MM'SS\" (with letters)", example: "36°00'51\"N / 75°30'04\"W", entry: "360051N/0753004W", decimal: "36.01/-75.50" },
  { format: "DD°MM'SS\" (with a minus)", example: "36°00'51\"N / 75°30'04\"W", entry: "360051/-0753004", decimal: "36.01/-75.50" },
  { format: "DD°MM.mm (with letters)", example: "36°00.86'N / 75°30.07'W", entry: "3600.86N/07530.07W", decimal: "36.01/-75.50" },
  { format: "DD°MM.mm (with a minus)", example: "36°00.86'N / 75°30.07'W", entry: "3600.86/-07530.07", decimal: "36.01/-75.50" },
  { format: "Airport ID / Radial / Distance", example: "41°25'48\"N / 112°42'00\"W", entry: "KOGD/285/34", decimal: "41.43/-112.70" },
  { format: "VOR ID / Radial / Distance", example: "41°30'00\"N / 112°45'36\"W", entry: "OGD/285/34", decimal: "41.50/-112.76" },
];

const usingTheToolNotes: string[] = [
  "All times are entered in UTC. The local-time conversion shows below the time selector.",
  "Sortie date and time drive the weather lookup — departure and arrival METAR/TAF are matched to your sortie time, not the current time.",
  "Use Copy Link to save or share the worksheet — the URL captures the worksheet inputs and fetched weather/performance values. UI preferences such as the °C/°F unit are stored locally in your browser and are not shared via the link.",
  "Reset Worksheet clears the worksheet inputs from the URL and reloads with defaults — the date and time reset to the next top-of-hour in UTC, and the °C/°F preference is preserved. Copy the link first if you want to keep the current state.",
  "Toggle °C/°F at any time using the temperature unit button in the header. The setting is saved locally in your browser so it persists across sessions on the same device.",
  "Operating Altitude drives the in-flight density-altitude and maneuvering-speed calculations. Set it to the planned altitude you'll be operating at over the area.",
  "Review the Mountain Flying Checklist (Checklist button in the action bar) before flight in addition to the worksheet values.",
];

type OperationalNote = string | { emphasis: string; body: string };

const operationalNotes: OperationalNote[] = [
  {
    emphasis: "This tool is for reference purposes only.",
    body: " It is up to the PIC and FRO to responsibly evaluate risks prior to release or departure. If risks cannot be reduced to an acceptable level, a no-go decision should be considered.",
  },
  "Warnings are highlighted in red/yellow, but the worksheet does not cover all the risks involved.",
  "Complete and upload this document to 'Sortie Files' for a mountain flight.",
  "If computations reveal that a particular performance item is marginal, consult the POH prior to flight.",
  "C206: 16,000' altitude limit is based on aircraft operations below critical altitude. See POH for operations above this altitude.",
  "Some performance values may vary slightly from the POH for temperatures, altitudes, and weights.",
  "Rate of Climb (ROC) for actual weights is an estimate only. ROC at Max Gross Weights (MGW) are from the POH. Therefore, actual ROC and MGW ROC values may not match. If actual weight results are unexpected, use MGW or POH values. Remember, POH values are for a new aircraft with a test pilot. Your actual climb rates can, and probably will be, lower. ROC rates that are significantly lower than POH values may justify a Return to Base decision.",
  "Performance is computed from POH tables but may not be accurate outside the table range.",
  "A current CAPF 70-5 Mountain Flight Endorsement or qualified instructor is required to takeoff/land in airports located in mountainous terrain.",
  "A current Mountain Flying Certification SQTR and CAPF 70-91, Section V signoff, or qualified instructor is required to fly mountain search.",
  "Density altitude calculation uses a dry air approximation.",
];

export default function InstructionsPanel() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <p>
        Add sortie information in Step 1. Once that area is filled in, click the{" "}
        <span className="font-semibold">Fetch weather</span> button and the
        worksheet will fetch weather information from{" "}
        <a
          href="https://aviationweather.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          AviationWeather.gov
        </a>{" "}
        to fill out the weather and performance sections of the worksheet.
      </p>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Special Inputs
        </h3>
        <p>
          <span className="font-semibold">Departure / Arrival airports:</span>{" "}
          Enter the 4-letter ICAO code (e.g. KDEN) and the worksheet will
          populate the weather and runway information when clicking{" "}
          <span className="font-semibold">Fetch weather</span>.
        </p>
        <p>
          <span className="font-semibold">Area of Operations:</span> Enter
          latitude/longitude coordinates in decimal degrees DD.dddd format. You
          can also use other ways to indicate the area of operations — see the
          table below.
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse mt-2">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-semibold">Format</th>
                <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-semibold">How It Is Entered</th>
                <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-semibold">Equivalent Lat/Long</th>
                <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-semibold">Converted Decimal Format</th>
              </tr>
            </thead>
            <tbody>
              {positionFormats.map((row) => (
                <tr key={row.entry}>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1">{row.format}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-mono whitespace-nowrap">{row.entry}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1 whitespace-nowrap">{row.example}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-mono whitespace-nowrap">{row.decimal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Using the Tool
        </h3>
        <ul className="list-disc list-outside ml-5 space-y-1">
          {usingTheToolNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Notes
        </h3>
        <ul className="list-disc list-outside ml-5 space-y-1">
          {operationalNotes.map((note) => {
            if (typeof note === "string") {
              return <li key={note}>{note}</li>;
            }
            return (
              <li key={note.emphasis}>
                <span className="font-semibold">{note.emphasis}</span>
                {note.body}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
```

Changes from `InstructionsAndNotes.tsx`:
- Drops the outer `<div className="w-full max-w-4xl bg-white ...">` wrapper, the `<details>`, the `<summary>`, and the `▼` glyph. Slide-over chrome lives in `SlideOver`.
- Recolors text classes from `text-gray-*` to `text-slate-*` to match the rest of the Phase 1–4 visual vocabulary.
- The "Review the Mountain Flying Checklist (at the bottom of the page)" line in `usingTheToolNotes` becomes "Review the Mountain Flying Checklist (Checklist button in the action bar)" — the checklist's discoverability moves with it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/InstructionsPanel.test.tsx`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/InstructionsPanel.tsx src/components/InstructionsPanel.test.tsx
git commit -m "Add InstructionsPanel slide-over body

Ports the instructions + operational notes content from
InstructionsAndNotes into a slide-over-shaped component (no <details>
shell). Data constants stay colocated. Text color classes switch from
gray-* to slate-* to match the Phase 1–4 vocabulary. The note about
the Mountain Flying Checklist now points users at the action-bar
Checklist button instead of the (about-to-be-removed) bottom-of-page
accordion."
```

---

## Task 3: `ChecklistPanel` slide-over content

**Files:**
- Create: `src/components/ChecklistPanel.tsx`
- Create: `src/components/ChecklistPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ChecklistPanel.test.tsx
import { render, screen } from "@testing-library/react";
import ChecklistPanel from "./ChecklistPanel";

describe("ChecklistPanel", () => {
  it("renders all seven section headings", () => {
    render(<ChecklistPanel />);
    expect(screen.getByText("Basic Preflight")).toBeInTheDocument();
    expect(screen.getByText("Weather Preflight")).toBeInTheDocument();
    expect(screen.getByText("Weight and Balance Preflight")).toBeInTheDocument();
    expect(screen.getByText("Aircraft Performance Preflight")).toBeInTheDocument();
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("Enroute")).toBeInTheDocument();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
  });

  it("renders specific items under their sections", () => {
    render(<ChecklistPanel />);
    expect(
      screen.getByText(/Define runway abort point/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verify 300 feet\/minute Rate of Climb possible/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/ChecklistPanel.test.tsx`
Expected: FAIL — `Cannot find module './ChecklistPanel'`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/ChecklistPanel.tsx
const sections = [
  {
    title: "Basic Preflight",
    items: [
      "Ensure attire, safety, oxygen, and survival equipment are appropriate for the flight",
      "Ensure adequate fuel reserves exist for mountain flight.",
      "File flight plan, if necessary",
      "Conduct a good aircraft preflight",
      "Ensure inoperative equipment and discrepancies are appropriate for mountain flight",
      "Discuss crew responsibilities, Crew Resource Management and mission briefing",
    ],
  },
  {
    title: "Weather Preflight",
    items: [
      "Verify all weather, especially winds and turbulence, remains within release limits 2 hours prior to flight. If not, consult with the Flight Release Officer",
      "Determine where updraft, downdraft and turbulent areas are likely to occur",
      "Verify ceilings and visibility are much greater than marginal VFR all along route (2000'/10 SM or better is ideal). If not, consider aborting mission or consult with the Flight Release Officer",
    ],
  },
  {
    title: "Weight and Balance Preflight",
    items: [
      "Ensure weight and balance within limits for actual loading; weight from ForeFlight or POH",
      "Attempt to maintain weight less than 90% of Maximum Gross Weight for mountain flight",
    ],
  },
  {
    title: "Aircraft Performance Preflight",
    items: [
      "Verify Rate of Climb is greater than 300 feet/minute all along route and in area of operations. If not, consider aborting mission or consult with the Flight Release Officer",
      "Verify Take Off plus Landing Ground Roll is less than Runway length. If not, consider aborting mission or consult with the Flight Release Officer",
    ],
  },
  {
    title: "Departure",
    items: [
      "Define runway abort point (75% of indicated takeoff airspeed at runway midpoint)",
      "Mixture set for max power or POH",
      "Execute short field take off techniques to clear actual or simulated obstacles",
    ],
  },
  {
    title: "Enroute",
    items: [
      "Remain at or above 2000 feet AGL unless descending to land if MFE qualified (Note 13)",
      "Remain at or above 1000 feet AGL unless descending to land or conducting a mission as a Mountain qualified Mission Pilot (Note 14)",
    ],
  },
  {
    title: "Arrival",
    items: [
      "Verify 300 feet/minute Rate of Climb possible. If not, divert.",
      "Verify go around possible at airport. If not, divert.",
      "Set runway go around point to stop safely",
      "Mixture set for max power or POH",
      "Use short field landing techniques",
    ],
  },
];

export default function ChecklistPanel() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
            {section.title}
          </h3>
          <ul className="list-disc list-outside ml-5 space-y-1">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/ChecklistPanel.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChecklistPanel.tsx src/components/ChecklistPanel.test.tsx
git commit -m "Add ChecklistPanel slide-over body

Ports the seven mountain-flying checklist sections from
MountainFlyingChecklist into a slide-over-shaped component (no
<details> shell). Text color classes switch from gray-* to slate-*
to match the Phase 1–4 vocabulary."
```

---

## Task 4: `?` icon trigger in `WorksheetHeader`

**Files:**
- Modify: `src/components/WorksheetHeader.tsx`
- Modify: `src/components/WorksheetHeader.test.tsx`

The `?` icon goes on the right side of the title, immediately before the Reset/Copy/°F cluster, matching the mockup (lines 158–163).

- [ ] **Step 1: Add the test assertion**

Open `src/components/WorksheetHeader.test.tsx`. Add `onOpenInstructions: jest.fn()` to the `defaultProps` block, then add a new test inside the existing `describe("WorksheetHeader", ...)`:

```tsx
  it("renders an instructions trigger button and calls onOpenInstructions when clicked", () => {
    render(<WorksheetHeader {...defaultProps} />);
    const trigger = screen.getByRole("button", { name: /instructions/i });
    fireEvent.click(trigger);
    expect(defaultProps.onOpenInstructions).toHaveBeenCalled();
  });
```

You'll need to import `fireEvent` from `@testing-library/react` at the top of the file if it isn't already imported.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/WorksheetHeader.test.tsx`
Expected: FAIL — the new test can't find the trigger button.

- [ ] **Step 3: Add the `?` icon to `WorksheetHeader.tsx`**

In `src/components/WorksheetHeader.tsx`:

1. Update the imports to include `QuestionMarkCircleIcon`:

```tsx
import { LinkIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
```

2. Add `onOpenInstructions: () => void;` to `WorksheetHeaderProps`.

3. Destructure `onOpenInstructions` in the component signature.

4. Insert the `?` button as the first child of the inner `flex items-center gap-1.5` button cluster (the one currently starting with Reset):

```tsx
            <button
              onClick={onOpenInstructions}
              title="Instructions & operational notes"
              aria-label="Open instructions"
              className="flex items-center rounded-md border border-slate-700/60 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <QuestionMarkCircleIcon className="h-3.5 w-3.5" />
            </button>
```

The full updated button cluster becomes:

```tsx
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenInstructions}
              title="Instructions & operational notes"
              aria-label="Open instructions"
              className="flex items-center rounded-md border border-slate-700/60 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <QuestionMarkCircleIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onReset}
              className="rounded-md border border-slate-700/60 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Reset
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 rounded-md border border-slate-700/60 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <LinkIcon className="h-3 w-3" />
              Copy link
            </button>
            <button
              onClick={onToggleTempUnit}
              title="Toggle temperature unit"
              className="flex items-center gap-1 rounded-md border border-slate-700/60 px-2.5 py-1 text-xs font-mono"
            >
              <span className={useFahrenheit ? "text-slate-500" : "font-semibold text-white"}>°C</span>
              <span className="text-slate-600">|</span>
              <span className={useFahrenheit ? "font-semibold text-white" : "text-slate-500"}>°F</span>
            </button>
          </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/WorksheetHeader.test.tsx`
Expected: PASS — 4 tests (3 existing + 1 new) green.

- [ ] **Step 5: Commit**

```bash
git add src/components/WorksheetHeader.tsx src/components/WorksheetHeader.test.tsx
git commit -m "Add ? icon trigger for the Instructions slide-over

WorksheetHeader now exposes an onOpenInstructions callback and
renders a QuestionMarkCircleIcon button as the first child of the
right-side button cluster. The button uses the same slim
border-only styling as the existing Reset / Copy link / °C-°F
buttons."
```

---

## Task 5: Checklist trigger on `ActionBar`

**Files:**
- Modify: `src/components/ActionBar.tsx`
- Modify: `src/components/ActionBar.test.tsx`

The Checklist button lives to the right of the per-state action group, separated by a left border, persistent across all four states (matches mockup lines 282–290).

- [ ] **Step 1: Add the test assertion**

Open `src/components/ActionBar.test.tsx`. Add `onOpenChecklist: jest.fn()` to the `baseProps` block. Then add a new `describe("ActionBar — Checklist trigger", ...)` at the end:

```tsx
describe("ActionBar — Checklist trigger", () => {
  it("renders a Checklist button visible across all states", () => {
    for (const state of ["incomplete", "ready", "fetched", "all-done"] as const) {
      const { unmount } = render(
        <ActionBar
          {...baseProps}
          state={state}
        />
      );
      expect(
        screen.getByRole("button", { name: /Checklist/i })
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("calls onOpenChecklist when the Checklist button is clicked", () => {
    render(<ActionBar {...baseProps} state="incomplete" fetchDisabled={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Checklist/i }));
    expect(baseProps.onOpenChecklist).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/ActionBar.test.tsx`
Expected: FAIL — no Checklist button is rendered.

- [ ] **Step 3: Modify `ActionBar.tsx`**

1. Update the imports to include `ClipboardDocumentCheckIcon`:

```tsx
import {
  // ...existing imports...
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
```

2. Add `onOpenChecklist: () => void;` to `ActionBarProps`.

3. Destructure `onOpenChecklist` in the component signature.

4. Just before the final closing `</div></div>` of the action bar (after the four state branches but before the outer container closes), insert the persistent Checklist trigger:

```tsx
        <div className="shrink-0 pl-2.5 ml-0.5 border-l border-slate-200 dark:border-slate-700 flex items-center">
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
```

This block must live inside the inner `flex items-center justify-between` row that contains the per-state branches, as the final child after all four `{state === "…" && (…)}` blocks. Don't put it inside any of the four state branches.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/ActionBar.test.tsx`
Expected: PASS — all existing tests + 2 new tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionBar.tsx src/components/ActionBar.test.tsx
git commit -m "Add persistent Checklist trigger to ActionBar

Renders a ClipboardDocumentCheckIcon button as the last child of
the action bar row, separated from the per-state action group by a
left border. Visible across all four states (incomplete, ready,
fetched, all-done). Calls a new onOpenChecklist callback prop."
```

---

## Task 6: "For reference only" disclaimer in `Calculations`

**Files:**
- Modify: `src/components/Calculations.tsx`
- Modify: `src/components/Calculations.test.tsx`

The disclaimer is the first child of the existing `<div className="space-y-4">` block — above all the calculation children, beneath the aircraft-model warning. Pulled verbatim from `operationalNotes[0]`.

- [ ] **Step 1: Add the test assertion**

Open `src/components/Calculations.test.tsx`. Add a new test:

```tsx
  it("renders the 'For reference only' disclaimer above the calculations", () => {
    render(<Calculations state={defaultState} />);
    expect(
      screen.getByText(/For reference only/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/It is up to the PIC and FRO to responsibly evaluate risks/i)
    ).toBeInTheDocument();
  });
```

(Use the existing `defaultState` fixture in that file; if there isn't one, create a minimal `WorksheetData` literal at the top of the test file matching the pattern from the existing `Calculations.test.tsx`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/Calculations.test.tsx`
Expected: FAIL — no disclaimer rendered.

- [ ] **Step 3: Modify `Calculations.tsx`**

Import the warning icon and add the disclaimer block. Update the imports:

```tsx
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
```

Insert the disclaimer as the first child of the existing `<div className="space-y-4">` block, before `<Altitudes ...>`:

```tsx
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2.5 dark:border-amber-900/40 dark:bg-amber-950/30">
          <ExclamationCircleIcon className="h-4 w-4 text-amber-600 mt-0.5 shrink-0 dark:text-amber-500" />
          <p className="flex-1 text-sm text-amber-900 dark:text-amber-200 leading-snug">
            <strong className="font-semibold">For reference only.</strong> It is
            up to the PIC and FRO to responsibly evaluate risks prior to release
            or departure. If risks cannot be reduced to an acceptable level, a
            no-go decision should be considered.
          </p>
        </div>
```

Don't wire a deep-link to the Instructions slide-over yet — keep this task scoped to the disclaimer block only. Future polish can add an "Read all operational notes →" link similar to the mockup, but that requires plumbing `onOpenInstructions` down to `Calculations`, which is overhead this phase doesn't need.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/Calculations.test.tsx`
Expected: PASS — existing tests + 1 new test green.

- [ ] **Step 5: Commit**

```bash
git add src/components/Calculations.tsx src/components/Calculations.test.tsx
git commit -m "Add 'For reference only' disclaimer to Calculations

Inline amber banner pulled verbatim from operationalNotes[0]. Sits
above the existing calculation children inside the Step 3
StepShell, so the disclaimer is visible alongside go/no-go-adjacent
information regardless of whether the user has opened the
Instructions slide-over."
```

---

## Task 7: Wire slide-overs through `AppContainer`

**Files:**
- Modify: `src/components/AppContainer.tsx`
- Modify: `src/components/AppContainer.test.tsx`

This is the integration task. `AppContainer` owns the single `overlay` state, threads the open callbacks down to `WorksheetHeader` and `ActionBar`, mounts the two `<SlideOver>` wrappers around `<InstructionsPanel>` and `<ChecklistPanel>`, and removes the bottom-of-page accordion mounts.

- [ ] **Step 1: Update `AppContainer.test.tsx`**

Open `src/components/AppContainer.test.tsx`. Replace the "renders InstructionsAndNotes below MountainFlyingChecklist" test (the one that asserts `details > summary` ordering) with:

```tsx
  it("renders the slide-over triggers (instructions in header, checklist on action bar)", () => {
    render(<AppContainer />);
    expect(
      screen.getByRole("button", { name: /Open instructions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Checklist/i })
    ).toBeInTheDocument();
  });
```

You can delete the entire existing test that asserts the `details > summary` ordering between `InstructionsAndNotes` and `MountainFlyingChecklist` — those components no longer render in the main flow.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/AppContainer.test.tsx`
Expected: FAIL — the new test can't find the Open-instructions or Checklist buttons yet (Tasks 4 and 5 added them in components, but `AppContainer` doesn't pass the required callbacks).

- [ ] **Step 3: Update `AppContainer.tsx` imports and remove the obsolete bottom mounts**

In `src/components/AppContainer.tsx`:

1. Update imports:

```tsx
import { useMemo, useState } from "react";
import ActionBar from "@/components/ActionBar";
import AppInputs from "@/components/AppInputs";
import Calculations from "@/components/Calculations";
import ChecklistPanel from "@/components/ChecklistPanel";
import InstructionsPanel from "@/components/InstructionsPanel";
import SlideOver from "@/components/SlideOver";
import Stepper, { type StepperStep } from "@/components/Stepper";
import StepShell from "@/components/StepShell";
import WeatherDataIntegration from "@/components/WeatherDataIntegration";
import WorksheetHeader from "@/components/WorksheetHeader";
import { deriveActionBarState } from "@/utils/actionBarState";
import { deriveStepStatuses } from "@/utils/stepStatuses";
import { useTempUnit } from "@/utils/useTempUnit";
import { useUrlState } from "@/utils/useUrlState";
import type { AirportRunwayInfo, RunwayOption, WorksheetData } from "@/utils/types";
```

(Drop the `InstructionsAndNotes` and `MountainFlyingChecklist` imports. Add `ChecklistPanel`, `InstructionsPanel`, `SlideOver`.)

2. Add the overlay state and handlers immediately after the existing `[airportRunways, setAirportRunways]` block:

```tsx
  const [overlay, setOverlay] = useState<"instructions" | "checklist" | null>(
    null
  );
  const handleOpenInstructions = () => setOverlay("instructions");
  const handleOpenChecklist = () => setOverlay("checklist");
  const handleCloseOverlay = () => setOverlay(null);
```

3. Update the `<WorksheetHeader>` JSX call to include the new callback:

```tsx
      <WorksheetHeader
        onReset={handleReset}
        onShare={handleShare}
        useFahrenheit={useFahrenheit}
        onToggleTempUnit={toggleTempUnit}
        onOpenInstructions={handleOpenInstructions}
      />
```

4. Update the `<WeatherDataIntegration renderButton={...}>` `<ActionBar>` call to include the Checklist callback:

```tsx
        renderButton={({ onClick, disabled, isLoading }) => (
          <ActionBar
            state={actionBarState}
            worksheetData={state}
            weatherLastUpdated={weatherLastUpdated ?? undefined}
            onFetch={onClick}
            fetchDisabled={disabled}
            isFetching={isLoading}
            onOpenChecklist={handleOpenChecklist}
          />
        )}
```

5. Remove the `<MountainFlyingChecklist />` and `<InstructionsAndNotes />` lines from the `<main>` body. The main body should end with the Decision `<StepShell>` and nothing more before the closing `</div></main>`.

6. After the `</main>` closing tag and before the `<footer>`, mount the two slide-overs:

```tsx
      <SlideOver
        isOpen={overlay === "instructions"}
        onClose={handleCloseOverlay}
        title="Instructions & Operational Notes"
      >
        <InstructionsPanel />
      </SlideOver>
      <SlideOver
        isOpen={overlay === "checklist"}
        onClose={handleCloseOverlay}
        title="Mountain Flying Checklist"
      >
        <ChecklistPanel />
      </SlideOver>
```

- [ ] **Step 4: Run the AppContainer test**

Run: `npx jest src/components/AppContainer.test.tsx`
Expected: PASS — the new slide-over-trigger test finds both buttons. The remaining existing tests (render without crashing, Stepper rendered, step-decision anchor present, ActionBar present) continue to pass.

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: PASS across all suites. The existing `InstructionsAndNotes.test.tsx` (if any) and `MountainFlyingChecklist` tests (if any) — none currently exist in the codebase — would still run; they're not deleted in this task.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppContainer.tsx src/components/AppContainer.test.tsx
git commit -m "Wire Instructions and Checklist slide-overs in AppContainer

- Adds overlay state (\"instructions\" | \"checklist\" | null) plus open
  + close handlers.
- Passes handleOpenInstructions to WorksheetHeader (the ? icon)
  and handleOpenChecklist to ActionBar (the persistent button).
- Mounts <SlideOver> wrappers around <InstructionsPanel> and
  <ChecklistPanel> as siblings of <main>.
- Removes the bottom-of-page <MountainFlyingChecklist /> and
  <InstructionsAndNotes /> mounts. The obsolete component files
  are deleted in the next task."
```

---

## Task 8: Delete obsolete files + add `@media print` rules

**Files:**
- Delete: `src/components/InstructionsAndNotes.tsx`
- Delete: `src/components/MountainFlyingChecklist.tsx`
- Modify: `src/app/globals.css`

The slide-over component already carries `print:` Tailwind variants from Task 1. This task adds a few additional CSS-only rules that Tailwind utilities don't express cleanly (e.g. `page-break-inside: avoid` on individual section blocks), and deletes the now-orphaned accordion components.

- [ ] **Step 1: Verify no other component imports the old files**

Run: `grep -rn "from .*InstructionsAndNotes\|from .*MountainFlyingChecklist" src/`
Expected: zero matches outside of the two files themselves.

If any matches remain, stop and fix them before deleting.

- [ ] **Step 2: Delete the obsolete component files**

```bash
rm src/components/InstructionsAndNotes.tsx \
   src/components/MountainFlyingChecklist.tsx
```

There are no test files for these components in the codebase to delete.

- [ ] **Step 3: Add print rules to `globals.css`**

Append the following block to `src/app/globals.css` (at the end of the file, after the existing `@import` and `@theme`):

```css
@media print {
  /* Force two-color rendering and remove dark-mode backgrounds. */
  html, body {
    background: #ffffff !important;
    color: #0f172a !important;
  }

  /* Hide screen-only chrome that isn't already covered by Tailwind's
     print:hidden utility (utility-first solutions live in components). */
  header.sticky, nav.sticky, .sticky {
    position: static !important;
  }

  /* Don't fracture a slide-over body across pages. */
  aside[role="dialog"] section,
  aside[role="dialog"] table {
    page-break-inside: avoid;
  }
}
```

The Tailwind `print:` utilities already in `SlideOver.tsx` handle the slide-over's expansion (static position, full width, page break before). These global rules cover edge cases that don't map to a single utility.

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: PASS across all remaining suites. The grep from Step 1 confirmed no broken imports.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors. The deleted files removed their own pre-existing errors with them; the post-Phase-5 TS error count should be ≤ the post-Phase-4 baseline of 35.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Remove obsolete accordion components, add print rules

The InstructionsAndNotes and MountainFlyingChecklist <details>
accordions had no remaining call sites after AppContainer switched
to slide-over panels — deleted both files.

Adds a small @media print block to globals.css for edge cases
Tailwind's print: variants don't express directly (forcing static
positioning on sticky elements, avoiding page breaks inside
slide-over sections). The slide-over's own print: utilities (set in
Task 1) handle the bulk of the print layout."
```

---

## Verification — full phase

- [ ] All eight task commits land cleanly:
  ```bash
  git log --oneline -10
  ```

- [ ] Jest is green:
  ```bash
  npx jest
  ```

- [ ] TypeScript introduces no new errors in files this phase touches:
  ```bash
  npx tsc --noEmit 2>&1 | grep -E "SlideOver|InstructionsPanel|ChecklistPanel|WorksheetHeader|ActionBar|Calculations|AppContainer"
  ```
  Expected: empty (no NEW errors; previously-existing errors in these files, if any, should be unchanged or fewer).

- [ ] Visual checklist (in a browser at `localhost:3000`):
  - Slim header shows a `?` icon button between the title and the Reset/Copy/°F cluster. Clicking it opens a right-side slide-over titled "Instructions & Operational Notes" with the position-format table + Using-the-Tool list + Notes list. The slide-over has a backdrop, animates in from the right, closes on backdrop click / ESC / `X` button.
  - Action bar shows a `Checklist` button at the right of the action group, separated by a thin border. Clicking it opens a right-side slide-over titled "Mountain Flying Checklist" with seven sections. Only one slide-over can be open at a time (opening checklist while instructions is open swaps them; clicking outside closes whatever's open).
  - The bottom of the page is empty — no more accordion shells.
  - Step 3 (Decision) shows the amber "For reference only" disclaimer above the calculations.
  - Stepper, action bar, and main content layout from Phases 1–4 are visually unchanged.
  - No browser console errors.

- [ ] Print smoke test (browser print preview):
  - Header, Stepper, and ActionBar render statically (not sticky/floating).
  - Both slide-over panels render as appendices on their own pages — Instructions first, Checklist second — with the full body content visible and the slide-over chrome (backdrop, header bar) hidden.
  - Backdrop overlay does not appear in print.
  - Tables don't fracture mid-section.

---

## Out of scope for Phase 5 (do **not** add here)

- "Read all operational notes →" deep-link from the Decision-step disclaimer into the Instructions slide-over — adds prop plumbing this phase doesn't need.
- Slide-over `<a name="instructions">` anchor scroll behaviour for print — the page breaks already cover this.
- Go / No-Go panel in the Decision step — separate plan.
- Auto-derivation of the `all-done` action-bar state — depends on Go/No-Go panel.
- "Print briefing" and "Acknowledge & proceed" button behaviours — render as inert in the `all-done` state until Go/No-Go ships.
- Stepper field-count badges (`8 of 11`, `⚠ 1`) — separate polish-batch plan.
- AIRMET flag echoes between Step 2 advisories and Step 3 Decision warnings — separate polish-batch plan.
- Mobile responsive polish for the tables inside slide-overs — separate polish-batch plan.
