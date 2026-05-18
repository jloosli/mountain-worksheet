# Auto airport lookup on change / URL load (issue #121) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate `AirportCard` runway dropdowns automatically — on URL load and on every airport-code change — without requiring the user to click "Fetch Weather."

**Architecture:** Introduce a custom React hook `useAirportRunways(airports)` that owns the airport-info side effect. It debounces changes, normalizes/validates ICAO codes, dedupes when departure and arrival match, discards stale responses, and on failure leaves slots `null`. `AppContainer` replaces its `useState` + `onAirportInfoUpdate` wiring with the hook. `WeatherDataIntegration` loses its runway side-effect entirely (the weather batch still fetches airport data for lat/lon, but no longer pushes runways up).

**Tech Stack:** TypeScript, React 19 hooks (`useEffect`, `useState`, `useRef`), Jest 30 with `@testing-library/react`'s `renderHook` and fake timers.

Spec: `docs/superpowers/specs/2026-05-17-issue-121-auto-airport-lookup-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/utils/useAirportRunways.ts` | Create | Hook: watches airports tuple, debounced fetch via `getAirportInfo`, returns `[depRunways, arrRunways]`. |
| `src/utils/useAirportRunways.test.ts` | Create | Unit tests for the hook. |
| `src/components/AppContainer.tsx` | Modify | Replace `useState`+callback wiring with `useAirportRunways(state.airport)`. Drop `onAirportInfoUpdate` prop pass-through. |
| `src/components/WeatherDataIntegration.tsx` | Modify | Remove `onAirportInfoUpdate` prop, `extractRunways` helper, and the runway side-effect block. |
| `src/components/WeatherDataIntegration.test.tsx` | Modify | Delete the `onAirportInfoUpdate callback` describe block. |
| `src/utils/types.ts` | Modify | Remove the now-unused `AirportRunwayInfo` interface. |

---

## Task 1: Add `useAirportRunways` hook (TDD)

**Files:**
- Create: `src/utils/useAirportRunways.ts`
- Test: `src/utils/useAirportRunways.test.ts`

### Step 1.1 — Write failing tests

- [ ] Create `src/utils/useAirportRunways.test.ts` with the following content:

```ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAirportRunways } from "./useAirportRunways";
import { getAirportInfo } from "./aviationWeatherApi";

jest.mock("./aviationWeatherApi", () => ({
  getAirportInfo: jest.fn(),
}));

const mockedGetAirportInfo = getAirportInfo as jest.MockedFunction<
  typeof getAirportInfo
>;

const fakeAirport = (icaoId: string, runways: Array<{ id: string; length: number; alignment: number | null }>) => ({
  icaoId,
  name: icaoId,
  country: "US",
  lat: 0,
  lon: 0,
  elev: 0,
  priority: 1,
  tz: "UTC",
  runway: runways.map((r) => ({
    id: r.id,
    length: r.length,
    width: 100,
    surface: "ASPH",
    alignment: r.alignment,
    lighted: true,
    closed: false,
  })),
});

describe("useAirportRunways", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedGetAirportInfo.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns [null, null] without calling API when both codes are empty", () => {
    const { result } = renderHook(() => useAirportRunways(["", ""]));
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(mockedGetAirportInfo).not.toHaveBeenCalled();
    expect(result.current).toEqual([null, null]);
  });

  it("fetches both codes once after debounce when both are valid on mount", async () => {
    mockedGetAirportInfo.mockResolvedValue([
      fakeAirport("KDEN", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
      fakeAirport("KSLC", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { result } = renderHook(() => useAirportRunways(["KDEN", "KSLC"]));

    expect(mockedGetAirportInfo).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(1);
    });
    expect(mockedGetAirportInfo).toHaveBeenCalledWith(["KDEN", "KSLC"]);

    await waitFor(() => {
      expect(result.current[0]).not.toBeNull();
    });
    expect(result.current[0]).toEqual([
      { id: "16L/34R", length: 12000, alignment: 160 },
    ]);
    expect(result.current[1]).toEqual([
      { id: "16L/34R", length: 12000, alignment: 160 },
    ]);
  });

  it("debounces rapid changes into a single fetch with the final value", async () => {
    mockedGetAirportInfo.mockResolvedValue([
      fakeAirport("KASE", [{ id: "15/33", length: 8000, alignment: 150 }]),
      fakeAirport("KSLC", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { rerender } = renderHook(
      ({ airports }: { airports: [string, string] }) => useAirportRunways(airports),
      { initialProps: { airports: ["K", ""] as [string, string] } }
    );
    rerender({ airports: ["KA", ""] });
    rerender({ airports: ["KAS", ""] });
    rerender({ airports: ["KASE", "KSLC"] });

    act(() => {
      jest.advanceTimersByTime(399);
    });
    expect(mockedGetAirportInfo).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(1);
    });
    expect(mockedGetAirportInfo).toHaveBeenCalledWith(["KASE", "KSLC"]);
  });

  it("skips invalid codes (length < 3) but fetches the valid sibling", async () => {
    mockedGetAirportInfo.mockResolvedValue([
      fakeAirport("KSLC", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { result } = renderHook(() => useAirportRunways(["K", "KSLC"]));
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledWith(["KSLC"]);
    });
    await waitFor(() => {
      expect(result.current[1]).not.toBeNull();
    });
    expect(result.current[0]).toBeNull();
  });

  it("dedupes when dep === arr and fans the result to both slots", async () => {
    mockedGetAirportInfo.mockResolvedValue([
      fakeAirport("KDEN", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { result } = renderHook(() => useAirportRunways(["KDEN", "KDEN"]));
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledWith(["KDEN"]);
    });
    await waitFor(() => {
      expect(result.current[0]).not.toBeNull();
    });
    expect(result.current[0]).toEqual(result.current[1]);
  });

  it("returns null for both slots when the API rejects", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockedGetAirportInfo.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useAirportRunways(["KDEN", "KSLC"]));
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });
    expect(result.current).toEqual([null, null]);
    warnSpy.mockRestore();
  });

  it("ignores a stale response when the codes change mid-flight", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    mockedGetAirportInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }) as ReturnType<typeof getAirportInfo>
    );
    mockedGetAirportInfo.mockResolvedValueOnce([
      fakeAirport("KASE", [{ id: "15/33", length: 8000, alignment: 150 }]),
      fakeAirport("KSLC", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { result, rerender } = renderHook(
      ({ airports }: { airports: [string, string] }) => useAirportRunways(airports),
      { initialProps: { airports: ["KDEN", "KSLC"] as [string, string] } }
    );

    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(1);
    });

    rerender({ airports: ["KASE", "KSLC"] });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(2);
    });

    // Now resolve the first (stale) request with data for the old codes.
    await act(async () => {
      resolveFirst([
        fakeAirport("KDEN", [{ id: "OLD/OLD", length: 1, alignment: 0 }]),
        fakeAirport("KSLC", [{ id: "OLD/OLD", length: 1, alignment: 0 }]),
      ]);
    });

    await waitFor(() => {
      expect(result.current[0]).not.toBeNull();
    });
    // The fresh response, not the stale one, wins.
    expect(result.current[0]).toEqual([
      { id: "15/33", length: 8000, alignment: 150 },
    ]);
  });
});
```

### Step 1.2 — Run tests, confirm they fail

- [ ] Run: `npm test -- --testPathPatterns=useAirportRunways`
- [ ] Expected: All tests fail with `Cannot find module './useAirportRunways'` (module does not exist yet).

### Step 1.3 — Implement the hook

- [ ] Create `src/utils/useAirportRunways.ts` with the following content:

