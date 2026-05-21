# Open Route in SkyVector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button in the Sortie Info "Where" section that opens the current departure → operating → arrival route on skyvector.com in a new tab.

**Architecture:** One new pure utility module (`src/utils/skyvector.ts`) exposes `latLonToDmsWaypoint` and `buildSkyvectorUrl`. The existing `SortieInfo` component renders a `<button>` that calls `buildSkyvectorUrl` against `formData.airport` and `formData.position`, disables itself when the helper returns `null`, and opens the URL with `window.open` on click.

**Tech Stack:** TypeScript, React 19 / Next.js 16 App Router, Jest + React Testing Library, Tailwind CSS v4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-17-skyvector-button-design.md`

---

## File Structure

**New files:**
- `src/utils/skyvector.ts` — pure functions, ~50 lines. Exports `latLonToDmsWaypoint(lat, lon)` and `buildSkyvectorUrl({ departure, arrival, operating })`.
- `src/utils/__tests__/skyvector.test.ts` — unit tests for both helpers.

**Modified files:**
- `src/components/SortieInfo.tsx` — adds an "Open in SkyVector" button at the bottom of the **Where** section, before the `Pilot Qualifications` section. No new state or props.
- `src/components/SortieInfo.test.tsx` — adds tests for the button's disabled logic and `window.open` invocation.

---

## Task 1: DMS waypoint converter — happy path

**Files:**
- Create: `src/utils/skyvector.ts`
- Create: `src/utils/__tests__/skyvector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/skyvector.test.ts`:

```ts
import { latLonToDmsWaypoint } from "@/utils/skyvector";

