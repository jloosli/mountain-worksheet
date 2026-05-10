# Position Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ForeFlight-style position parsing to the "Area of Operations" field in the sortie form, supporting eight input formats (decimal, DMS, DDM with letter or minus polarity, plus airport ID/radial/distance and VOR ID/radial/distance), resolving them to canonical decimal-degree coordinates.

**Architecture:** A pure synchronous parser yields a discriminated union per input. Coordinate kinds resolve immediately; radial-distance kinds trigger an aviationweather.gov lookup, then run a spherical-geodesic destination calculation with magnetic variation applied via the `geomagnetism` npm package (World Magnetic Model). A new `PositionInput` component encapsulates the input/lookup state machine and replaces the inline `<input id="route">` in `SortieInfo`. URL state caches the resolved `[lat, lon]` so reloaded URLs do not re-fetch.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Jest + React Testing Library, `qs` for URL state, `geomagnetism` npm package (new dependency).

**Spec:** `docs/superpowers/specs/2026-05-09-position-intelligence-design.md`

---

## File Structure

**New files:**
- `src/utils/positionParser.ts` — pure parser, all 8 formats, returns discriminated union
- `src/utils/positionMath.ts` — spherical geodesic destination calculation
- `src/utils/magvar.ts` — wrapper around `geomagnetism`
- `src/utils/__tests__/positionParser.test.ts`
- `src/utils/__tests__/positionMath.test.ts`
- `src/utils/__tests__/magvar.test.ts`
- `src/components/PositionInput.tsx`
- `src/components/PositionInput.test.tsx`

**Modified:**
- `src/utils/types.ts` — add `position` to `WorksheetData`
- `src/utils/aviationWeatherApi.ts` — add `getNavaidInfo` and `NavaidResponse`
- `src/utils/__tests__/aviationWeatherApi.test.ts` — coverage for `getNavaidInfo`
- `src/components/SortieInfo.tsx` — replace inline route input; thread `position` through state
- `src/components/SortieInfo.test.tsx` — coverage for position wiring
- `src/components/AppContainer.tsx` — initial state for `position`
- `src/utils/__tests__/urlState.test.ts` — coverage for `position` field round-trip
- `package.json` — add `geomagnetism` dependency

**Implementation note on the `position` type:** the spec describes `position: [number, number] | null`. The existing URL state machinery in `urlState.ts` distinguishes value types via array hints in initialState. The simplest representation that fits is `position: [number | null, number | null]` with the convention that `[null, null]` means "not set" — analogous to how `temp`, `altimeter`, and `altitude` already use null-bearing tuples in `WorksheetData`. The user-facing semantics are unchanged. The plan uses this representation.

---

## Task 1: Add `position` field to `WorksheetData` type and `AppContainer` initial state

**Files:**
- Modify: `src/utils/types.ts`
- Modify: `src/components/AppContainer.tsx`
- Test: `src/utils/__tests__/urlState.test.ts`

- [ ] **Step 1: Write failing URL-state round-trip test for `position`**

Append to `src/utils/__tests__/urlState.test.ts` (inside the existing `describe("serializeState/deserializeState round trip")` block — find an analogous existing block and add this `it`):

```ts
it("should round-trip position field as length-2 number array", () => {
  const initial = {
    route: "",
    position: [null, null] as [number | null, number | null],
  };
  const state = {
    ...initial,
    route: "KOGD/285/34",
    position: [41.4321, -112.7042] as [number | null, number | null],
  };
  const serialized = serializeState(state);
  const deserialized = deserializeState(serialized, initial);
  expect(deserialized.position).toEqual([41.4321, -112.7042]);
  expect(deserialized.route).toBe("KOGD/285/34");
});

it("should omit position field from URL when both values are null", () => {
  const initial = {
    route: "",
    position: [null, null] as [number | null, number | null],
  };
  const state = { ...initial, position: [null, null] as [number | null, number | null] };
  const serialized = serializeState(state);
  expect(serialized).not.toContain("position");
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest src/utils/__tests__/urlState.test.ts -t "position field"`
Expected: FAIL — `position` not in initial state, or value not preserved.

- [ ] **Step 3: Add `position` to `WorksheetData`**

Edit `src/utils/types.ts`. Find the `WorksheetData` interface (lines 4-33) and add `position` after the `route` field:

```ts
  route: string; // Area of Operations/Route
  position: [number | null, number | null]; // [lat, lon] in DD.dddd; [null, null] when unset
```

- [ ] **Step 4: Add `position` to `AppContainer` initial state**

Edit `src/components/AppContainer.tsx`. Find the `useUrlState` initial-state object (line 35-76) and add a `position` field after `route`:

```ts
    route: "",
    position: [null, null] as [number | null, number | null],
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx jest src/utils/__tests__/urlState.test.ts -t "position field"`
Expected: PASS — both tests green.

- [ ] **Step 6: Run full type check + lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean — `position` propagates through `WorksheetData`-typed code without type errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/types.ts src/components/AppContainer.tsx src/utils/__tests__/urlState.test.ts
git commit -m "Add position field to WorksheetData

Adds [lat, lon] tuple alongside the free-text route field. URL state
treats [null, null] as unset and omits the field from query strings."
```

---

## Task 2: Add `geomagnetism` dependency

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `package-lock.json`

- [ ] **Step 1: Install the package**

Run: `npm install geomagnetism`

- [ ] **Step 2: Verify it's in `dependencies`**

Run: `grep geomagnetism package.json`
Expected: line shows `"geomagnetism": "^...",` under dependencies.

- [ ] **Step 3: Smoke-check the API surface**

Run: `node -e "const g = require('geomagnetism'); console.log(g.model().point([40, -111]).decl);"`
Expected: a number (typically positive ~10-12 for Utah). If the API differs (e.g., `model.point()` is named differently in the installed version), note the actual surface in a comment for Task 9.

- [ ] **Step 4: Run existing tests to confirm no regression**

Run: `npm test -- --silent`
Expected: all existing tests pass; no missing-module errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add geomagnetism dependency for WMM magnetic variation"
```

---

## Task 3: Position parser — decimal formats (kinds 1, 2, plus comma separator)

**Files:**
- Create: `src/utils/positionParser.ts`
- Test: `src/utils/__tests__/positionParser.test.ts`

- [ ] **Step 1: Write failing tests for decimal parsing**

Create `src/utils/__tests__/positionParser.test.ts`:

