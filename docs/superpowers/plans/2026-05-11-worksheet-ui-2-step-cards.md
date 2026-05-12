# Worksheet UI Redesign — Phase 2: Step Cards (StepShell)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `StepShell` component (numbered circle + left-rail spine + outer rounded card with header strip), refactor each existing step's content to render inside one, add four sub-heading groups inside Sortie Details (Pilot & Aircraft / When / Where / Pilot Qualifications), and remove the duplicate "Operating Altitude" display from the Aircraft Performance table.

**Architecture:** `StepShell` owns the `<section id={id}>` element (replacing the bare `<section>` wrappers Phase 1 added in `AppInputs.tsx` and `AppContainer.tsx`) and renders an absolutely-positioned numbered marker + spine line on the left and an `<article>` card on the right. The existing per-step components (`SortieInfo`, `WeatherInfo`, `AircraftPerformance`, `Calculations`) drop their outer `max-w-4xl bg-white …` card wrappers because the StepShell card is now the chrome. `MountainQuals` is folded into `SortieInfo` under a "Pilot Qualifications" sub-heading and the standalone component is deleted. Step status is still hardcoded (`active` / `pending` / `pending`) — Phase 3 wires real derivation.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `@heroicons/react/24/outline`, Jest + Testing Library (existing setup).

**Read before starting:** `docs/superpowers/plans/2026-05-11-worksheet-ui-redesign-index.md` for series context, the Phase 1 plan `docs/superpowers/plans/2026-05-11-worksheet-ui-1-step-shell.md` for what's already in place, and `docs/numbered-step-shell-mockup.html` — specifically the `<section id="step-1">`, `<section id="step-2">`, and `<section id="step-3">` blocks (lines ~299–628) — for the visual target.

---

## File Structure

**Create:**
- `src/components/StepShell.tsx` — `<section id>` + numbered circle + spine + bordered card with header strip
- `src/components/StepShell.test.tsx` — colocated component test