describe("latLonToDmsWaypoint", () => {
  it("formats positive lat / negative lon", () => {
    expect(latLonToDmsWaypoint(40.5023, -110.7456)).toBe("403008N1104444W");
  });

  it("formats negative lat / positive lon", () => {
    expect(latLonToDmsWaypoint(-33.8688, 151.2093)).toBe("335208S1511233E");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx jest src/utils/__tests__/skyvector.test.ts -t "latLonToDmsWaypoint"`
Expected: FAIL with `Cannot find module '@/utils/skyvector'` (or similar resolution error).

- [ ] **Step 3: Write the minimal implementation**

Create `src/utils/skyvector.ts`:

```ts
const pad = (n: number, width: number): string =>
  String(n).padStart(width, "0");

export function latLonToDmsWaypoint(lat: number, lon: number): string {
  const formatComponent = (value: number, degreeWidth: number, maxDeg: number): { deg: number; min: number; sec: number } => {
    const abs = Math.abs(value);
    let deg = Math.floor(abs);
    let minTotal = (abs - deg) * 60;
    let min = Math.floor(minTotal);
    let sec = Math.round((minTotal - min) * 60);
    if (sec === 60) {
      sec = 0;
      min += 1;
    }
    if (min === 60) {
      min = 0;
      deg += 1;
    }
    if (deg > maxDeg) deg = maxDeg;
    return { deg, min, sec };
  };

  const latParts = formatComponent(lat, 2, 90);
  const lonParts = formatComponent(lon, 3, 180);
  const latSuffix = lat < 0 ? "S" : "N";
  const lonSuffix = lon < 0 ? "W" : "E";

  return (
    pad(latParts.deg, 2) + pad(latParts.min, 2) + pad(latParts.sec, 2) + latSuffix +
    pad(lonParts.deg, 3) + pad(lonParts.min, 2) + pad(lonParts.sec, 2) + lonSuffix
  );
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx jest src/utils/__tests__/skyvector.test.ts -t "latLonToDmsWaypoint"`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/skyvector.ts src/utils/__tests__/skyvector.test.ts
git commit -m "Add DMS waypoint converter for SkyVector route URLs"
```

---

## Task 2: DMS converter — edge cases (rollover, zero, poles, neg-zero)

**Files:**
- Modify: `src/utils/__tests__/skyvector.test.ts` — append cases
- Modify: `src/utils/skyvector.ts` — only if tests fail

- [ ] **Step 1: Add failing edge-case tests**

Append these `it` blocks inside the existing `describe("latLonToDmsWaypoint", ...)` in `src/utils/__tests__/skyvector.test.ts`:

```ts
it("formats exact integer degrees", () => {
  expect(latLonToDmsWaypoint(40, -110)).toBe("400000N1100000W");
});

it("formats zero coordinates with N/E suffix and correct widths", () => {
  expect(latLonToDmsWaypoint(0, 0)).toBe("000000N0000000E");
});

it("treats negative zero as positive (N/E)", () => {
  expect(latLonToDmsWaypoint(-0, -0)).toBe("000000N0000000E");
});

it("rolls seconds 60 over into minutes", () => {
  // 40 + 59.9/60 + 59.6/3600 deg places seconds at ~59.6, which rounds to 60
  // and should carry into minutes.
  const lat = 40 + 59 / 60 + 59.6 / 3600;
  expect(latLonToDmsWaypoint(lat, 0)).toBe("410000N0000000E");
});

it("clamps poles and anti-meridian", () => {
  expect(latLonToDmsWaypoint(89.9999, 179.9999)).toBe("900000N1800000E");
  expect(latLonToDmsWaypoint(-89.9999, -179.9999)).toBe("900000S1800000W");
});
```

- [ ] **Step 2: Run the tests and confirm whether they pass or fail**

Run: `npx jest src/utils/__tests__/skyvector.test.ts -t "latLonToDmsWaypoint"`
Expected: all pass with the Task 1 implementation (the rollover/clamp logic is already there). If any case fails, narrow the failing test and adjust the implementation in `src/utils/skyvector.ts` minimally until green.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/skyvector.test.ts src/utils/skyvector.ts
git commit -m "Cover edge cases in DMS waypoint converter"
```

---

## Task 3: `buildSkyvectorUrl` happy path

**Files:**
- Modify: `src/utils/__tests__/skyvector.test.ts`
- Modify: `src/utils/skyvector.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/utils/__tests__/skyvector.test.ts`:

```ts
import { buildSkyvectorUrl } from "@/utils/skyvector";

describe("buildSkyvectorUrl", () => {
  it("builds a three-waypoint URL when all fields are set", () => {
    expect(
      buildSkyvectorUrl({
        departure: "KPVU",
        arrival: "KSGU",
        operating: [40.5023, -110.7456],
      })
    ).toBe(
      "https://skyvector.com/?fpl=KPVU%20403008N1104444W%20KSGU"
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx jest src/utils/__tests__/skyvector.test.ts -t "buildSkyvectorUrl"`
Expected: FAIL — `buildSkyvectorUrl is not a function` or similar.

- [ ] **Step 3: Implement `buildSkyvectorUrl`**

Append to `src/utils/skyvector.ts`:

```ts
export interface BuildSkyvectorUrlInput {
  departure: string;
  arrival: string;
  operating: [number | null, number | null] | null;
}

export function buildSkyvectorUrl(input: BuildSkyvectorUrlInput): string | null {
  const dep = input.departure.trim().toUpperCase();
  const arr = input.arrival.trim().toUpperCase();
  if (!dep || !arr) return null;

  const waypoints: string[] = [dep];
  if (
    input.operating &&
    input.operating[0] !== null &&
    input.operating[1] !== null
  ) {
    waypoints.push(latLonToDmsWaypoint(input.operating[0], input.operating[1]));
  }
  waypoints.push(arr);

  return `https://skyvector.com/?fpl=${waypoints.join("%20")}`;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx jest src/utils/__tests__/skyvector.test.ts -t "buildSkyvectorUrl"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/skyvector.ts src/utils/__tests__/skyvector.test.ts
git commit -m "Add buildSkyvectorUrl with three-waypoint route"
```

---

## Task 4: `buildSkyvectorUrl` edge cases

**Files:**
- Modify: `src/utils/__tests__/skyvector.test.ts`
- Modify: `src/utils/skyvector.ts` (only if needed)

- [ ] **Step 1: Add failing edge-case tests**

Append inside the existing `describe("buildSkyvectorUrl", ...)`:

```ts
it("omits operating waypoint when operating is null", () => {
  expect(
    buildSkyvectorUrl({ departure: "KPVU", arrival: "KSGU", operating: null })
  ).toBe("https://skyvector.com/?fpl=KPVU%20KSGU");
});

it("omits operating waypoint when one coordinate is null", () => {
  expect(
    buildSkyvectorUrl({
      departure: "KPVU",
      arrival: "KSGU",
      operating: [40.5, null],
    })
  ).toBe("https://skyvector.com/?fpl=KPVU%20KSGU");
});

it("returns null when departure is empty", () => {
  expect(
    buildSkyvectorUrl({ departure: "", arrival: "KSGU", operating: null })
  ).toBeNull();
});

it("returns null when arrival is whitespace-only", () => {
  expect(
    buildSkyvectorUrl({ departure: "KPVU", arrival: "   ", operating: null })
  ).toBeNull();
});

it("uppercases and trims airport identifiers", () => {
  expect(
    buildSkyvectorUrl({
      departure: " kpvu ",
      arrival: "kSgU",
      operating: null,
    })
  ).toBe("https://skyvector.com/?fpl=KPVU%20KSGU");
});
```

- [ ] **Step 2: Run the tests**

Run: `npx jest src/utils/__tests__/skyvector.test.ts`
Expected: all pass with the Task 3 implementation. If any fail, narrow and fix in `src/utils/skyvector.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/skyvector.test.ts src/utils/skyvector.ts
git commit -m "Cover buildSkyvectorUrl edge cases"
```

---

## Task 5: Render the "Open in SkyVector" button (disabled state first)

**Files:**
- Modify: `src/components/SortieInfo.test.tsx`
- Modify: `src/components/SortieInfo.tsx`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `src/components/SortieInfo.test.tsx` (after the existing top-level `describe("SortieInfo", ...)` — or inside it, near the bottom):

```ts
describe("SortieInfo — SkyVector button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the button disabled when both airports are blank", () => {
    render(<SortieInfo onUpdate={jest.fn()} initialData={defaultInitialData} />);
    const button = screen.getByRole("button", { name: /open in skyvector/i });
    expect(button).toBeDisabled();
  });

  it("renders the button disabled when only departure is set", () => {
    const initialData = { ...defaultInitialData, airport: ["KPVU", ""] as [string, string] };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    const button = screen.getByRole("button", { name: /open in skyvector/i });
    expect(button).toBeDisabled();
  });

  it("renders the button disabled when only arrival is set", () => {
    const initialData = { ...defaultInitialData, airport: ["", "KSGU"] as [string, string] };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    const button = screen.getByRole("button", { name: /open in skyvector/i });
    expect(button).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx jest src/components/SortieInfo.test.tsx -t "SkyVector"`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name /open in skyvector/i`.

- [ ] **Step 3: Add the button to `SortieInfo`**

Open `src/components/SortieInfo.tsx` and update the imports at the top to include the SkyVector helper:

```ts
import { buildSkyvectorUrl } from "@/utils/skyvector";
```

Find the JSX for the **Where** section. It currently ends with the closing tags of the grid (`</div></div>`) just before the `Pilot Qualifications` block. Insert this immediately after the closing `</div>` of the grid and before the closing `</div>` of the Where section (i.e., a sibling of the grid, still inside the Where section):

```tsx
{(() => {
  const skyvectorUrl = buildSkyvectorUrl({
    departure: formData.airport?.[0] ?? "",
    arrival: formData.airport?.[1] ?? "",
    operating: formData.position ?? null,
  });
  const disabled = skyvectorUrl === null;
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (skyvectorUrl) {
            window.open(skyvectorUrl, "_blank", "noopener,noreferrer");
          }
        }}
        title={disabled ? "Set departure and arrival airports" : "Open route in SkyVector"}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Open in SkyVector
      </button>
    </div>
  );
})()}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx jest src/components/SortieInfo.test.tsx -t "SkyVector"`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/SortieInfo.tsx src/components/SortieInfo.test.tsx
git commit -m "Add disabled SkyVector button to Where section"
```

---

## Task 6: Button is enabled and opens URL when both airports are set

**Files:**
- Modify: `src/components/SortieInfo.test.tsx`

- [ ] **Step 1: Add failing tests**

Append inside the `describe("SortieInfo — SkyVector button", ...)` block:

```ts
it("is enabled and opens a two-waypoint URL when only airports are set", () => {
  const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  const initialData = {
    ...defaultInitialData,
    airport: ["KPVU", "KSGU"] as [string, string],
  };
  render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);

  const button = screen.getByRole("button", { name: /open in skyvector/i });
  expect(button).not.toBeDisabled();

  fireEvent.click(button);
  expect(openSpy).toHaveBeenCalledWith(
    "https://skyvector.com/?fpl=KPVU%20KSGU",
    "_blank",
    "noopener,noreferrer"
  );

  openSpy.mockRestore();
});

it("opens a three-waypoint URL when operating coordinates are set", () => {
  const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  const initialData = {
    ...defaultInitialData,
    airport: ["KPVU", "KSGU"] as [string, string],
    position: [40.5023, -110.7456] as [number | null, number | null],
  };
  render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);

  fireEvent.click(screen.getByRole("button", { name: /open in skyvector/i }));
  expect(openSpy).toHaveBeenCalledWith(
    "https://skyvector.com/?fpl=KPVU%20403008N1104444W%20KSGU",
    "_blank",
    "noopener,noreferrer"
  );

  openSpy.mockRestore();
});

it("falls back to two-waypoint URL when operating position has nulls", () => {
  const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  const initialData = {
    ...defaultInitialData,
    airport: ["KPVU", "KSGU"] as [string, string],
    position: [null, null] as [number | null, number | null],
  };
  render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);

  fireEvent.click(screen.getByRole("button", { name: /open in skyvector/i }));
  expect(openSpy).toHaveBeenCalledWith(
    "https://skyvector.com/?fpl=KPVU%20KSGU",
    "_blank",
    "noopener,noreferrer"
  );

  openSpy.mockRestore();
});
```

- [ ] **Step 2: Run the tests and verify they pass**

Run: `npx jest src/components/SortieInfo.test.tsx -t "SkyVector"`
Expected: 6 passing (3 from Task 5 + 3 new). No implementation changes needed — Task 5 already wired up `window.open` and the URL builder.

- [ ] **Step 3: Commit**

```bash
git add src/components/SortieInfo.test.tsx
git commit -m "Test SkyVector button opens URL with correct waypoints"
```

---

## Task 7: Full verification — lint, typecheck, tests

**Files:** (none modified)

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --silent`
Expected: all suites pass. If anything outside the new files fails, investigate before continuing.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors. If lint reports issues in the new files, fix them and re-run.

- [ ] **Step 3: Run the production build (typecheck)**

Run: `npm run build`
Expected: build completes without TypeScript errors.

- [ ] **Step 4: Commit any fixes (if needed)**

If steps 2 or 3 required code changes:

```bash
git add -A
git commit -m "Fix lint/typecheck for SkyVector button"
```

If nothing changed, skip this step.

---

## Done criteria

- `npm test`, `npm run lint`, and `npm run build` all pass.
- A user with departure and arrival airports filled in sees an enabled "Open in SkyVector" button in the **Where** section that opens skyvector.com in a new tab with the route prefilled.
- A user without both airports sees the button disabled with an explanatory tooltip.
- The operating waypoint is included as a DMS coordinate when `position` is parsed; otherwise the URL is a two-waypoint route.