```ts
import { parsePosition } from "../positionParser";

describe("parsePosition - decimal formats", () => {
  it("parses DD.dd with N/W letters", () => {
    const result = parsePosition("36.01N/75.50W");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(36.01);
      expect(result.lon).toBe(-75.5);
    }
  });

  it("parses DD.dd with S/E letters", () => {
    const result = parsePosition("36.01S/75.50E");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(-36.01);
      expect(result.lon).toBe(75.5);
    }
  });

  it("parses DD.dd with minus signs", () => {
    const result = parsePosition("36.01/-75.50");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(36.01);
      expect(result.lon).toBe(-75.5);
    }
  });

  it("accepts comma + space separator for decimal-with-minus", () => {
    const result = parsePosition("41.4321, -112.7042");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(41.4321);
      expect(result.lon).toBe(-112.7042);
    }
  });

  it("rounds to 4 decimal places", () => {
    const result = parsePosition("36.123456N/75.987654W");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(36.1235);
      expect(result.lon).toBe(-75.9877);
    }
  });

  it("rejects out-of-range latitude", () => {
    const result = parsePosition("91.00N/75.50W");
    expect(result.kind).toBe("unrecognized");
  });

  it("rejects out-of-range longitude", () => {
    const result = parsePosition("36.01N/181.00W");
    expect(result.kind).toBe("unrecognized");
  });

  it("preserves raw input on success", () => {
    const result = parsePosition("36.01N/75.50W");
    expect(result.raw).toBe("36.01N/75.50W");
  });

  it("preserves raw input on unrecognized", () => {
    const result = parsePosition("Cache Valley");
    expect(result.kind).toBe("unrecognized");
    expect(result.raw).toBe("Cache Valley");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx jest src/utils/__tests__/positionParser.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement minimal parser for decimal kinds**

Create `src/utils/positionParser.ts`:

```ts
export type ParsedPosition =
  | { kind: "decimal";      raw: string; lat: number; lon: number }
  | { kind: "dms";          raw: string; lat: number; lon: number }
  | { kind: "ddm";          raw: string; lat: number; lon: number }
  | { kind: "airport-rd";   raw: string; stationId: string; radial: number; distanceNm: number }
  | { kind: "vor-rd";       raw: string; stationId: string; radial: number; distanceNm: number }
  | { kind: "unrecognized"; raw: string };

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

const inRange = (lat: number, lon: number): boolean =>
  lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