```ts
import { useEffect, useRef, useState } from "react";
import { getAirportInfo, type AirportResponse } from "./aviationWeatherApi";
import type { RunwayOption } from "./types";

const ICAO_RE = /^[A-Z0-9]{3,4}$/;
const DEBOUNCE_MS = 400;

type RunwaysTuple = [RunwayOption[] | null, RunwayOption[] | null];

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

function isValid(code: string): boolean {
  return ICAO_RE.test(code);
}

function extractRunways(
  airport: AirportResponse | undefined
): RunwayOption[] | null {
  if (!airport?.runway || airport.runway.length === 0) return null;
  return airport.runway.map((r) => ({
    id: r.id,
    length: r.length,
    alignment: r.alignment,
  }));
}

export function useAirportRunways(
  airports: [string, string]
): RunwaysTuple {
  const [runways, setRunways] = useState<RunwaysTuple>([null, null]);
  const seqRef = useRef(0);
  const lastResolvedRef = useRef<[string, string]>(["", ""]);

  const dep = normalize(airports[0] ?? "");
  const arr = normalize(airports[1] ?? "");
  const depValid = isValid(dep);
  const arrValid = isValid(arr);

  useEffect(() => {
    if (
      lastResolvedRef.current[0] === dep &&
      lastResolvedRef.current[1] === arr
    ) {
      return;
    }

    setRunways((prev) => {
      const keepDep =
        depValid && lastResolvedRef.current[0] === dep ? prev[0] : null;
      const keepArr =
        arrValid && lastResolvedRef.current[1] === arr ? prev[1] : null;
      return [keepDep, keepArr];
    });

    if (!depValid && !arrValid) {
      lastResolvedRef.current = [dep, arr];
      return;
    }

    const codes = Array.from(
      new Set(
        [depValid ? dep : null, arrValid ? arr : null].filter(
          (c): c is string => c !== null
        )
      )
    );
    const seq = ++seqRef.current;

    const timer = setTimeout(async () => {
      try {
        const response = await getAirportInfo(codes);
        if (seq !== seqRef.current) return;
        const byCode = new Map(
          response.map((a) => [a.icaoId?.toUpperCase(), a])
        );
        const depRunways = depValid ? extractRunways(byCode.get(dep)) : null;
        const arrRunways = arrValid ? extractRunways(byCode.get(arr)) : null;
        lastResolvedRef.current = [dep, arr];
        setRunways([depRunways, arrRunways]);
      } catch (err) {
        if (seq !== seqRef.current) return;
        console.warn("Airport lookup failed:", err);
        lastResolvedRef.current = [dep, arr];
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [dep, arr, depValid, arrValid]);

  return runways;
}
```

### Step 1.4 — Run tests, confirm they pass

- [ ] Run: `npm test -- --testPathPatterns=useAirportRunways`
- [ ] Expected: All 7 tests pass.

### Step 1.5 — Commit

- [ ] Run:
  ```bash
  git add src/utils/useAirportRunways.ts src/utils/useAirportRunways.test.ts
  git commit -m "feat: add useAirportRunways hook for ambient airport lookup

  Hook watches the airport tuple, debounces (400ms), validates ICAO codes,
  dedupes when dep === arr, discards stale responses, and silently logs
  failures. Will be wired into AppContainer in a follow-up to fix #121."
  ```

---

## Task 2: Wire `useAirportRunways` into `AppContainer`