**Modify:**
- `src/components/SortieInfo.tsx` — add four `<h3>` sub-heading groups, inline the two Mountain Pilot Qualifications checkboxes, drop the outer `max-w-4xl bg-white …` wrapper (children are now placed inside `StepShell`'s card body)
- `src/components/SortieInfo.test.tsx` — add assertions for sub-heading text + the two qualification checkboxes
- `src/components/WeatherInfo.tsx` — drop the outer `<div className="w-full max-w-4xl">` wrapper (lines 240–249 region); the inner `<h2>Weather Information</h2>` becomes a plain heading inside StepShell's card body
- `src/components/AircraftPerformance.tsx` — drop the outer `<div className="w-full max-w-4xl">` wrapper (line 258 region) AND blank out the Operating-column cell in the "Airport/Max Flight Altitude (MSL)" row (lines 377–381) — SortieInfo already owns that input
- `src/components/AircraftPerformance.test.tsx` — remove the four `expect(screen.getByText("8000")).toBeInTheDocument()` assertions and their stale comments that asserted the deleted echo
- `src/components/Calculations.tsx` — drop the outer card classes from `<div className="w-full max-w-4xl bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">` (line 31), keeping only `w-full` so contents fill StepShell's card
- `src/components/AppInputs.tsx` — replace the two `<section id="step-sortie">` and `<section id="step-weather">` wrappers with `<StepShell …>`; drop the `MountainQuals` import + render
- `src/components/AppInputs.test.tsx` — no changes needed (anchor-id assertions still satisfied because `StepShell` renders `<section id={id}>`)
- `src/components/AppContainer.tsx` — replace the `<section id="step-decision">` wrapper with `<StepShell id="step-decision" number={3} status="pending" showSpine={false} …>`
- `src/components/AppContainer.test.tsx` — no changes needed

**Delete:**
- `src/components/MountainQuals.tsx` — merged into `SortieInfo`

**Anchor ids stay identical to Phase 1:** `step-sortie`, `step-weather`, `step-decision`. The Phase 1 `Stepper` does not change.

---

## Task 1: StepShell component — skeleton + render test

**Files:**
- Create: `src/components/StepShell.tsx`
- Create: `src/components/StepShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/StepShell.test.tsx
import { render, screen } from "@testing-library/react";
import StepShell from "./StepShell";

describe("StepShell", () => {
  it("renders the section element with the provided id", () => {
    const { container } = render(
      <StepShell id="step-sortie" number={1} status="active" title="Sortie Details">
        <p>body</p>
      </StepShell>
    );
    expect(container.querySelector("section#step-sortie")).not.toBeNull();
  });

  it("renders the step number, title, and children", () => {
    render(
      <StepShell id="step-weather" number={2} status="pending" title="Weather">
        <p data-testid="body">child content</p>
      </StepShell>
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weather", level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId("body")).toBeInTheDocument();
  });

  it("renders an optional subtitle when provided", () => {
    render(
      <StepShell
        id="step-sortie"
        number={1}
        status="active"
        title="Sortie Details"
        subtitle="Who's flying, when, and where"
      >
        body
      </StepShell>
    );
    expect(screen.getByText("Who's flying, when, and where")).toBeInTheDocument();
  });

  it("renders an optional badge when provided", () => {
    render(
      <StepShell
        id="step-weather"
        number={2}
        status="complete"
        title="Weather"
        badge="Fetched 14:31 UTC"
      >
        body
      </StepShell>
    );
    expect(screen.getByText("Fetched 14:31 UTC")).toBeInTheDocument();
  });

  it("renders a spine connector by default and omits it when showSpine={false}", () => {
    const { container, rerender } = render(
      <StepShell id="step-sortie" number={1} status="active" title="Sortie Details">
        body
      </StepShell>
    );
    expect(container.querySelector('[data-testid="step-spine"]')).not.toBeNull();

    rerender(
      <StepShell
        id="step-decision"
        number={3}
        status="pending"
        title="Decision"
        showSpine={false}
      >
        body
      </StepShell>
    );
    expect(container.querySelector('[data-testid="step-spine"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/StepShell.test.tsx`
Expected: FAIL — `Cannot find module './StepShell'`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/StepShell.tsx
import { type ReactNode } from "react";
import type { StepStatus } from "@/components/Stepper";

interface StepShellProps {
  id: string;
  number: number;
  status: StepStatus;
  title: string;
  subtitle?: string;
  badge?: string;
  showSpine?: boolean;
  children: ReactNode;
}

const circleBg: Record<StepStatus, string> = {
  pending:  "bg-slate-300",
  active:   "bg-slate-900",
  complete: "bg-emerald-500",
  warning:  "bg-amber-500",
};

const circleText: Record<StepStatus, string> = {
  pending:  "text-slate-700",
  active:   "text-white",
  complete: "text-white",
  warning:  "text-white",
};

const badgeStyle: Record<StepStatus, string> = {
  pending:  "bg-slate-50 text-slate-600 border-slate-200",
  active:   "bg-slate-50 text-slate-700 border-slate-200",
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning:  "bg-amber-50 text-amber-700 border-amber-200",
};

export default function StepShell({
  id,
  number,
  status,
  title,
  subtitle,
  badge,
  showSpine = true,
  children,
}: StepShellProps) {
  return (
    <section
      id={id}
      className="relative pl-14 md:pl-16 scroll-mt-[60px]"
    >
      <div
        className="absolute left-0 top-0 bottom-0 flex flex-col items-center"
        aria-hidden="true"
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full font-mono font-bold text-base shadow ring-4 ring-slate-100 ${circleBg[status]} ${circleText[status]}`}
        >
          {number}
        </div>
        {showSpine && (
          <div
            data-testid="step-spine"
            className="mt-2 w-px flex-1 bg-slate-300"
          />
        )}
      </div>
      <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {badge && (
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${badgeStyle[status]}`}
            >
              {badge}
            </span>
          )}
        </header>
        <div className="px-5 py-5 space-y-6">{children}</div>
      </article>
    </section>
  );
}
```

`StepShell` does NOT need `"use client"` — it has no hooks or browser APIs. It re-uses the `StepStatus` union exported from `Stepper.tsx` to keep the two color palettes in sync.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/StepShell.test.tsx`
Expected: PASS — all five tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/StepShell.tsx src/components/StepShell.test.tsx
git commit -m "Add StepShell component (numbered card with spine + header strip)