const tryDecimalLetters = (s: string): { lat: number; lon: number } | null => {
  const m = s.match(/^([\d.]+)([NS])\/([\d.]+)([EW])$/);
  if (!m) return null;
  const lat = Number(m[1]) * (m[2] === "S" ? -1 : 1);
  const lon = Number(m[3]) * (m[4] === "W" ? -1 : 1);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

const tryDecimalMinus = (s: string): { lat: number; lon: number } | null => {
  // Accept either `/` or `,` (with optional whitespace) as separator
  const m = s.match(/^(-?[\d.]+)\s*[/,]\s*(-?[\d.]+)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

export function parsePosition(input: string): ParsedPosition {
  const raw = input;
  const s = input.trim().toUpperCase();
  if (s === "") return { kind: "unrecognized", raw };

  const letters = tryDecimalLetters(s);
  if (letters) return { kind: "decimal", raw, ...letters };

  const minus = tryDecimalMinus(s);
  if (minus) return { kind: "decimal", raw, ...minus };

  return { kind: "unrecognized", raw };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx jest src/utils/__tests__/positionParser.test.ts`
Expected: PASS — all decimal-format tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/positionParser.ts src/utils/__tests__/positionParser.test.ts
git commit -m "Add position parser for decimal-degree formats

Supports DD.dd with N/S/E/W letters, DD.dd with minus signs, and
comma-separated decimal pairs. Out-of-range values fall through
to unrecognized."
```

---

## Task 4: Position parser — DDM (degree-decimal-minutes) formats (kinds 5, 6)

**Files:**
- Modify: `src/utils/positionParser.ts`
- Modify: `src/utils/__tests__/positionParser.test.ts`

- [ ] **Step 1: Write failing tests for DDM**

Append to `src/utils/__tests__/positionParser.test.ts`:

```ts
describe("parsePosition - DDM (degree-decimal-minutes)", () => {
  it("parses DDM with letters", () => {
    const result = parsePosition("3600.86N/07530.07W");
    expect(result.kind).toBe("ddm");
    if (result.kind === "ddm") {
      // 36 + 0.86/60 = 36.0143...
      expect(result.lat).toBe(36.0143);
      // 75 + 30.07/60 = 75.5012... (negated)
      expect(result.lon).toBe(-75.5012);
    }
  });

  it("parses DDM with minus", () => {
    const result = parsePosition("3600.86/-07530.07");
    expect(result.kind).toBe("ddm");
    if (result.kind === "ddm") {
      expect(result.lat).toBe(36.0143);
      expect(result.lon).toBe(-75.5012);
    }
  });

  it("rejects DDM with minutes >= 60", () => {
    const result = parsePosition("3660.00N/07530.07W");
    expect(result.kind).toBe("unrecognized");
  });

  it("rejects DDM with degrees out of range", () => {
    const result = parsePosition("9100.00N/07530.07W");
    expect(result.kind).toBe("unrecognized");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx jest src/utils/__tests__/positionParser.test.ts -t "DDM"`
Expected: FAIL — DDM format falls through to `unrecognized`.

- [ ] **Step 3: Add DDM parser helpers and wire into `parsePosition`**

Edit `src/utils/positionParser.ts`. Add helpers above `parsePosition`:

```ts
const ddmFromParts = (degStr: string, minStr: string): number | null => {
  const deg = Number(degStr);
  const min = Number(minStr);
  if (!Number.isFinite(deg) || !Number.isFinite(min)) return null;
  if (min < 0 || min >= 60) return null;
  return deg + min / 60;
};

const tryDdmLetters = (s: string): { lat: number; lon: number } | null => {
  // \d{2}\d{2}\.\d+ for lat (DDMM.mm), \d{3}\d{2}\.\d+ for lon (DDDMM.mm)
  const m = s.match(/^(\d{2})(\d{2}\.\d+)([NS])\/(\d{3})(\d{2}\.\d+)([EW])$/);
  if (!m) return null;
  const latVal = ddmFromParts(m[1], m[2]);
  const lonVal = ddmFromParts(m[4], m[5]);
  if (latVal === null || lonVal === null) return null;
  const lat = latVal * (m[3] === "S" ? -1 : 1);
  const lon = lonVal * (m[6] === "W" ? -1 : 1);
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

const tryDdmMinus = (s: string): { lat: number; lon: number } | null => {
  const m = s.match(/^(\d{2})(\d{2}\.\d+)\/(-?)(\d{3})(\d{2}\.\d+)$/);
  if (!m) return null;
  const latVal = ddmFromParts(m[1], m[2]);
  const lonVal = ddmFromParts(m[4], m[5]);
  if (latVal === null || lonVal === null) return null;
  const lat = latVal;
  const lon = lonVal * (m[3] === "-" ? -1 : 1);
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};
```

Update `parsePosition` to try DDM before decimal (since DDM with letters has its own shape, but decimal-with-letters could match parts of it; ordering ensures specificity):

```ts
export function parsePosition(input: string): ParsedPosition {
  const raw = input;
  const s = input.trim().toUpperCase();
  if (s === "") return { kind: "unrecognized", raw };

  const ddmL = tryDdmLetters(s);
  if (ddmL) return { kind: "ddm", raw, ...ddmL };

  const ddmM = tryDdmMinus(s);
  if (ddmM) return { kind: "ddm", raw, ...ddmM };

  const decL = tryDecimalLetters(s);
  if (decL) return { kind: "decimal", raw, ...decL };

  const decM = tryDecimalMinus(s);
  if (decM) return { kind: "decimal", raw, ...decM };

  return { kind: "unrecognized", raw };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx jest src/utils/__tests__/positionParser.test.ts`
Expected: PASS — all decimal AND DDM tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/positionParser.ts src/utils/__tests__/positionParser.test.ts
git commit -m "Position parser: add DDM (deg-decimal-min) formats"
```

---

## Task 5: Position parser — DMS (degree-minute-second) formats (kinds 3, 4)

**Files:**
- Modify: `src/utils/positionParser.ts`
- Modify: `src/utils/__tests__/positionParser.test.ts`

- [ ] **Step 1: Write failing tests for DMS**

Append to `src/utils/__tests__/positionParser.test.ts`:

```ts
describe("parsePosition - DMS (degree-minute-second)", () => {
  it("parses DMS with letters", () => {
    const result = parsePosition("360051N/0753004W");
    expect(result.kind).toBe("dms");
    if (result.kind === "dms") {
      // 36 + 0/60 + 51/3600 = 36.01416...  → 36.0142
      expect(result.lat).toBe(36.0142);
      // -(75 + 30/60 + 4/3600) = -75.50111... → -75.5011
      expect(result.lon).toBe(-75.5011);
    }
  });

  it("parses DMS with minus", () => {
    const result = parsePosition("360051/-0753004");
    expect(result.kind).toBe("dms");
    if (result.kind === "dms") {
      expect(result.lat).toBe(36.0142);
      expect(result.lon).toBe(-75.5011);
    }
  });

  it("rejects DMS with seconds >= 60", () => {
    const result = parsePosition("360060N/0753004W");
    expect(result.kind).toBe("unrecognized");
  });

  it("rejects DMS with minutes >= 60", () => {
    const result = parsePosition("366000N/0753004W");
    expect(result.kind).toBe("unrecognized");
  });

  it("rejects DMS with latitude > 90", () => {
    const result = parsePosition("910000N/0753004W");
    expect(result.kind).toBe("unrecognized");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx jest src/utils/__tests__/positionParser.test.ts -t "DMS"`
Expected: FAIL.

- [ ] **Step 3: Add DMS parser helpers and wire into `parsePosition` ordering**

Edit `src/utils/positionParser.ts`. Add helpers above `parsePosition`:

```ts
const dmsFromParts = (degStr: string, minStr: string, secStr: string): number | null => {
  const deg = Number(degStr);
  const min = Number(minStr);
  const sec = Number(secStr);
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  if (min < 0 || min >= 60) return null;
  if (sec < 0 || sec >= 60) return null;
  return deg + min / 60 + sec / 3600;
};

const tryDmsLetters = (s: string): { lat: number; lon: number } | null => {
  // DDMMSS for lat (6 digits), DDDMMSS for lon (7 digits)
  const m = s.match(/^(\d{2})(\d{2})(\d{2})([NS])\/(\d{3})(\d{2})(\d{2})([EW])$/);
  if (!m) return null;
  const latVal = dmsFromParts(m[1], m[2], m[3]);
  const lonVal = dmsFromParts(m[5], m[6], m[7]);
  if (latVal === null || lonVal === null) return null;
  const lat = latVal * (m[4] === "S" ? -1 : 1);
  const lon = lonVal * (m[8] === "W" ? -1 : 1);
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

const tryDmsMinus = (s: string): { lat: number; lon: number } | null => {
  const m = s.match(/^(\d{2})(\d{2})(\d{2})\/(-?)(\d{3})(\d{2})(\d{2})$/);
  if (!m) return null;
  const latVal = dmsFromParts(m[1], m[2], m[3]);
  const lonVal = dmsFromParts(m[5], m[6], m[7]);
  if (latVal === null || lonVal === null) return null;
  const lat = latVal;
  const lon = lonVal * (m[4] === "-" ? -1 : 1);
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};
```

Update `parsePosition` ordering — DMS before DDM (DMS is more specific because it has no `.` in the lat/lon body). Order from most specific to least:

```ts
export function parsePosition(input: string): ParsedPosition {
  const raw = input;
  const s = input.trim().toUpperCase();
  if (s === "") return { kind: "unrecognized", raw };

  const dmsL = tryDmsLetters(s);
  if (dmsL) return { kind: "dms", raw, ...dmsL };

  const dmsM = tryDmsMinus(s);
  if (dmsM) return { kind: "dms", raw, ...dmsM };

  const ddmL = tryDdmLetters(s);
  if (ddmL) return { kind: "ddm", raw, ...ddmL };

  const ddmM = tryDdmMinus(s);
  if (ddmM) return { kind: "ddm", raw, ...ddmM };

  const decL = tryDecimalLetters(s);
  if (decL) return { kind: "decimal", raw, ...decL };

  const decM = tryDecimalMinus(s);
  if (decM) return { kind: "decimal", raw, ...decM };

  return { kind: "unrecognized", raw };
}
```

- [ ] **Step 4: Run all parser tests**

Run: `npx jest src/utils/__tests__/positionParser.test.ts`
Expected: PASS — decimal, DDM, DMS all green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/positionParser.ts src/utils/__tests__/positionParser.test.ts
git commit -m "Position parser: add DMS (deg-min-sec) formats"
```

---

## Task 6: Position parser — radial-distance kinds (Airport, VOR)

**Files:**
- Modify: `src/utils/positionParser.ts`
- Modify: `src/utils/__tests__/positionParser.test.ts`

- [ ] **Step 1: Write failing tests for radial-distance**

Append to `src/utils/__tests__/positionParser.test.ts`:

```ts
describe("parsePosition - radial-distance", () => {
  it("parses 4-letter ID as airport-rd", () => {
    const result = parsePosition("KOGD/285/34");
    expect(result.kind).toBe("airport-rd");
    if (result.kind === "airport-rd") {
      expect(result.stationId).toBe("KOGD");
      expect(result.radial).toBe(285);
      expect(result.distanceNm).toBe(34);
    }
  });

  it("parses 3-letter ID as vor-rd", () => {
    const result = parsePosition("OGD/285/34");
    expect(result.kind).toBe("vor-rd");
    if (result.kind === "vor-rd") {
      expect(result.stationId).toBe("OGD");
      expect(result.radial).toBe(285);
      expect(result.distanceNm).toBe(34);
    }
  });

  it("uppercases lowercase station id", () => {
    const result = parsePosition("kogd/285/34");
    expect(result.kind).toBe("airport-rd");
    if (result.kind === "airport-rd") {
      expect(result.stationId).toBe("KOGD");
    }
  });

  it("accepts decimal distance", () => {
    const result = parsePosition("KOGD/285/34.5");
    expect(result.kind).toBe("airport-rd");
    if (result.kind === "airport-rd") {
      expect(result.distanceNm).toBe(34.5);
    }
  });

  it("rejects radial of fewer than 3 digits", () => {
    const result = parsePosition("KOGD/85/34");
    expect(result.kind).toBe("unrecognized");
  });

  it("rejects radial > 360", () => {
    const result = parsePosition("KOGD/400/34");
    expect(result.kind).toBe("unrecognized");
  });

  it("rejects distance > 500 nm", () => {
    const result = parsePosition("KOGD/285/600");
    expect(result.kind).toBe("unrecognized");
  });

  it("rejects negative distance", () => {
    const result = parsePosition("KOGD/285/-5");
    expect(result.kind).toBe("unrecognized");
  });

  it("accepts zero distance", () => {
    const result = parsePosition("KOGD/285/0");
    expect(result.kind).toBe("airport-rd");
    if (result.kind === "airport-rd") {
      expect(result.distanceNm).toBe(0);
    }
  });

  it("ignores 5-letter station id", () => {
    const result = parsePosition("ABCDE/285/34");
    expect(result.kind).toBe("unrecognized");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx jest src/utils/__tests__/positionParser.test.ts -t "radial-distance"`
Expected: FAIL — falls through to unrecognized.

- [ ] **Step 3: Add radial-distance parser**

Edit `src/utils/positionParser.ts`. Add helper above `parsePosition`:

```ts
const tryRadialDistance = (
  s: string
): { kind: "airport-rd" | "vor-rd"; stationId: string; radial: number; distanceNm: number } | null => {
  // Letters 3 or 4, slash, exactly 3-digit radial, slash, distance (int or decimal)
  const m = s.match(/^([A-Z]{3,4})\/(\d{3})\/(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const stationId = m[1];
  const radial = Number(m[2]);
  const distanceNm = Number(m[3]);
  if (radial < 0 || radial > 360) return null;
  if (distanceNm < 0 || distanceNm > 500) return null;
  const kind = stationId.length === 4 ? "airport-rd" : "vor-rd";
  return { kind, stationId, radial, distanceNm };
};
```

Update `parsePosition` to try radial-distance first (most specific shape — three slash-delimited tokens with letters first):

```ts
export function parsePosition(input: string): ParsedPosition {
  const raw = input;
  const s = input.trim().toUpperCase();
  if (s === "") return { kind: "unrecognized", raw };

  const rd = tryRadialDistance(s);
  if (rd) return { ...rd, raw };

  const dmsL = tryDmsLetters(s);
  if (dmsL) return { kind: "dms", raw, ...dmsL };

  const dmsM = tryDmsMinus(s);
  if (dmsM) return { kind: "dms", raw, ...dmsM };

  const ddmL = tryDdmLetters(s);
  if (ddmL) return { kind: "ddm", raw, ...ddmL };

  const ddmM = tryDdmMinus(s);
  if (ddmM) return { kind: "ddm", raw, ...ddmM };

  const decL = tryDecimalLetters(s);
  if (decL) return { kind: "decimal", raw, ...decL };

  const decM = tryDecimalMinus(s);
  if (decM) return { kind: "decimal", raw, ...decM };

  return { kind: "unrecognized", raw };
}
```

- [ ] **Step 4: Run all parser tests**

Run: `npx jest src/utils/__tests__/positionParser.test.ts`
Expected: PASS — every parser test green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/positionParser.ts src/utils/__tests__/positionParser.test.ts
git commit -m "Position parser: add airport/VOR radial-distance kinds

Discriminates by station ID length: 4 chars -> airport-rd, 3 chars -> vor-rd."
```

---

## Task 7: Geodesic destination math

**Files:**
- Create: `src/utils/positionMath.ts`
- Test: `src/utils/__tests__/positionMath.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/__tests__/positionMath.test.ts`:

```ts
import { geodesicDestination } from "../positionMath";

describe("geodesicDestination", () => {
  it("travels east 60nm from (0, 0) ≈ (0, 1°)", () => {
    const { lat, lon } = geodesicDestination(0, 0, 90, 60);
    expect(lat).toBeCloseTo(0, 4);
    expect(lon).toBeCloseTo(1.0, 2);
  });

  it("travels north 60nm from (0, 0) ≈ (1°, 0)", () => {
    const { lat, lon } = geodesicDestination(0, 0, 0, 60);
    expect(lat).toBeCloseTo(1.0, 2);
    expect(lon).toBeCloseTo(0, 4);
  });

  it("zero distance returns starting point", () => {
    const { lat, lon } = geodesicDestination(41.5, -112.5, 285, 0);
    expect(lat).toBeCloseTo(41.5, 6);
    expect(lon).toBeCloseTo(-112.5, 6);
  });

  it("normalizes longitude across antimeridian", () => {
    // From near +180, traveling east, lon should wrap to negative.
    const { lon } = geodesicDestination(0, 179, 90, 120);
    expect(lon).toBeLessThan(0);
    expect(lon).toBeGreaterThan(-180);
  });

  it("KOGD-like reference: (41.20, -112.01) + true bearing 297° + 34nm", () => {
    // Hand-computed reference point — within 0.05° tolerance.
    const { lat, lon } = geodesicDestination(41.2, -112.01, 297, 34);
    expect(lat).toBeCloseTo(41.46, 1);
    expect(lon).toBeCloseTo(-112.69, 1);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx jest src/utils/__tests__/positionMath.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement geodesic destination**

Create `src/utils/positionMath.ts`:

```ts
const EARTH_RADIUS_NM = 3440.065;
const toRad = (d: number): number => (d * Math.PI) / 180;
const toDeg = (r: number): number => (r * 180) / Math.PI;

/**
 * Spherical-earth direct geodesic.
 * Given a start lat/lon, a TRUE bearing (degrees, clockwise from north),
 * and a distance in nautical miles, returns the destination lat/lon.
 */
export function geodesicDestination(
  startLat: number,
  startLon: number,
  trueBearingDeg: number,
  distanceNm: number
): { lat: number; lon: number } {
  const angularDistance = distanceNm / EARTH_RADIUS_NM;
  const lat1 = toRad(startLat);
  const lon1 = toRad(startLon);
  const brng = toRad(trueBearingDeg);

  const sinLat2 =
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(brng);
  const lat2 = Math.asin(sinLat2);

  const y = Math.sin(brng) * Math.sin(angularDistance) * Math.cos(lat1);
  const x = Math.cos(angularDistance) - Math.sin(lat1) * sinLat2;
  const lon2 = lon1 + Math.atan2(y, x);

  // Normalize longitude to [-180, 180]
  const lon2Norm = ((toDeg(lon2) + 540) % 360) - 180;

  return { lat: toDeg(lat2), lon: lon2Norm };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx jest src/utils/__tests__/positionMath.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/positionMath.ts src/utils/__tests__/positionMath.test.ts
git commit -m "Add spherical geodesic destination math

Pure function: start lat/lon + true bearing + distance (nm) -> destination.
Earth radius 3440.065 nm. Longitude normalized to [-180, 180]."
```

---

## Task 8: Magnetic variation wrapper (`magvar.ts`)

**Files:**
- Create: `src/utils/magvar.ts`
- Test: `src/utils/__tests__/magvar.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/__tests__/magvar.test.ts`:

```ts
import { magneticVariation } from "../magvar";

describe("magneticVariation", () => {
  it("returns positive (east) declination in northern Utah", () => {
    // Northern Utah magvar is positive ~10-11° east in current epoch.
    const decl = magneticVariation(41.2, -112.0);
    expect(decl).toBeGreaterThan(5);
    expect(decl).toBeLessThan(15);
  });

  it("returns near-zero declination near agonic line (eastern US)", () => {
    // Agonic line passes near 0°W on the eastern seaboard in current epoch.
    const decl = magneticVariation(35, -83);
    expect(Math.abs(decl)).toBeLessThan(8);
  });

  it("accepts an optional date parameter", () => {
    const declNow = magneticVariation(40, -111, new Date());
    expect(typeof declNow).toBe("number");
    expect(Number.isFinite(declNow)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx jest src/utils/__tests__/magvar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement wrapper**

Create `src/utils/magvar.ts`:

```ts
import geomagnetism from "geomagnetism";

/**
 * Magnetic variation (declination) at a point.
 * Returns east-positive degrees: trueBearing = magneticBearing + variation.
 *
 * Uses the World Magnetic Model via the `geomagnetism` package.
 */
export function magneticVariation(
  lat: number,
  lon: number,
  date: Date = new Date()
): number {
  const model = geomagnetism.model(date);
  const point = model.point([lat, lon]);
  return point.decl;
}
```

If the smoke check in Task 2 Step 3 revealed a different API surface (e.g., `geomagnetism.model().point({lat, lon})` rather than an array), adapt this call to match.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx jest src/utils/__tests__/magvar.test.ts`
Expected: PASS — northern Utah declination in 5-15° range.

- [ ] **Step 5: Commit**

```bash
git add src/utils/magvar.ts src/utils/__tests__/magvar.test.ts
git commit -m "Add magnetic variation wrapper around WMM

Uses geomagnetism package; returns east-positive declination."
```

---

## Task 9: Add `getNavaidInfo` to aviation weather API

**Files:**
- Modify: `src/utils/aviationWeatherApi.ts`
- Modify: `src/utils/__tests__/aviationWeatherApi.test.ts`

- [ ] **Step 1: Inspect existing test patterns**

Run: `head -80 src/utils/__tests__/aviationWeatherApi.test.ts`
Expected: see how `fetch` is mocked and how `getAirportInfo` is tested. Mirror that pattern.

- [ ] **Step 2: Write failing test for `getNavaidInfo`**

Append to `src/utils/__tests__/aviationWeatherApi.test.ts` (inside the top-level `describe`, mirroring the `getAirportInfo` block):

```ts
describe("getNavaidInfo", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it("calls the navaid endpoint with comma-joined ids", async () => {
    const mockData = [{ id: "OGD", lat: 41.5, lon: -112.76, type: "VOR-DME" }];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { getNavaidInfo } = await import("../aviationWeatherApi");
    const result = await getNavaidInfo(["OGD", "DTA"]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("endpoint=navaid");
    expect(calledUrl).toContain("ids=OGD%2CDTA");
    expect(result).toEqual(mockData);
  });

  it("propagates 404 as APIError", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "Not Found",
    });

    const { getNavaidInfo, APIError } = await import("../aviationWeatherApi");
    await expect(getNavaidInfo(["XXX"])).rejects.toBeInstanceOf(APIError);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx jest src/utils/__tests__/aviationWeatherApi.test.ts -t "getNavaidInfo"`
Expected: FAIL — `getNavaidInfo` undefined.

- [ ] **Step 4: Implement `getNavaidInfo` and `NavaidResponse`**

Edit `src/utils/aviationWeatherApi.ts`. After the `RunwayInfo` interface (around line 99-100), add:

```ts
export interface NavaidResponse {
  id: string;
  name?: string;
  lat: number;
  lon: number;
  type?: string; // e.g., "VOR", "VOR-DME", "VORTAC", "NDB"
  magvar?: number; // station declination, if exposed
}
```

After the `getAirportInfo` function (around line 299), add:

```ts
/**
 * Get navaid (VOR/NDB/etc.) information by ID.
 */
export async function getNavaidInfo(
  ids: string[]
): Promise<NavaidResponse[]> {
  const params = {
    ids: ids.join(","),
    format: "json",
  };

  return makeApiRequest<NavaidResponse[]>("navaid", params);
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx jest src/utils/__tests__/aviationWeatherApi.test.ts`
Expected: PASS — all existing tests still green, new tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/aviationWeatherApi.ts src/utils/__tests__/aviationWeatherApi.test.ts
git commit -m "Add getNavaidInfo for VOR/NDB lookup via aviationweather.gov"
```

---

## Task 10: `PositionInput` component — synchronous paths (empty, sync parse, unrecognized)

**Files:**
- Create: `src/components/PositionInput.tsx`
- Test: `src/components/PositionInput.test.tsx`

- [ ] **Step 1: Write failing tests for synchronous behavior**

Create `src/components/PositionInput.test.tsx`:

```tsx
import { render, screen, fireEvent, act } from "@testing-library/react";
import PositionInput from "./PositionInput";

describe("PositionInput - synchronous paths", () => {
  it("renders empty input with no hint when value is empty", () => {
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={() => {}} />
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
  });

  it("shows parsed coords beneath input on decimal input", async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "36.01N/75.50W" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(onChange).toHaveBeenCalledWith("36.01N/75.50W", [36.01, -75.5]);
    expect(screen.getByText(/36\.0100, -75\.5000/)).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("shows warning for unrecognized input and calls onChange with null position", async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Cache Valley" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(onChange).toHaveBeenCalledWith("Cache Valley", [null, null]);
    expect(screen.getByText(/Unrecognized format/)).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("renders cached position immediately without re-parsing", () => {
    render(
      <PositionInput
        rawValue="KOGD/285/34"
        cachedPosition={[41.4321, -112.7042]}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("textbox")).toHaveValue("KOGD/285/34");
    expect(screen.getByText(/41\.4321, -112\.7042/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx jest src/components/PositionInput.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement minimal `PositionInput` (sync paths only)**

Create `src/components/PositionInput.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { parsePosition } from "@/utils/positionParser";

interface PositionInputProps {
  rawValue: string;
  cachedPosition: [number | null, number | null];
  onChange: (route: string, position: [number | null, number | null]) => void;
}

const formatLatLon = (lat: number, lon: number): string =>
  `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

export default function PositionInput({
  rawValue,
  cachedPosition,
  onChange,
}: PositionInputProps) {
  const [localRaw, setLocalRaw] = useState(rawValue);
  const lastPushed = useRef(rawValue);
  const [hint, setHint] = useState<{ type: "ok" | "warn"; text: string } | null>(
    cachedPosition[0] !== null && cachedPosition[1] !== null
      ? { type: "ok", text: `→ ${formatLatLon(cachedPosition[0]!, cachedPosition[1]!)}` }
      : null
  );

  // Sync incoming prop changes only when external (per AGENTS.md last-pushed pattern)
  useEffect(() => {
    if (rawValue !== lastPushed.current) {
      setLocalRaw(rawValue);
      if (cachedPosition[0] !== null && cachedPosition[1] !== null) {
        setHint({
          type: "ok",
          text: `→ ${formatLatLon(cachedPosition[0]!, cachedPosition[1]!)}`,
        });
      } else if (rawValue === "") {
        setHint(null);
      }
    }
  }, [rawValue, cachedPosition]);

  // Debounced parse on local edits
  useEffect(() => {
    if (localRaw === lastPushed.current) return;

    const handle = setTimeout(() => {
      const parsed = parsePosition(localRaw);
      lastPushed.current = localRaw;

      if (localRaw === "") {
        setHint(null);
        onChange("", [null, null]);
        return;
      }

      if (parsed.kind === "decimal" || parsed.kind === "dms" || parsed.kind === "ddm") {
        setHint({ type: "ok", text: `→ ${formatLatLon(parsed.lat, parsed.lon)}` });
        onChange(localRaw, [parsed.lat, parsed.lon]);
      } else if (parsed.kind === "unrecognized") {
        setHint({
          type: "warn",
          text: "⚠ Unrecognized format — saved as free text",
        });
        onChange(localRaw, [null, null]);
      } else {
        // airport-rd / vor-rd handled in Task 11
        onChange(localRaw, [null, null]);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [localRaw, onChange]);

  return (
    <div className="space-y-2">
      <label htmlFor="route" className="block text-sm font-medium">
        Area of Operations (position)
      </label>
      <input
        type="text"
        id="route"
        name="route"
        value={localRaw}
        onChange={(e) => setLocalRaw(e.target.value.toUpperCase())}
        className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
      />
      {hint && (
        <div
          className={`text-xs ${
            hint.type === "warn"
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          {hint.text}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx jest src/components/PositionInput.test.tsx`
Expected: PASS — sync-path tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/PositionInput.tsx src/components/PositionInput.test.tsx
git commit -m "Add PositionInput component with synchronous parse paths

Handles empty, decimal/DMS/DDM, and unrecognized states. Async
airport/VOR lookup wired in next task."
```

---

## Task 11: `PositionInput` — async lookup paths (airport/VOR + race protection)

**Files:**
- Modify: `src/components/PositionInput.tsx`
- Modify: `src/components/PositionInput.test.tsx`

- [ ] **Step 1: Write failing tests for async paths**

Append to `src/components/PositionInput.test.tsx`:

```tsx
import { getAirportInfo, getNavaidInfo } from "@/utils/aviationWeatherApi";
import { magneticVariation } from "@/utils/magvar";

jest.mock("@/utils/aviationWeatherApi");
jest.mock("@/utils/magvar");

describe("PositionInput - async lookup paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (magneticVariation as jest.Mock).mockReturnValue(12); // east declination
  });

  it("shows loading hint then resolved coords for airport-rd", async () => {
    (getAirportInfo as jest.Mock).mockResolvedValueOnce([
      { icaoId: "KOGD", lat: 41.2, lon: -112.01 },
    ]);
    const onChange = jest.fn();
    jest.useFakeTimers();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "KOGD/285/34" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(screen.getByText(/looking up KOGD/)).toBeInTheDocument();

    jest.useRealTimers();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getAirportInfo).toHaveBeenCalledWith(["KOGD"]);
    expect(onChange).toHaveBeenLastCalledWith(
      "KOGD/285/34",
      expect.arrayContaining([expect.any(Number), expect.any(Number)])
    );
    expect(screen.getByText(/\(KOGD\/285\/34\)/)).toBeInTheDocument();
  });

  it("calls getNavaidInfo for 3-letter station ids", async () => {
    (getNavaidInfo as jest.Mock).mockResolvedValueOnce([
      { id: "OGD", lat: 41.5, lon: -112.76 },
    ]);
    const onChange = jest.fn();
    jest.useFakeTimers();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "OGD/285/34" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    jest.useRealTimers();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getNavaidInfo).toHaveBeenCalledWith(["OGD"]);
  });

  it("shows error hint when lookup fails", async () => {
    (getAirportInfo as jest.Mock).mockRejectedValueOnce(new Error("not found"));
    const onChange = jest.fn();
    jest.useFakeTimers();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "KZZZ/285/34" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    jest.useRealTimers();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Could not find KZZZ/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith("KZZZ/285/34", [null, null]);
  });

  it("ignores stale lookup results when input changes mid-flight (race protection)", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    (getAirportInfo as jest.Mock)
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; })
      )
      .mockResolvedValueOnce([{ icaoId: "KSLC", lat: 40.79, lon: -111.97 }]);

    const onChange = jest.fn();
    jest.useFakeTimers();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "KOGD/285/34" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "KSLC/090/10" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    jest.useRealTimers();
    // Resolve the stale (first) lookup AFTER the second was issued
    resolveFirst([{ icaoId: "KOGD", lat: 41.2, lon: -112.01 }]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Final hint should reference KSLC, not KOGD
    expect(screen.queryByText(/KOGD/)).not.toBeInTheDocument();
    expect(screen.getByText(/KSLC/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx jest src/components/PositionInput.test.tsx -t "async lookup"`
Expected: FAIL — async branches not implemented; assertions about `looking up`/`Could not find` fail.

- [ ] **Step 3: Add async lookup, request-id race protection, and session cache to `PositionInput`**

Edit `src/components/PositionInput.tsx`. Replace the entire effect block that handles `localRaw` changes, and add the imports + cache + helpers near the top:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { parsePosition, type ParsedPosition } from "@/utils/positionParser";
import { geodesicDestination } from "@/utils/positionMath";
import { magneticVariation } from "@/utils/magvar";
import { getAirportInfo, getNavaidInfo } from "@/utils/aviationWeatherApi";

interface PositionInputProps {
  rawValue: string;
  cachedPosition: [number | null, number | null];
  onChange: (route: string, position: [number | null, number | null]) => void;
}

const formatLatLon = (lat: number, lon: number): string =>
  `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

// Module-scoped session cache: id -> {lat, lon}.
const stationCache = new Map<string, { lat: number; lon: number }>();

async function resolveStation(
  parsed: Extract<ParsedPosition, { kind: "airport-rd" | "vor-rd" }>
): Promise<{ lat: number; lon: number }> {
  const cached = stationCache.get(parsed.stationId);
  if (cached) return cached;

  if (parsed.kind === "airport-rd") {
    const [a] = await getAirportInfo([parsed.stationId]);
    if (!a) throw new Error("not found");
    const coords = { lat: a.lat, lon: a.lon };
    stationCache.set(parsed.stationId, coords);
    return coords;
  } else {
    const [n] = await getNavaidInfo([parsed.stationId]);
    if (!n) throw new Error("not found");
    const coords = { lat: n.lat, lon: n.lon };
    stationCache.set(parsed.stationId, coords);
    return coords;
  }
}

function resolveRadialDistance(
  parsed: Extract<ParsedPosition, { kind: "airport-rd" | "vor-rd" }>,
  station: { lat: number; lon: number }
): { lat: number; lon: number } {
  const variation = magneticVariation(station.lat, station.lon);
  const trueBearing = parsed.radial + variation;
  const dest = geodesicDestination(
    station.lat,
    station.lon,
    trueBearing,
    parsed.distanceNm
  );
  return { lat: round4(dest.lat), lon: round4(dest.lon) };
}

export default function PositionInput({
  rawValue,
  cachedPosition,
  onChange,
}: PositionInputProps) {
  const [localRaw, setLocalRaw] = useState(rawValue);
  const lastPushed = useRef(rawValue);
  const requestId = useRef(0);
  const [hint, setHint] = useState<{ type: "ok" | "warn"; text: string } | null>(
    cachedPosition[0] !== null && cachedPosition[1] !== null
      ? { type: "ok", text: `→ ${formatLatLon(cachedPosition[0]!, cachedPosition[1]!)}` }
      : null
  );

  useEffect(() => {
    if (rawValue !== lastPushed.current) {
      setLocalRaw(rawValue);
      if (cachedPosition[0] !== null && cachedPosition[1] !== null) {
        setHint({
          type: "ok",
          text: `→ ${formatLatLon(cachedPosition[0]!, cachedPosition[1]!)}`,
        });
      } else if (rawValue === "") {
        setHint(null);
      }
    }
  }, [rawValue, cachedPosition]);

  useEffect(() => {
    if (localRaw === lastPushed.current) return;

    const handle = setTimeout(() => {
      const myId = ++requestId.current;
      const parsed = parsePosition(localRaw);
      lastPushed.current = localRaw;

      if (localRaw === "") {
        setHint(null);
        onChange("", [null, null]);
        return;
      }

      if (parsed.kind === "decimal" || parsed.kind === "dms" || parsed.kind === "ddm") {
        setHint({ type: "ok", text: `→ ${formatLatLon(parsed.lat, parsed.lon)}` });
        onChange(localRaw, [parsed.lat, parsed.lon]);
        return;
      }

      if (parsed.kind === "unrecognized") {
        setHint({
          type: "warn",
          text: "⚠ Unrecognized format — saved as free text",
        });
        onChange(localRaw, [null, null]);
        return;
      }

      // airport-rd or vor-rd
      setHint({
        type: "ok",
        text: `→ looking up ${parsed.stationId}…`,
      });

      resolveStation(parsed)
        .then((station) => {
          if (myId !== requestId.current) return; // stale
          const dest = resolveRadialDistance(parsed, station);
          setHint({
            type: "ok",
            text: `→ ${formatLatLon(dest.lat, dest.lon)} (${parsed.raw})`,
          });
          onChange(localRaw, [dest.lat, dest.lon]);
        })
        .catch(() => {
          if (myId !== requestId.current) return; // stale
          setHint({
            type: "warn",
            text: `⚠ Could not find ${parsed.stationId}`,
          });
          onChange(localRaw, [null, null]);
        });
    }, 300);

    return () => clearTimeout(handle);
  }, [localRaw, onChange]);

  return (
    <div className="space-y-2">
      <label htmlFor="route" className="block text-sm font-medium">
        Area of Operations (position)
      </label>
      <input
        type="text"
        id="route"
        name="route"
        value={localRaw}
        onChange={(e) => setLocalRaw(e.target.value.toUpperCase())}
        className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
      />
      {hint && (
        <div
          className={`text-xs ${
            hint.type === "warn"
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          {hint.text}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run all PositionInput tests**

Run: `npx jest src/components/PositionInput.test.tsx`
Expected: PASS — sync paths still green, async paths now green, race protection holds.

- [ ] **Step 5: Commit**

```bash
git add src/components/PositionInput.tsx src/components/PositionInput.test.tsx
git commit -m "PositionInput: add async airport/VOR lookup with race protection

Resolves station via getAirportInfo (4-letter) or getNavaidInfo (3-letter),
applies WMM magnetic variation, runs spherical geodesic. Stale results
guarded by request-id ref. Module-scoped session cache avoids re-fetch."
```

---

## Task 12: Wire `PositionInput` into `SortieInfo`

**Files:**
- Modify: `src/components/SortieInfo.tsx`
- Modify: `src/components/SortieInfo.test.tsx`

- [ ] **Step 1: Inspect existing SortieInfo test patterns**

Run: `head -120 src/components/SortieInfo.test.tsx`
Expected: see how `onUpdate` is asserted and how form fields are queried. Mirror that.

- [ ] **Step 2: Write a failing wiring test**

Append to `src/components/SortieInfo.test.tsx`:

```tsx
describe("SortieInfo - position field wiring", () => {
  it("calls onUpdate with both route and position when valid coords are entered", async () => {
    jest.useFakeTimers();
    const onUpdate = jest.fn();
    render(<SortieInfo onUpdate={onUpdate} />);
    const input = screen.getByLabelText(/Area of Operations/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "36.01N/75.50W" } });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall.route).toBe("36.01N/75.50W");
    expect(lastCall.position).toEqual([36.01, -75.5]);
    jest.useRealTimers();
  });

  it("hydrates initial position from initialData without re-parsing", () => {
    const initialData = {
      route: "KOGD/285/34",
      position: [41.4321, -112.7042] as [number | null, number | null],
    };
    render(
      <SortieInfo
        initialData={initialData as never}
        onUpdate={() => {}}
      />
    );
    expect(screen.getByDisplayValue("KOGD/285/34")).toBeInTheDocument();
    expect(screen.getByText(/41\.4321, -112\.7042/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npx jest src/components/SortieInfo.test.tsx -t "position field wiring"`
Expected: FAIL — `route` field is still a plain `<input>` and there's no `position` plumbing.

- [ ] **Step 4: Replace the inline route input in `SortieInfo`**

Edit `src/components/SortieInfo.tsx`. At the top, add the import:

```ts
import PositionInput from "@/components/PositionInput";
```

Update the `SortieInfoData` `Pick` (lines 12-24) to include `position`:

```ts
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
>;
```

Update the `useState` initializer (lines 27-38) to include `position`:

```ts
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
  });
```

Replace the route input block (lines 320-332) with:

```tsx
        <PositionInput
          rawValue={formData.route || ""}
          cachedPosition={formData.position ?? [null, null]}
          onChange={(route, position) => {
            const updated = { ...formData, route, position };
            setFormData(updated);
            onUpdate({ route, position });
          }}
        />
```

Note: the existing `<div className="space-y-2">` wrapper that surrounded the old input is removed because `PositionInput` provides its own outer `<div className="space-y-2">`.

- [ ] **Step 5: Run targeted tests, verify they pass**

Run: `npx jest src/components/SortieInfo.test.tsx`
Expected: PASS — new wiring tests green, existing SortieInfo tests still green. Inspect any failure for tests that previously asserted on the old `<input id="route">` and update them to use `screen.getByLabelText(/Area of Operations/i)` if they break.

- [ ] **Step 6: Run full test suite**

Run: `npm test -- --silent`
Expected: PASS across the board.

- [ ] **Step 7: Run lint and type check**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/SortieInfo.tsx src/components/SortieInfo.test.tsx
git commit -m "Wire PositionInput into SortieInfo

Replaces inline route input with PositionInput; threads route and
position through onUpdate together so URL state stays in sync."
```

---

## Task 13: Manual browser smoke test

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server up on `http://localhost:3000`.

- [ ] **Step 2: Test each format manually in the browser**

Open `http://localhost:3000`. In the "Area of Operations (position)" field, enter each of the following and confirm the hint that appears beneath it:

| Input | Expected hint |
|---|---|
| `36.01N/75.50W` | `→ 36.0100, -75.5000` |
| `36.01/-75.50` | `→ 36.0100, -75.5000` |
| `41.43, -112.70` | `→ 41.4300, -112.7000` |
| `360051N/0753004W` | `→ 36.0142, -75.5011` |
| `360051/-0753004` | `→ 36.0142, -75.5011` |
| `3600.86N/07530.07W` | `→ 36.0143, -75.5012` |
| `3600.86/-07530.07` | `→ 36.0143, -75.5012` |
| `KOGD/285/34` | `→ looking up KOGD…` then `→ <coords> (KOGD/285/34)` |
| `OGD/285/34` | `→ looking up OGD…` then `→ <coords> (OGD/285/34)` |
| `Cache Valley` | `⚠ Unrecognized format — saved as free text` |
| `KZZZ/285/34` (bogus) | `⚠ Could not find KZZZ` |

- [ ] **Step 3: Verify URL state round-trips a resolved airport**

After typing `KOGD/285/34` and seeing the resolved coords:
1. Copy the browser URL.
2. Open it in a new tab.
3. Confirm the field shows `KOGD/285/34` and the resolved coords appear immediately *without* a re-fetch (check Network tab — no aviation-weather call on load for the cached entry).

- [ ] **Step 4: Verify free-text behavior round-trips**

Type `Cache Valley`, confirm the warning, copy URL, open in new tab. Confirm the text is preserved and the same warning appears.

- [ ] **Step 5: Stop dev server**

Press Ctrl-C in the dev terminal.

- [ ] **Step 6: Final lint + build**

Run: `npm run lint && npm run build`
Expected: clean build, no warnings introduced.

- [ ] **Step 7: Commit any final tweaks (if needed)**

If browser testing surfaced visual or behavioral issues, address them and commit. Otherwise, this task is verification only — no commit.

---

## Self-Review Notes

- **Spec coverage:** all eight formats covered (Tasks 3-6, 10-11). Magvar via WMM (Task 8). Geodesic math (Task 7). Aviation weather navaid endpoint (Task 9). PositionInput sync + async (Tasks 10-11). SortieInfo wiring (Task 12). URL state for `position` (Task 1). Browser verification (Task 13).
- **Type consistency:** `position: [number | null, number | null]` everywhere — types.ts, AppContainer initial state, SortieInfo Pick + state init, PositionInput prop. `ParsedPosition` discriminated union exported once from `positionParser.ts` and reused.
- **Placeholders:** none found in plan.
- **TDD discipline:** every code task starts with a failing test and runs it to verify failure before implementation.