**Files:**
- Modify: `src/components/AppContainer.tsx`
- Verify: `src/components/AppContainer.test.tsx` (no changes expected — the existing tests don't assert the runway wiring)

### Step 2.1 — Read current `AppContainer.tsx`

- [ ] Confirm lines 1-30, 87-97, 125-143, and 178-195 match what's described in the spec before editing.

### Step 2.2 — Replace imports and state wiring

- [ ] In `src/components/AppContainer.tsx`, change the import on line 16 from:
  ```ts
  import type { AirportRunwayInfo, RunwayOption, WorksheetData } from "@/utils/types";
  ```
  to:
  ```ts
  import type { WorksheetData } from "@/utils/types";
  ```

- [ ] Add a new import right after `import { useUrlState } from "@/utils/useUrlState";`:
  ```ts
  import { useAirportRunways } from "@/utils/useAirportRunways";
  ```

- [ ] Replace the block from line ~91 (the `useState` for `airportRunways`) through the end of `handleAirportInfoUpdate` (around line 97):

  Before:
  ```ts
  const [airportRunways, setAirportRunways] = useState<
    [RunwayOption[] | null, RunwayOption[] | null]
  >([null, null]);

  const handleAirportInfoUpdate = (info: AirportRunwayInfo) => {
    setAirportRunways([info.departure, info.arrival]);
  };
  ```

  After:
  ```ts
  const airportRunways = useAirportRunways(state.airport);
  ```

- [ ] In `handleUpdate` (around line 125-143), remove the leading `if (updates.airport !== undefined && ...) { setAirportRunways([null, null]); }` block. The hook owns the clear-on-change behavior now. The trailing `setState(...)` call stays.

  After the edit, `handleUpdate` should read:
  ```ts
  const handleUpdate = (updates: Partial<WorksheetData>) => {
    setState((prev: WorksheetData) => {
      const merged = { ...prev, ...updates } as WorksheetData;
      return merged;
    });
  };
  ```

- [ ] In the JSX (around line 178-195), remove the `onAirportInfoUpdate={handleAirportInfoUpdate}` prop from `<WeatherDataIntegration ... />`.

### Step 2.3 — Confirm `useState` import is still needed

- [ ] Check the top of the file. The `useState` import on line 3 is still used by `weatherLastUpdated` and `overlay`. Leave it. The `RunwayOption` named import was removed in 2.2.

### Step 2.4 — Run AppContainer tests

- [ ] Run: `npm test -- --testPathPatterns=AppContainer`
- [ ] Expected: All existing tests pass. (The current tests don't assert on `airportRunways`; they verify rendering and slide-over wiring.)

### Step 2.5 — Run full test suite (lint check coming in Task 4)

- [ ] Run: `npm test`
- [ ] Expected: Hook tests pass. `WeatherDataIntegration.test.tsx` will still have the `onAirportInfoUpdate callback` describe block — those tests should still pass for now because Task 3 hasn't removed the callback yet. (If those tests fail because TypeScript complains about the prop type in `defaultProps`, proceed to Task 3 immediately.)

### Step 2.6 — Commit

- [ ] Run:
  ```bash
  git add src/components/AppContainer.tsx
  git commit -m "refactor: drive AirportCard runways from useAirportRunways

  AppContainer no longer wires runways through WeatherDataIntegration's
  onAirportInfoUpdate side-effect. The hook fires on mount when airports
  come from the URL, and on every airport-code edit, fixing #121."
  ```

---

## Task 3: Remove `onAirportInfoUpdate` from `WeatherDataIntegration`

**Files:**
- Modify: `src/components/WeatherDataIntegration.tsx`
- Modify: `src/components/WeatherDataIntegration.test.tsx`
- Modify: `src/utils/types.ts`

### Step 3.1 — Remove the prop and helper from `WeatherDataIntegration.tsx`

- [ ] Change the import on line 32 from:
  ```ts
  import type { AirportRunwayInfo, RunwayOption, WorksheetData } from "@/utils/types";
  ```
  to:
  ```ts
  import type { WorksheetData } from "@/utils/types";
  ```

- [ ] Delete the `extractRunways` function (lines ~62-79):
  ```ts
  function extractRunways(
    airport:
      | {
          runway?: Array<{
            id: string;
            length: number;
            alignment: number | null;
          }>;
        }
      | undefined
  ): RunwayOption[] | null {
    if (!airport?.runway || airport.runway.length === 0) return null;
    return airport.runway.map((r) => ({
      id: r.id,
      length: r.length,
      alignment: r.alignment,
    }));
  }
  ```

- [ ] In the `WeatherDataIntegrationProps` interface, remove the `onAirportInfoUpdate?: (info: AirportRunwayInfo) => void;` line.

- [ ] In the function signature destructure, remove `onAirportInfoUpdate,` from the parameter list.

- [ ] Inside `fetchWeatherData`, delete the block (currently around lines 172-177):
  ```ts
  if (onAirportInfoUpdate) {
    onAirportInfoUpdate({
      departure: extractRunways(depAirport),
      arrival: extractRunways(arrAirport),
    });
  }
  ```

- [ ] Remove `onAirportInfoUpdate` from the `useCallback` dependency array at the end of `fetchWeatherData` (around line 354).

### Step 3.2 — Remove tests for the deleted callback

- [ ] In `src/components/WeatherDataIntegration.test.tsx`, delete the entire `describe("onAirportInfoUpdate callback", () => { ... });` block (lines ~232-336).

### Step 3.3 — Remove the unused `AirportRunwayInfo` type

- [ ] In `src/utils/types.ts`, delete the comment block and the `AirportRunwayInfo` interface (lines ~207-215):
  ```ts
  /**
   * Per-airport runway info handed up by WeatherDataIntegration's
   * onAirportInfoUpdate callback. Stored in AppContainer state so the
   * AirportCard runway dropdowns can render their options.
   */
  export interface AirportRunwayInfo {
    departure: RunwayOption[] | null;
    arrival: RunwayOption[] | null;
  }
  ```
  Keep `RunwayOption` — it's still used by `useAirportRunways`, `WeatherSection`, and `AirportCard`.

### Step 3.4 — Run targeted tests

- [ ] Run: `npm test -- --testPathPatterns="WeatherDataIntegration|AppContainer|useAirportRunways"`
- [ ] Expected: All tests pass. `WeatherDataIntegration` tests no longer contain the `onAirportInfoUpdate callback` cases.

### Step 3.5 — Commit

- [ ] Run:
  ```bash
  git add src/components/WeatherDataIntegration.tsx src/components/WeatherDataIntegration.test.tsx src/utils/types.ts
  git commit -m "refactor: remove onAirportInfoUpdate from WeatherDataIntegration

  Runway dropdown options now flow through useAirportRunways, so the
  weather fetch no longer needs a runway side-effect or its supporting
  AirportRunwayInfo type. Closes #121."
  ```

---

## Task 4: Final verification

**Files:** none — verification only.

### Step 4.1 — Full test suite

- [ ] Run: `npm test`
- [ ] Expected: 0 failures across the suite.

### Step 4.2 — Lint

- [ ] Run: `npm run lint`
- [ ] Expected: clean.

### Step 4.3 — Type check via build

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: clean. (If you prefer the Next build, `npm run build` also type-checks but is slower.)

### Step 4.4 — Manual smoke test in a browser

- [ ] Run: `npm run dev`
- [ ] In a browser, open `http://localhost:3000/?airport=%5B%22KDEN%22%2C%22KSLC%22%5D` (URL-encoded `["KDEN","KSLC"]`).
- [ ] Within ~1 second, the runway dropdowns in both AirportCards should populate without clicking "Fetch Weather."
- [ ] Change one airport code to a different valid ICAO (e.g., `KASE`) and confirm:
  - That slot's dropdown clears immediately.
  - After ~400ms it re-populates with the new airport's runways.
  - The other slot's dropdown is unchanged throughout.
- [ ] Type an invalid code (e.g., `K`) — confirm no flicker / no network request fires (check the Network tab for calls to `/api/aviation-weather?...service=airport`).
- [ ] Stop the dev server.

### Step 4.5 — No commit needed (verification only)

If the smoke test surfaces a regression, fix it and add a regression test before moving on. Otherwise the branch is ready for PR.

---

## Self-Review Notes

- **Spec coverage:** Each spec section is mapped: hook → Task 1; AppContainer changes → Task 2; WeatherDataIntegration changes + type cleanup → Task 3; test files mentioned in the spec → Steps 1.1, 3.2; manual smoke test (mount with URL airports, edit one airport, invalid code) → Step 4.4.
- **Placeholder scan:** No TBD / TODO / "implement appropriate error handling" patterns. All code blocks are concrete.
- **Type consistency:** `useAirportRunways(airports: [string, string]): [RunwayOption[] | null, RunwayOption[] | null]` matches its single call site in `AppContainer`. The internal `RunwaysTuple` alias is used consistently. `extractRunways` and `getAirportInfo` types match their callers.