Reusable wrapper for each step's section: owns the section id, the
absolute-positioned numbered marker + vertical spine line, and the
bordered card with title/subtitle/optional status badge. Re-uses the
StepStatus type exported by Stepper so the two palettes stay in sync."
```

---

## Task 2: Remove duplicate Operating Altitude echo cell in AircraftPerformance

**Files:**
- Modify: `src/components/AircraftPerformance.tsx` (the `<td>` containing the operating-altitude read-only echo, currently around lines 377–381)
- Modify: `src/components/AircraftPerformance.test.tsx` (four occurrences of `expect(screen.getByText("8000")).toBeInTheDocument()` that asserted on the echo)

This task removes only the *display* duplication. The state field `altitude[1]` is unchanged and continues to be written by `SortieInfo`'s "Operating Altitude" input.

- [ ] **Step 1: Update the tests to drop the echo assertions**

In `src/components/AircraftPerformance.test.tsx`, find and **delete** these four assertions and the stale comments immediately preceding them:

Around line 80–84:
```tsx
    // Operating altitude is now read-only text; only departure and arrival are inputs
    const altitudeInputs = screen.getAllByDisplayValue("8000");
    expect(altitudeInputs).toHaveLength(2);
    // Operating altitude shown as text
    expect(screen.getByText("8000")).toBeInTheDocument();
```

Becomes:
```tsx
    // Only departure and arrival altitudes are inputs in the Aircraft Performance table.
    // (Operating altitude is owned by SortieInfo.)
    const altitudeInputs = screen.getAllByDisplayValue("8000");
    expect(altitudeInputs).toHaveLength(2);
```

Around line 355–356:
```tsx
    // Operating altitude is now read-only text (moved to SortieInfo)
    expect(screen.getByText("8000")).toBeInTheDocument();
```
→ delete both lines.

Around line 492:
```tsx
    expect(screen.getByText("8000")).toBeInTheDocument();
```
→ delete the line (and any single-line "// Operating altitude is read-only text" comment immediately above it).

Around line 517:
```tsx
    expect(screen.getByText("8000")).toBeInTheDocument();
```
→ delete the line (and any single-line "// Operating altitude is read-only text" comment immediately above it).

Verify before/after with:
```bash
grep -n "8000\|Operating altitude is" src/components/AircraftPerformance.test.tsx
```
After: no lines should match `getByText("8000")`. The `getAllByDisplayValue("8000")` lines remain.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/AircraftPerformance.test.tsx`
Expected: PASS, because the assertions you deleted were the ones that *would have* failed once the echo is removed in Step 3. (This is the rare task where the test cleanup happens before the code change. The earlier assertions are obsolete now that SortieInfo owns the field; removing them up-front prevents them from masking a real regression in Step 4.)

- [ ] **Step 3: Remove the echo `<td>` content in AircraftPerformance.tsx**

In `src/components/AircraftPerformance.tsx`, replace lines 377–381:

```tsx
              <td className="p-2">
                <span className="text-gray-700 dark:text-gray-300">
                  {getValue("altitude", 1) || "—"}
                </span>
              </td>
```

with an empty cell that matches the existing "Runway length" row's middle-column pattern (line 403):

```tsx
              <td className="p-2"></td>
```

- [ ] **Step 4: Run all AircraftPerformance tests**

Run: `npx jest src/components/AircraftPerformance.test.tsx`
Expected: PASS — all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/components/AircraftPerformance.tsx src/components/AircraftPerformance.test.tsx
git commit -m "Remove duplicate Operating Altitude echo from Aircraft Performance

The Operating column in the 'Airport/Max Flight Altitude' row was a
read-only echo of state.altitude[1], which is already entered in
Sortie Details. Drop the echo cell (matching the Runway length row's
empty middle column) and remove the four test assertions that
asserted on it."
```

---

## Task 3: Inline MountainQuals into SortieInfo with four sub-heading groups + drop outer card

**Files:**
- Modify: `src/components/SortieInfo.tsx`
- Modify: `src/components/SortieInfo.test.tsx`

Sortie Details is restructured into four labeled sub-groups matching the mockup. The Mountain Pilot Qualifications checkboxes (currently rendered by the standalone `MountainQuals` component) move into SortieInfo under a "Pilot Qualifications" sub-heading. The standalone component is deleted in Task 4 once `AppInputs` stops importing it.

Sub-heading groups and their fields (mockup-mapped):

| Sub-heading | Fields |
|---|---|
| **Pilot & Aircraft** | Pilot Name, Aircraft Model, Tail Number |
| **When** | Date of Sortie, Time of Sortie (UTC), Expected Duration (hrs), local-timing display |
| **Where** | Departure Airport, Arrival Airport, Area of Operations (position), Operating Altitude (MSL ft), Aircraft Takeoff Weight (lbs) |
| **Pilot Qualifications** | Current CAPF 70-5 Mountain Flight Endorsement?, Current CAPF 70-91 and Mountain Flying Certification? |

- [ ] **Step 1: Update SortieInfo.test.tsx**

In `src/components/SortieInfo.test.tsx`, add these tests inside the existing `describe("SortieInfo", ...)` block (anywhere after `beforeEach`):

```tsx
  it("renders the four sub-heading groups", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    expect(screen.getByRole("heading", { name: "Pilot & Aircraft", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "When", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Where", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pilot Qualifications", level: 3 })).toBeInTheDocument();
  });

  it("renders the mountain qualification checkboxes", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    expect(
      screen.getByLabelText(/Current CAPF 70-5 Mountain Flight Endorsement/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Current CAPF 70-91 and Mountain Flying Certification/i)
    ).toBeInTheDocument();
  });

  it("calls onUpdate with mtnEndorse when the endorsement checkbox is toggled", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    fireEvent.click(screen.getByLabelText(/Current CAPF 70-5 Mountain Flight Endorsement/i));
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ mtnEndorse: true })
    );
  });

  it("calls onUpdate with mtnCert when the certification checkbox is toggled", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    fireEvent.click(screen.getByLabelText(/Current CAPF 70-91 and Mountain Flying Certification/i));
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ mtnCert: true })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/SortieInfo.test.tsx`
Expected: FAIL — heading "Pilot & Aircraft" not found; quals checkboxes not in this component.

- [ ] **Step 3: Restructure SortieInfo.tsx**

Open `src/components/SortieInfo.tsx`. Make these changes:

**(a)** Extend the `SortieInfoData` Pick (around line 13) to include the qualification fields:

```tsx
type SortieInfoData = Pick<
  WorksheetData,
  | "pilot"
  | "date"
  | "time"
  | "duration"
  | "acType"
  | "tailN"
  | "airport"
  | "route"
  | "position"
  | "weight"
  | "altitude"
  | "mtnEndorse"
  | "mtnCert"
>;
```

**(b)** Extend the `useState` initial value (around line 29) to include the two booleans:

```tsx
  const [formData, setFormData] = useState<SortieInfoData>({
    pilot: "",
    date: "",
    time: "",
    duration: null,
    acType: "",
    tailN: "",
    airport: ["", ""],
    route: "",
    position: [null, null],
    weight: null,
    altitude: [null, null, null],
    mtnEndorse: false,
    mtnCert: false,
  });
```

**(c)** Add a checkbox handler near the other handlers (after `handleDurationChange`, around line 132):

```tsx
  const handleQualChange = (field: "mtnEndorse" | "mtnCert") =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const updatedData = { ...formData, [field]: e.target.checked };
      setFormData(updatedData);
      onUpdate({ [field]: e.target.checked });
    };
```

**(d)** Replace the entire `return ( … )` block (currently lines 206–382) with a structured version. The new render organises the existing inputs into four labeled groups and adds the qualification checkboxes at the bottom. The outer `bg-white dark:bg-black/[.15] rounded-lg shadow-sm` wrapper is removed because `StepShell`'s card now provides the chrome.

```tsx
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Pilot &amp; Aircraft
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label htmlFor="pilot" className="block text-sm font-medium">
              Pilot Name
            </label>
            <input
              type="text"
              id="pilot"
              name="pilot"
              value={formData.pilot || ""}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="acType" className="block text-sm font-medium">
              Aircraft Model
            </label>
            <select
              id="acType"
              name="acType"
              value={formData.acType || ""}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            >
              <option value="">Select Aircraft</option>
              {aircraftData.map((aircraft) => (
                <option key={aircraft.id} value={aircraft.id}>
                  {aircraft.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="tailN" className="block text-sm font-medium">
              Aircraft Tail Number
            </label>
            <input
              type="text"
              id="tailN"
              name="tailN"
              value={formData.tailN || ""}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          When
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label htmlFor="date" className="block text-sm font-medium">
              Date of Sortie
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="time" className="block text-sm font-medium">
              Time of Sortie (UTC)
            </label>
            <select
              id="time"
              name="time"
              value={formData.time}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            >
              <option value="">Select Time</option>
              {utcHourOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="duration" className="block text-sm font-medium">
              Expected Duration (hrs)
            </label>
            <select
              id="duration"
              name="duration"
              value={formData.duration ?? ""}
              onChange={handleDurationChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            >
              <option value="">Select Duration</option>
              {durationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {sortieLocalTiming && (
          <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            {sortieLocalTiming}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Where
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="departureAirport"
              className="block text-sm font-medium"
            >
              Departure Airport
            </label>
            <input
              type="text"
              id="departureAirport"
              value={formData.airport?.[0] || ""}
              onChange={(e) => handleAirportChange(0, e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="arrivalAirport" className="block text-sm font-medium">
              Arrival Airport
            </label>
            <input
              type="text"
              id="arrivalAirport"
              value={formData.airport?.[1] || ""}
              onChange={(e) => handleAirportChange(1, e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            />
          </div>

          <PositionInput
            rawValue={formData.route || ""}
            cachedPosition={formData.position ?? [null, null]}
            onChange={handlePositionChange}
          />

          <div className="space-y-2">
            <label htmlFor="operatingAltitude" className="block text-sm font-medium">
              Operating Altitude (MSL ft)
            </label>
            <input
              type="number"
              id="operatingAltitude"
              value={formData.altitude?.[1] ?? ""}
              onChange={handleOperatingAltitudeChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="weight" className="block text-sm font-medium">
              Aircraft Takeoff Weight (lbs)
            </label>
            <input
              type="number"
              id="weight"
              name="weight"
              value={formData.weight ?? ""}
              onChange={handleWeightChange}
              min={2200}
              max={3600}
              className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Pilot Qualifications
        </h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.mtnEndorse}
              onChange={handleQualChange("mtnEndorse")}
            />
            Current CAPF 70-5 Mountain Flight Endorsement?
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.mtnCert}
              onChange={handleQualChange("mtnCert")}
            />
            Current CAPF 70-91 and Mountain Flying Certification?
          </label>
        </div>
      </div>
    </div>
  );
```

Note: `PositionInput` renders its own labelled "Area of Operations (position)" input (existing component, unchanged). Inside the **Where** grid it occupies one cell — the existing `<PositionInput>` element already wraps itself in a `space-y-2` div, so it slots into the grid like a sibling.

- [ ] **Step 4: Run SortieInfo tests**

Run: `npx jest src/components/SortieInfo.test.tsx`
Expected: PASS — all existing tests still green; four new tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/SortieInfo.tsx src/components/SortieInfo.test.tsx
git commit -m "Restructure SortieInfo into four sub-headings and inline mountain quals

Adds Pilot & Aircraft / When / Where / Pilot Qualifications h3 groups
matching the redesign mockup. The two mountain qualification
checkboxes (previously in standalone MountainQuals) now live under
'Pilot Qualifications'. Drops the outer max-w-4xl bg-white card — the
StepShell card (added in the next task) provides the chrome."
```

---

## Task 4: Wrap Step 1 with StepShell in AppInputs and delete MountainQuals

**Files:**
- Modify: `src/components/AppInputs.tsx`
- Delete: `src/components/MountainQuals.tsx`

The Phase 1 `<section id="step-sortie">` wrapper is replaced by `<StepShell id="step-sortie" …>`. `MountainQuals` is removed entirely — SortieInfo now renders the qualification checkboxes. The Phase 1 `AppInputs.test.tsx` assertion `container.querySelector("#step-sortie") !== null` still passes because StepShell renders `<section id="step-sortie">`.

- [ ] **Step 1: Run the existing AppInputs tests to baseline**

Run: `npx jest src/components/AppInputs.test.tsx`
Expected: PASS — record the passing count.

- [ ] **Step 2: Update AppInputs.tsx imports**

Open `src/components/AppInputs.tsx`. Replace the import block (currently lines 1–8) with:

```tsx
"use client";

import { type ReactNode } from "react";
import SortieInfo from "@/components/SortieInfo";
import WeatherInfo from "@/components/WeatherInfo";
import AircraftPerformance from "@/components/AircraftPerformance";
import StepShell from "@/components/StepShell";
import type { WorksheetData } from "@/utils/types";
```

(Removes `MountainQuals`; adds `StepShell`.)

- [ ] **Step 3: Replace the step-sortie section with StepShell**

In the same file, find the JSX `return` block (currently the two `<section id="step-sortie">` and `<section id="step-weather">` wrappers). Replace the **Sortie section** (the one wrapping `SortieInfo` + `MountainQuals`) with:

```tsx
    <StepShell
      id="step-sortie"
      number={1}
      status="active"
      title="Sortie Details"
      subtitle="Who's flying, when, and where"
    >
      <SortieInfo onUpdate={handleUpdate} initialData={state} />
    </StepShell>
```

Leave the `<section id="step-weather">` block unchanged for now — Task 5 handles it. The full file at this point should be:

```tsx
"use client";

import { type ReactNode } from "react";
import SortieInfo from "@/components/SortieInfo";
import WeatherInfo from "@/components/WeatherInfo";
import AircraftPerformance from "@/components/AircraftPerformance";
import StepShell from "@/components/StepShell";
import type { WorksheetData } from "@/utils/types";

interface WorksheetFormProps {
  state: WorksheetData;
  onStateUpdate: (updates: Partial<WorksheetData>) => void;
  weatherLastUpdated?: Date;
  useFahrenheit?: boolean;
}

export default function AppInputs({
  state,
  onStateUpdate,
  weatherLastUpdated,
  useFahrenheit,
}: WorksheetFormProps): ReactNode {
  const handleUpdate = (data: Partial<WorksheetData>) => {
    onStateUpdate(data);
  };

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <StepShell
        id="step-sortie"
        number={1}
        status="active"
        title="Sortie Details"
        subtitle="Who's flying, when, and where"
      >
        <SortieInfo onUpdate={handleUpdate} initialData={state} />
      </StepShell>
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
}
```

- [ ] **Step 4: Delete MountainQuals.tsx**

```bash
git rm src/components/MountainQuals.tsx
```

- [ ] **Step 5: Run the full Jest suite**

Run: `npx jest`
Expected: PASS across all suites. `AppInputs.test.tsx` should still report green on its anchor-id assertions (`#step-sortie` exists, `#step-weather` exists) and on its existing onUpdate-flow assertions because `SortieInfo` is still being rendered, just inside StepShell now.

If you see `AircraftPerformance.test.tsx` errors at the top of file because of unrelated pre-existing TypeScript errors, that is fine — Jest still runs the suite.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppInputs.tsx src/components/MountainQuals.tsx
git commit -m "Wrap Sortie Details in StepShell and remove MountainQuals component

Replaces the Phase 1 <section id='step-sortie'> wrapper with StepShell
so Sortie Details renders inside the numbered/bordered card. Removes
the standalone MountainQuals component — its two checkboxes are now
rendered by SortieInfo under the 'Pilot Qualifications' sub-heading
(merged in the previous commit)."
```

---

## Task 5: Drop outer cards from WeatherInfo and AircraftPerformance, wrap Step 2 in StepShell

**Files:**
- Modify: `src/components/WeatherInfo.tsx`
- Modify: `src/components/AircraftPerformance.tsx`
- Modify: `src/components/AppInputs.tsx`

Both Weather components currently wrap their content in `<div className="w-full max-w-4xl">`. Inside `StepShell`'s card, that outer wrapper becomes redundant. Drop it from each (but keep the `<h2>` inside — Phase 4 reorganises these into Aloft / At airports / Advisories sub-headings, but for Phase 2 the existing `<h2>Weather Information</h2>` and `<h2>Aircraft Performance</h2>` stay).

- [ ] **Step 1: Drop the outer wrapper in WeatherInfo.tsx**

In `src/components/WeatherInfo.tsx`, find the `return` block (around line 240). The current outer JSX is:

```tsx
  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Weather Information</h2>
        …
```

Replace the outer `<div className="w-full max-w-4xl">` with a fragment so that the inner content flows directly:

```tsx
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Weather Information</h2>
        …
```

(Just remove the `className="w-full max-w-4xl"` from the outer div — keep the `<div>` tag itself so its closing tag in the existing code still matches.)

- [ ] **Step 2: Drop the outer wrapper in AircraftPerformance.tsx**

In `src/components/AircraftPerformance.tsx`, find the `return` block (around line 257). The current outer JSX is:

```tsx
  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-xl font-bold mb-4">Aircraft Performance</h2>
      …
```

Replace with:

```tsx
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Aircraft Performance</h2>
      …
```

- [ ] **Step 3: Wrap Step 2 in StepShell inside AppInputs.tsx**

In `src/components/AppInputs.tsx`, replace the `<section id="step-weather">` wrapper (the one wrapping `WeatherInfo` and `AircraftPerformance`) with:

```tsx
      <StepShell
        id="step-weather"
        number={2}
        status="pending"
        title="Weather"
        subtitle="Winds aloft, terminal conditions, and advisories"
      >
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
      </StepShell>
```

After this edit, the full `return` block in AppInputs.tsx should be:

```tsx
  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <StepShell
        id="step-sortie"
        number={1}
        status="active"
        title="Sortie Details"
        subtitle="Who's flying, when, and where"
      >
        <SortieInfo onUpdate={handleUpdate} initialData={state} />
      </StepShell>
      <StepShell
        id="step-weather"
        number={2}
        status="pending"
        title="Weather"
        subtitle="Winds aloft, terminal conditions, and advisories"
      >
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
      </StepShell>
    </div>
  );
```

- [ ] **Step 4: Run the full Jest suite**

Run: `npx jest`
Expected: PASS — all Phase 1 anchor-id assertions (`#step-weather` etc.) still pass because StepShell renders `<section id="step-weather">`. Tests for WeatherInfo and AircraftPerformance still pass because their inner DOM is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/WeatherInfo.tsx src/components/AircraftPerformance.tsx src/components/AppInputs.tsx
git commit -m "Wrap Weather in StepShell and drop the inner components' outer cards

Replaces the Phase 1 <section id='step-weather'> wrapper with StepShell
so Weather renders inside the numbered/bordered card. WeatherInfo and
AircraftPerformance drop their 'w-full max-w-4xl' wrappers — StepShell
now provides the card chrome. Phase 4 will reorganize the body into
Aloft / At airports / Advisories sub-headings; this commit keeps each
component's existing internal structure."
```

---

## Task 6: Drop Calculations outer card and wrap Step 3 in StepShell

**Files:**
- Modify: `src/components/Calculations.tsx`
- Modify: `src/components/AppContainer.tsx`

`AppContainer` currently wraps `<Calculations>` in a `<section id="step-decision">` (from Phase 1). Replace that wrapper with `<StepShell id="step-decision" …>` and pass `showSpine={false}` because Decision is the last step.

- [ ] **Step 1: Drop the outer card classes in Calculations.tsx**

In `src/components/Calculations.tsx`, find the `return` block (line 30) and change:

```tsx
    <div className="w-full max-w-4xl bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>
```

to:

```tsx
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>
```

(Keep `w-full` so the contents still fill the available width inside StepShell's body. Drop `max-w-4xl bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md` — StepShell provides those.)

- [ ] **Step 2: Update AppContainer.tsx imports**

In `src/components/AppContainer.tsx`, add the StepShell import alongside Stepper (the existing line is `import Stepper, { type StepperStep } from "@/components/Stepper";`):

```tsx
import Stepper, { type StepperStep } from "@/components/Stepper";
import StepShell from "@/components/StepShell";
```

- [ ] **Step 3: Replace `<section id="step-decision">` with `<StepShell>`**

In the same file, find this block:

```tsx
            <section id="step-decision" className="w-full flex justify-center scroll-mt-[60px]">
              <Calculations state={state} />
            </section>
```

Replace with:

```tsx
            <StepShell
              id="step-decision"
              number={3}
              status="pending"
              title="Decision"
              subtitle="Go / no-go summary, with detailed calculations below"
              showSpine={false}
            >
              <Calculations state={state} />
            </StepShell>
```

The surrounding `<main>` and outer flex layout stay unchanged. Note we drop the inner `flex justify-center` because StepShell handles its own width via its `<section>` and `<article>` styling; `Calculations` already has `w-full` from Step 1.

- [ ] **Step 4: Run the full Jest suite**

Run: `npx jest`
Expected: PASS — all 479+ tests green. The Phase 1 assertion `container.querySelector("#step-decision") !== null` in `AppContainer.test.tsx` still passes because `StepShell` renders `<section id="step-decision">`.

- [ ] **Step 5: Run TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep -E "Stepper|StepShell|AppContainer\.tsx|AppInputs\.tsx|SortieInfo\.tsx|WeatherInfo\.tsx|AircraftPerformance\.tsx|Calculations\.tsx"`
Expected: no output (no new TypeScript errors introduced by this phase). Pre-existing errors in `AircraftPerformance.test.tsx` / `weatherDataMapper.test.ts` are unrelated and were present before Phase 2.

- [ ] **Step 6: Visual smoke test**

```bash
npm run dev
```

Open <http://localhost:3000>. Verify by eye:

1. Three bordered cards, each with a numbered circle on the left (`1` filled slate-900 for Sortie, `2` filled slate-300 for Weather pending, `3` filled slate-300 for Decision pending — the colors match Phase 1's stepper exactly).
2. A vertical grey "spine" line runs from beneath the `1` circle down past the Sortie card and similarly from beneath `2` down past Weather. The `3` (Decision) circle has no spine.
3. Each card has a header strip with a bold title and a small grey subtitle.
4. Inside Step 1 you see four sub-headings: **Pilot & Aircraft**, **When**, **Where**, **Pilot Qualifications**, with the right inputs/checkboxes under each.
5. The Aircraft Performance table's middle (Operating) column for the altitude row is now blank (not echoing `Operating altitude` from Sortie Details).
6. The Stepper at the top still scrolls correctly to each section.
7. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/Calculations.tsx src/components/AppContainer.tsx
git commit -m "Wrap Decision in StepShell and drop Calculations outer card

Replaces the Phase 1 <section id='step-decision'> wrapper with
StepShell (showSpine=false because Decision is the last step).
Calculations drops the 'max-w-4xl bg-white p-6 rounded-lg shadow-md'
classes — StepShell now provides the card chrome."
```

---

## Verification — full phase

- [ ] All six task commits on the branch:
  ```bash
  git log --oneline -7
  ```
  Expected: the Task 1–6 commits plus the Phase 1 tip (`Address Copilot review feedback on Phase 1`).

- [ ] Jest is green:
  ```bash
  npx jest
  ```

- [ ] TypeScript introduces no new errors:
  ```bash
  npx tsc --noEmit 2>&1 | grep -E "Stepper|StepShell|AppContainer\.tsx|AppInputs\.tsx|SortieInfo\.tsx|WeatherInfo\.tsx|AircraftPerformance\.tsx|Calculations\.tsx"
  ```
  Expected: empty.

- [ ] `MountainQuals.tsx` is deleted:
  ```bash
  test ! -f src/components/MountainQuals.tsx && echo "OK"
  ```
  Expected: prints `OK`.

- [ ] Visual checklist (in a browser):
  - Three numbered bordered cards with spine lines connecting steps 1→2 and (visually) 2→3
  - Last step (Decision) has no trailing spine
  - Sortie Details body shows four sub-headings in this order: Pilot & Aircraft / When / Where / Pilot Qualifications
  - Operating Altitude (MSL ft) appears under the "Where" sub-heading in Sortie Details
  - Aircraft Performance table's altitude row has an empty Operating column
  - Sticky Stepper still scrolls / scroll-spies correctly
  - InstructionsAndNotes and MountainFlyingChecklist still render at the bottom in that order
  - No browser console errors

---

## Out of scope for Phase 2 (do **not** add here)

- Slim header / Fetch button relocation — Phase 3
- State-aware action bar with morphing button — Phase 3
- Real step status derivation (active/complete/warning driven by state) — Phase 3
- Real status badges (e.g. "8 of 11 fields", "Fetched 14:31 UTC", "1 warning") — Phase 3
- Weather and Aircraft Performance merge into one body with Aloft / At airports / Advisories sub-headings — Phase 4
- Airport-card layout (per-airport METAR card) — Phase 4
- Runway dropdown defaulting to shortest — Phase 4
- "For reference only" inline disclaimer in Decision — Phase 5
- Slide-overs for Instructions and Checklist — Phase 5
- `@media print` stylesheet — Phase 5
