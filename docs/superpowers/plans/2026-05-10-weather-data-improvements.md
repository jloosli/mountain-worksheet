# Weather Data Improvements Implementation Plan (Issue #56)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix weather-fetch accuracy: per-airport time-aware dep/arr weather, location/time-aware area-of-ops winds + temps + altimeter from Open-Meteo (GFS), and G-AIRMET auto-flagging — with a stale-forecast warnings panel that surfaces every fallback.

**Architecture:** Three sequential phases, each one shippable PR. Phase A introduces per-airport time-aware selection plus the warnings-panel infrastructure (so warnings emitted by every later phase are visible from day one). Phase B replaces the legacy SLC-hardcoded windtemp pipeline with an Open-Meteo (GFS) proxy + altitude-bracketing client + area-of-ops orchestrator, and unblocks operating temp/altimeter writes. Phase C adds G-AIRMET point-in-polygon auto-flagging for the three checkboxes.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Jest + React Testing Library, fetch-based proxies (no SDKs). New external API dependency: `api.open-meteo.com/v1/gfs` (free GFS wrapper, no key). No new npm packages.

**Spec:** `docs/superpowers/specs/2026-05-10-weather-data-improvements-design.md`

---

## File Structure

**New files (all phases):**
- `src/utils/airportTimeWeather.ts` — `selectAirportWeather(metar, taf, requestedTime)` (Phase A)
- `src/utils/__tests__/airportTimeWeather.test.ts` (Phase A)
- `src/components/WeatherWarningsPanel.tsx` (Phase A)
- `src/components/WeatherWarningsPanel.test.tsx` (Phase A)
- `src/app/api/open-meteo/route.ts` — proxy (Phase B)
- `src/app/api/open-meteo/route.test.ts` (Phase B)
- `src/utils/openMeteoApi.ts` — client + altitude bracketing (Phase B)
- `src/utils/__tests__/openMeteoApi.test.ts` (Phase B)
- `src/utils/areaOfOpsWeather.ts` — orchestration (Phase B)
- `src/utils/__tests__/areaOfOpsWeather.test.ts` (Phase B)
- `src/utils/gairmetApi.ts` — fetch + ray-casting PIP (Phase C)
- `src/utils/__tests__/gairmetApi.test.ts` (Phase C)

**Modified across phases:**
- `src/utils/weatherDataMapper.ts` — replace `selectTAFForFlightTime` (A); allow `temp[1]`/`altimeter[1]` writes (B); always-overwrite AIRMET booleans (C); aggregate warnings (A→C)
- `src/utils/weatherDataMapper.test.ts` — extend coverage in each phase
- `src/components/WeatherDataIntegration.tsx` — split each phase's sub-fetch in, render `WeatherWarningsPanel` (A); replace windtemp call (B); add G-AIRMET (C)
- `src/components/WeatherDataIntegration.test.tsx` — extend in each phase
- `src/utils/aviationWeatherApi.ts` — remove `getWindTemp` (B); no Phase C changes
- `src/utils/aviationWeatherApi.test.ts` — remove `getWindTemp` coverage (B)
- `src/app/api/aviation-weather/route.ts` — remove `windtemp` branch (B)

**Deleted in Phase B:**
- `src/utils/windTempParser.ts`
- `src/utils/__tests__/windTempParser.test.ts`

---

## Phase A — Per-airport time-aware dep/arr weather + warnings infrastructure

Phase A goal: dep gets weather valid at `depTime`, arr gets weather valid at `depTime + duration`, and any fallback (out-of-window, missing temp, missing data) surfaces a warning in a new `WeatherWarningsPanel` rendered under the existing weather-fetch box.

### Task A1: `selectAirportWeather` — METAR/TAF chooser keyed on a single requested time

**Files:**
- Create: `src/utils/airportTimeWeather.ts`
- Test: `src/utils/__tests__/airportTimeWeather.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/utils/__tests__/airportTimeWeather.test.ts`:

```ts
import { selectAirportWeather } from "../airportTimeWeather";
import type { METARResponse, TAFResponse } from "../aviationWeatherApi";

const baseMetar: METARResponse = {
  icaoId: "KSLC",
  obsTime: "2026-05-12T15:00:00Z",
  report: "",
  temp: 18,
  dewp: 5,
  wdir: 0,
  wspd: 0,
  visib: 10,
  altim: 1015, // hectopascals
  qcField: 0,
  metarType: "METAR",
  rawOb: "",
};

const tafFcsts = [
  {
    timeFrom: Math.floor(Date.parse("2026-05-12T15:00:00Z") / 1000),
    timeTo: Math.floor(Date.parse("2026-05-12T18:00:00Z") / 1000),
    temp: 22,
    altim: 30.0,
    wdir: 0,
    wspd: 0,
  },
  {
    timeFrom: Math.floor(Date.parse("2026-05-12T18:00:00Z") / 1000),
    timeTo: Math.floor(Date.parse("2026-05-12T21:00:00Z") / 1000),
    temp: 24,
    altim: 30.05,
    wdir: 0,
    wspd: 0,
  },
] as unknown as TAFResponse["fcsts"];

const baseTaf: TAFResponse = {
  icaoId: "KSLC",
  issueTime: "2026-05-12T14:00:00Z",
  validTime: "2026-05-12T15:00:00Z",
  validTimeEnd: "2026-05-12T21:00:00Z",
  rawTAF: "",
  lat: 40.77,
  lon: -111.96,
  elev: 1300,
  fcstType: "TAF",
  fcsts: tafFcsts,
} as unknown as TAFResponse;

describe("selectAirportWeather", () => {
  it("uses METAR when requested time is within ~90 min of obsTime", () => {
    const requested = new Date("2026-05-12T15:30:00Z");
    const result = selectAirportWeather(baseMetar, baseTaf, requested);
    expect(result.source).toBe("metar");
    expect(result.temp).toBe(18);
    expect(result.altimeter).toBeCloseTo(29.97, 2); // 1015 hPa → ~29.97 inHg
    expect(result.warnings).toEqual([]);
  });

  it("uses TAF period covering requested time when METAR is stale", () => {
    const requested = new Date("2026-05-12T19:30:00Z"); // > 90 min from METAR
    const result = selectAirportWeather(baseMetar, baseTaf, requested);
    expect(result.source).toBe("taf-fcst");
    expect(result.temp).toBe(24);
    expect(result.altimeter).toBe(30.05);
    expect(result.warnings).toEqual([]);
  });

  it("falls back to METAR temp when matched TAF period has no temp", () => {
    const tafNoTemp = {
      ...baseTaf,
      fcsts: [
        { ...tafFcsts[0], temp: undefined },
        tafFcsts[1],
      ],
    } as unknown as TAFResponse;
    const requested = new Date("2026-05-12T17:00:00Z"); // > 90 min from METAR, in fcst[0]
    const result = selectAirportWeather(baseMetar, tafNoTemp, requested);
    expect(result.source).toBe("taf-fcst");
    expect(result.temp).toBe(18); // fell back to METAR
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/no temperature/);
  });

  it("emits stale warning when no TAF period covers requested time", () => {
    const requested = new Date("2026-05-15T12:00:00Z"); // 3 days past TAF end
    const result = selectAirportWeather(baseMetar, baseTaf, requested);
    expect(result.source).toBe("taf-nearest");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/forecast unavailable/i);
  });

  it("returns source 'none' when neither METAR nor TAF available", () => {
    const requested = new Date("2026-05-12T15:00:00Z");
    const result = selectAirportWeather(undefined, undefined, requested);
    expect(result.source).toBe("none");
    expect(result.temp).toBeNull();
    expect(result.altimeter).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest src/utils/__tests__/airportTimeWeather.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `airportTimeWeather.ts`**

Create `src/utils/airportTimeWeather.ts`:

```ts
import type { METARResponse, TAFResponse } from "./aviationWeatherApi";

const HPA_TO_INHG = 0.0295299;
const METAR_FRESHNESS_MS = 90 * 60 * 1000;

export type AirportWeatherSource = "metar" | "taf-fcst" | "taf-nearest" | "none";

export interface AirportWeatherAtTime {
  temp: number | null;
  altimeter: number | null;
  source: AirportWeatherSource;
  warnings: string[];
}

interface TafFcst {
  timeFrom?: number;
  timeTo?: number;
  temp?: number | { sfcTemp?: number; validTime?: number }[];
  altim?: number;
}

function metarAltimeterInHg(altim: number | undefined): number | null {
  if (altim === undefined) return null;
  return Math.round(altim * HPA_TO_INHG * 100) / 100;
}

function fcstTempValue(fcst: TafFcst, requested: Date): number | undefined {
  // TAF temp may be a number or an array of {validTime, sfcTemp}; handle both
  if (typeof fcst.temp === "number") return fcst.temp;
  if (Array.isArray(fcst.temp) && fcst.temp.length > 0) {
    const reqEpoch = Math.floor(requested.getTime() / 1000);
    let closest = fcst.temp[0];
    let minDiff = Math.abs((closest.validTime ?? 0) - reqEpoch);
    for (const candidate of fcst.temp) {
      const diff = Math.abs((candidate.validTime ?? 0) - reqEpoch);
      if (diff < minDiff) {
        minDiff = diff;
        closest = candidate;
      }
    }
    return closest.sfcTemp;
  }
  return undefined;
}

function findCoveringFcst(
  fcsts: TafFcst[] | undefined,
  requested: Date
): TafFcst | undefined {
  if (!fcsts || fcsts.length === 0) return undefined;
  const reqEpoch = Math.floor(requested.getTime() / 1000);
  return fcsts.find(
    (f) =>
      f.timeFrom !== undefined &&
      f.timeTo !== undefined &&
      reqEpoch >= f.timeFrom &&
      reqEpoch < f.timeTo
  );
}

function findClosestFcst(
  fcsts: TafFcst[] | undefined,
  requested: Date
): { fcst: TafFcst; deltaMs: number } | undefined {
  if (!fcsts || fcsts.length === 0) return undefined;
  const reqMs = requested.getTime();
  let best: { fcst: TafFcst; deltaMs: number } | undefined;
  for (const f of fcsts) {
    if (f.timeFrom === undefined || f.timeTo === undefined) continue;
    const fromMs = f.timeFrom * 1000;
    const toMs = f.timeTo * 1000;
    const delta =
      reqMs < fromMs ? fromMs - reqMs : reqMs >= toMs ? reqMs - toMs : 0;
    if (!best || delta < best.deltaMs) best = { fcst: f, deltaMs: delta };
  }
  return best;
}

function fmtDelta(ms: number): string {
  const hr = ms / (60 * 60 * 1000);
  if (hr >= 24) return `${(hr / 24).toFixed(1)} d`;
  if (hr >= 1) return `${hr.toFixed(1)} hr`;
  return `${Math.round(ms / 60000)} min`;
}

export function selectAirportWeather(
  metar: METARResponse | undefined,
  taf: TAFResponse | undefined,
  requestedTime: Date
): AirportWeatherAtTime {
  const warnings: string[] = [];
  const requestedIso = requestedTime.toISOString();

  // 1) METAR if recent
  if (metar?.obsTime) {
    const obsMs = Date.parse(metar.obsTime);
    if (
      Number.isFinite(obsMs) &&
      Math.abs(requestedTime.getTime() - obsMs) <= METAR_FRESHNESS_MS
    ) {
      return {
        temp: metar.temp !== undefined ? Math.round(metar.temp) : null,
        altimeter: metarAltimeterInHg(metar.altim),
        source: "metar",
        warnings,
      };
    }
  }

  // 2) TAF period covering requested time
  const fcsts = (taf as unknown as { fcsts?: TafFcst[] } | undefined)?.fcsts;
  const covering = findCoveringFcst(fcsts, requestedTime);
  if (covering) {
    let temp = fcstTempValue(covering, requestedTime);
    if (temp === undefined && metar?.temp !== undefined) {
      temp = metar.temp;
      const obsMs = metar.obsTime ? Date.parse(metar.obsTime) : NaN;
      const delta = Number.isFinite(obsMs)
        ? fmtDelta(Math.abs(requestedTime.getTime() - obsMs))
        : "unknown";
      warnings.push(
        `${metar.icaoId}: forecast period has no temperature; using current observation (Δt = ${delta})`
      );
    }
    return {
      temp: temp !== undefined ? Math.round(temp) : null,
      altimeter:
        covering.altim !== undefined
          ? Math.round(covering.altim * 100) / 100
          : metarAltimeterInHg(metar?.altim),
      source: "taf-fcst",
      warnings,
    };
  }

  // 3) Nearest TAF period as fallback
  const closest = findClosestFcst(fcsts, requestedTime);
  if (closest) {
    const id = taf?.icaoId ?? metar?.icaoId ?? "airport";
    warnings.push(
      `${id}: forecast unavailable for ${requestedIso}; using nearest TAF period (Δt = ${fmtDelta(
        closest.deltaMs
      )})`
    );
    let temp = fcstTempValue(closest.fcst, requestedTime);
    if (temp === undefined) temp = metar?.temp;
    return {
      temp: temp !== undefined ? Math.round(temp) : null,
      altimeter:
        closest.fcst.altim !== undefined
          ? Math.round(closest.fcst.altim * 100) / 100
          : metarAltimeterInHg(metar?.altim),
      source: "taf-nearest",
      warnings,
    };
  }

  // 4) Nothing
  warnings.push(
    `No METAR or TAF data available for requested time ${requestedIso}`
  );
  return { temp: null, altimeter: null, source: "none", warnings };
}
```

- [ ] **Step 4: Run test, verify all pass**

Run: `npx jest src/utils/__tests__/airportTimeWeather.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Run lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/utils/airportTimeWeather.ts src/utils/__tests__/airportTimeWeather.test.ts
git commit -m "$(cat <<'EOF'
Add airportTimeWeather selector for time-aware METAR/TAF resolution

Replaces single-time selectTAFForFlightTime with per-airport, per-time
selection. Decision order: fresh METAR within 90 min, then covering TAF
period, then nearest TAF period with stale-forecast warning. Falls back
to METAR temp when matched TAF period has no temperature.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A2: Refactor `mapAirportSpecificWeatherData` to use per-airport requested time

**Files:**
- Modify: `src/utils/weatherDataMapper.ts`
- Modify: `src/utils/weatherDataMapper.test.ts`

The current `mapAirportSpecificWeatherData` (line 157 onward) calls `selectTAFForFlightTime` with one combined `flightDate` + `flightTime` for both airports. We change it to compute `depTime` and `arrTime` from `WeatherMappingOptions`, then call `selectAirportWeather` per airport.

- [ ] **Step 1: Extend `WeatherMappingOptions` to carry duration**

Edit `src/utils/weatherDataMapper.ts`. Find the `WeatherMappingOptions` interface (line 36-42) and add `durationHours`:

```ts
export interface WeatherMappingOptions {
  flightDate?: string; // ISO date string
  flightTime?: string; // HH:MM format
  durationHours?: number | null;
  departureAirport?: string;
  arrivalAirport?: string;
  validateData?: boolean;
}
```

- [ ] **Step 2: Update `WeatherMappingResult` to carry warnings forward**

Already has `warnings: string[]`. Confirm by reading lines 29-34. No code change needed.

- [ ] **Step 3: Write failing test for time-aware dep≠arr selection**

Add to `src/utils/weatherDataMapper.test.ts` inside the existing top-level `describe("Weather Data Mapper", ...)` block (find a sensible location near `describe("mapAirportSpecificWeatherData", ...)` if present, or near `describe("mapWeatherDataToWorksheet", ...)`):

```ts
describe("dep/arr time-aware weather", () => {
  it("uses different TAF periods for departure and arrival", () => {
    const metar = [
      {
        icaoId: "KPVU",
        obsTime: "2026-05-12T14:00:00Z",
        temp: 16,
        altim: 1015,
        rawOb: "",
        report: "",
        dewp: 0,
        wdir: 0,
        wspd: 0,
        visib: 10,
        qcField: 0,
        metarType: "METAR",
      },
      {
        icaoId: "KSGU",
        obsTime: "2026-05-12T14:00:00Z",
        temp: 22,
        altim: 1015,
        rawOb: "",
        report: "",
        dewp: 0,
        wdir: 0,
        wspd: 0,
        visib: 10,
        qcField: 0,
        metarType: "METAR",
      },
    ];
    const fcsts15to18 = {
      timeFrom: Math.floor(Date.parse("2026-05-12T15:00:00Z") / 1000),
      timeTo: Math.floor(Date.parse("2026-05-12T18:00:00Z") / 1000),
      temp: 18,
      altim: 30.0,
    };
    const fcsts18to21 = {
      timeFrom: Math.floor(Date.parse("2026-05-12T18:00:00Z") / 1000),
      timeTo: Math.floor(Date.parse("2026-05-12T21:00:00Z") / 1000),
      temp: 25,
      altim: 30.05,
    };
    const taf = [
      {
        icaoId: "KPVU",
        validTime: "2026-05-12T15:00:00Z",
        validTimeEnd: "2026-05-12T21:00:00Z",
        rawTAF: "",
        issueTime: "",
        lat: 0,
        lon: 0,
        elev: 0,
        fcstType: "TAF",
        fcsts: [fcsts15to18, fcsts18to21],
      },
      {
        icaoId: "KSGU",
        validTime: "2026-05-12T15:00:00Z",
        validTimeEnd: "2026-05-12T21:00:00Z",
        rawTAF: "",
        issueTime: "",
        lat: 0,
        lon: 0,
        elev: 0,
        fcstType: "TAF",
        fcsts: [fcsts15to18, fcsts18to21],
      },
    ];

    const result = mapAirportSpecificWeatherData(
      metar as unknown as METARResponse[],
      taf as unknown as TAFResponse[],
      {
        flightDate: "2026-05-12",
        flightTime: "15:00", // dep
        durationHours: 3, // arr at 18:00
        departureAirport: "KPVU",
        arrivalAirport: "KSGU",
      }
    );

    // dep at 15:00 → TAF period 15-18 → temp 18
    expect(result.temp?.[0]).toBe(18);
    // arr at 18:00 → TAF period 18-21 → temp 25
    expect(result.temp?.[2]).toBe(25);
  });
});
```

Add the import to the existing imports at the top of the file:

```ts
import {
  ...existing imports...,
  mapAirportSpecificWeatherData,
} from "./weatherDataMapper";
```

(If `mapAirportSpecificWeatherData` is already imported, leave it.)

- [ ] **Step 4: Run test, verify it fails**

Run: `npx jest src/utils/__tests__/weatherDataMapper.test.ts -t "dep/arr time-aware weather"`
Expected: FAIL — current code applies the same time to both airports, so `temp[0]` and `temp[2]` will both be 18 (or both 25 depending on which TAF the code picks). The new test exposes the bug.

- [ ] **Step 5: Refactor `mapAirportSpecificWeatherData` to call `selectAirportWeather` per airport**

Edit `src/utils/weatherDataMapper.ts`. At the top of the file, add the import:

```ts
import { selectAirportWeather } from "./airportTimeWeather";
```

Replace the entire `mapAirportSpecificWeatherData` function body (currently lines 157-305) with:

```ts
export function mapAirportSpecificWeatherData(
  metarData: METARResponse[],
  tafData: TAFResponse[],
  options: WeatherMappingOptions = {}
): { data: Partial<WorksheetData>; warnings: string[] } {
  const result: Partial<WorksheetData> = {};
  const warnings: string[] = [];

  const safeMetar = Array.isArray(metarData) ? metarData : [];
  const safeTaf = Array.isArray(tafData) ? tafData : [];

  if (!options.flightDate || !options.flightTime) {
    return { data: result, warnings };
  }

  const depTime = new Date(`${options.flightDate}T${options.flightTime}:00Z`);
  if (Number.isNaN(depTime.getTime())) {
    return { data: result, warnings };
  }
  const durationHours =
    typeof options.durationHours === "number" && options.durationHours > 0
      ? options.durationHours
      : 0;
  const arrTime = new Date(depTime.getTime() + durationHours * 3600 * 1000);

  const apply = (
    airportCode: string | undefined,
    requestedTime: Date,
    tempIndex: 0 | 2,
    altIndex: 0 | 2
  ): void => {
    if (!airportCode) return;
    const code = airportCode.toUpperCase();
    const metar = safeMetar.find((m) => m.icaoId?.toUpperCase() === code);
    const taf = safeTaf.find((t) => t.icaoId?.toUpperCase() === code);
    const sel = selectAirportWeather(metar, taf, requestedTime);
    warnings.push(...sel.warnings);
    if (sel.temp !== null) {
      const temp = sel.temp;
      if (!options.validateData || isValidTemperature(temp)) {
        if (!result.temp) result.temp = [-1, -1, -1];
        result.temp[tempIndex] = temp;
      }
    }
    if (sel.altimeter !== null) {
      if (!options.validateData || isValidAltimeter(sel.altimeter)) {
        if (!result.altimeter) result.altimeter = [-1, -1, -1];
        result.altimeter[altIndex] = sel.altimeter;
      }
    }
  };

  apply(options.departureAirport, depTime, 0, 0);
  apply(options.arrivalAirport, arrTime, 2, 2);

  return { data: result, warnings };
}
```

- [ ] **Step 6: Update `mapWeatherDataToWorksheet` to consume the new return shape**

Still in `weatherDataMapper.ts`, find the call to `mapAirportSpecificWeatherData` inside `mapWeatherDataToWorksheet` (around line 449-460). Replace it with:

```ts
    if (metarData.length > 0 || tafData.length > 0) {
      const { data: airportWeatherData, warnings: airportWarnings } =
        mapAirportSpecificWeatherData(metarData, tafData, options);
      result.data = { ...result.data, ...airportWeatherData };
      result.warnings.push(...airportWarnings);
    } else {
      result.warnings.push(
        "No METAR/TAF data available for airport-specific temperature/pressure"
      );
    }
```

- [ ] **Step 7: Delete the now-unused `selectTAFForFlightTime` helper**

Still in `weatherDataMapper.ts`, find and delete the `selectTAFForFlightTime` function (currently lines 579-608). Remove it entirely.

If `mapTemperaturePressureData` (currently lines 96-151) still references it, remove that function too — confirm by grep:

```
grep -n selectTAFForFlightTime src/utils/weatherDataMapper.ts
```

If the only remaining reference is inside `mapTemperaturePressureData`, delete `mapTemperaturePressureData` as well — it isn't called from `mapWeatherDataToWorksheet` anymore (the airport-specific path replaces it). Also delete its export from any test imports.

- [ ] **Step 8: Run the new test, verify it passes**

Run: `npx jest src/utils/__tests__/weatherDataMapper.test.ts -t "dep/arr time-aware weather"`
Expected: PASS — `temp[0]=18`, `temp[2]=25`.

- [ ] **Step 9: Run full mapper test suite**

Run: `npx jest src/utils/__tests__/weatherDataMapper.test.ts`
Expected: any tests asserting against the old `selectTAFForFlightTime` behavior or `mapTemperaturePressureData` may fail. For each failure, decide:
- If it's testing deleted code, remove the test.
- If it's testing kept-but-changed behavior, update the assertion to match the new contract.

- [ ] **Step 10: Run lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add src/utils/weatherDataMapper.ts src/utils/__tests__/weatherDataMapper.test.ts
git commit -m "$(cat <<'EOF'
Make dep/arr weather selection time-aware

mapAirportSpecificWeatherData now computes departure time and
arrival time = depTime + duration, calling selectAirportWeather
per airport. Returns aggregated warnings. Removes the buggy
single-time selectTAFForFlightTime helper.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A3: Plumb `durationHours` from `WeatherDataIntegration` into mapping options

**Files:**
- Modify: `src/components/WeatherDataIntegration.tsx`

- [ ] **Step 1: Pass duration through the mapping call**

Edit `src/components/WeatherDataIntegration.tsx`. Find the `mapWeatherDataToWorksheet` call (around line 122-128) and add `durationHours`:

```ts
        const mappingResult = mapWeatherDataToWorksheet(apiData, {
          flightDate: worksheetData.date!,
          flightTime: worksheetData.time!,
          durationHours: worksheetData.duration ?? null,
          departureAirport,
          arrivalAirport,
          validateData: true,
        });
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/WeatherDataIntegration.tsx
git commit -m "$(cat <<'EOF'
Wire flight duration into weather-mapping options

Lets mapAirportSpecificWeatherData compute arrival time as
depTime + duration when picking the arrival airport's TAF period.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A4: `WeatherWarningsPanel` component

**Files:**
- Create: `src/components/WeatherWarningsPanel.tsx`
- Test: `src/components/WeatherWarningsPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/WeatherWarningsPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeatherWarningsPanel from "./WeatherWarningsPanel";

describe("WeatherWarningsPanel", () => {
  it("renders nothing when warnings array is empty", () => {
    const { container } = render(<WeatherWarningsPanel warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when warnings is undefined", () => {
    const { container } = render(<WeatherWarningsPanel warnings={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each warning as a list item", () => {
    render(
      <WeatherWarningsPanel
        warnings={[
          "KPVU: forecast unavailable for 2026-05-20T17:00Z; using nearest TAF period (Δt = 5.0 d)",
          "Operating area position not entered; using midpoint of KPVU↔KSGU",
        ]}
      />
    );
    expect(screen.getByText(/forecast unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Operating area position/i)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("uses amber styling and an alert role", () => {
    render(<WeatherWarningsPanel warnings={["something"]} />);
    const region = screen.getByRole("alert");
    expect(region).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest src/components/WeatherWarningsPanel.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/WeatherWarningsPanel.tsx`:

```tsx
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface WeatherWarningsPanelProps {
  warnings?: string[];
}

export default function WeatherWarningsPanel({
  warnings,
}: WeatherWarningsPanelProps) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div
      role="alert"
      className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg"
    >
      <div className="flex items-start gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Weather Data Warnings
          </h4>
          <ul className="mt-1 text-xs text-amber-800 dark:text-amber-200 list-disc list-inside space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx jest src/components/WeatherWarningsPanel.test.tsx`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Run lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/WeatherWarningsPanel.tsx src/components/WeatherWarningsPanel.test.tsx
git commit -m "$(cat <<'EOF'
Add WeatherWarningsPanel for stale-forecast notices

Renders each warning string as a bulleted list item under an amber
alert region. Returns null for empty/undefined input.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A5: Render `WeatherWarningsPanel` from `WeatherDataIntegration` and surface warnings

**Files:**
- Modify: `src/components/WeatherDataIntegration.tsx`
- Modify: `src/components/WeatherDataIntegration.test.tsx`

- [ ] **Step 1: Add `warnings` to `WeatherApiState` and store mapping warnings**

Edit `src/components/WeatherDataIntegration.tsx`.

Find the `WeatherApiState` interface (around lines 35-46) and add a `warnings` field:

```ts
interface WeatherApiState {
  isLoading: boolean;
  error: {
    title: string;
    message: string;
    details?: string;
    retryable?: boolean;
  } | null;
  airportNotFound: string | null;
  lastUpdated: Date | null;
  isRetrying: boolean;
  warnings: string[];
}
```

Find the initial `useState` call for `apiState` (around lines 56-62) and add `warnings: []`:

```ts
  const [apiState, setApiState] = useState<WeatherApiState>({
    isLoading: false,
    error: null,
    airportNotFound: null,
    lastUpdated: null,
    isRetrying: false,
    warnings: [],
  });
```

- [ ] **Step 2: Capture mapping warnings on success**

Still in `WeatherDataIntegration.tsx`, find the success branch that sets `lastUpdated` (around lines 171-178) and add the warnings:

```ts
        const updateTime = new Date();
        setApiState((prev) => ({
          ...prev,
          isLoading: false,
          lastUpdated: updateTime,
          isRetrying: false,
          warnings: mappingResult.warnings,
        }));
```

Also reset warnings on the loading branch — find the `setApiState` call at the start of `fetchWeatherData` (around lines 88-94) and add `warnings: []`:

```ts
      setApiState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        airportNotFound: null,
        isRetrying: isRetry,
        warnings: [],
      }));
```

- [ ] **Step 3: Render `WeatherWarningsPanel` under the existing data box**

Still in `WeatherDataIntegration.tsx`, add the import at the top:

```ts
import WeatherWarningsPanel from "./WeatherWarningsPanel";
```

Find the closing `</div>` of the inner `!hideBox && (...)` block (just before `{renderButton && renderButton(buttonProps)}` near line 313). Inside that conditional, add the panel after the existing div:

```tsx
      {!hideBox && (
        <>
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            {/* existing content unchanged */}
          </div>
          <WeatherWarningsPanel warnings={apiState.warnings} />
        </>
      )}
```

(Wrap the existing `<div>...</div>` plus the new `<WeatherWarningsPanel/>` in a fragment so the conditional still renders both as a unit.)

- [ ] **Step 4: Add a test verifying the panel renders after a successful fetch**

Edit `src/components/WeatherDataIntegration.test.tsx`. The existing tests use heavy mocking; we add one new test that verifies warnings flow:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// ...existing imports...

it("renders WeatherWarningsPanel with mapping warnings after successful fetch", async () => {
  const { mapWeatherDataToWorksheet } = jest.requireMock(
    "@/utils/weatherDataMapper"
  );
  mapWeatherDataToWorksheet.mockReturnValue({
    success: true,
    data: { temp: [20, null, 22] },
    errors: [],
    warnings: [
      "KPVU: forecast unavailable for 2026-05-20T17:00Z; using nearest TAF period (Δt = 5.0 d)",
    ],
  });
  const { getWeatherDataBatch } = jest.requireMock("@/utils/aviationWeatherApi");
  getWeatherDataBatch.mockResolvedValue({
    metar: [],
    taf: [],
    airport: [],
    windTemp: [],
  });

  render(<WeatherDataIntegration {...defaultProps} />);
  fireEvent.click(screen.getByText("Fetch Weather"));

  await waitFor(() => {
    expect(screen.getByText(/forecast unavailable/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npx jest src/components/WeatherDataIntegration.test.tsx -t "WeatherWarningsPanel"`
Expected: PASS.

- [ ] **Step 6: Run full test + lint + typecheck + build**

Run: `npm test -- --silent && npm run lint && npx tsc --noEmit && npm run build`
Expected: all green. (If any pre-existing test fails for an unrelated reason, fix only the regressions caused by this PR.)

- [ ] **Step 7: Commit**

```bash
git add src/components/WeatherDataIntegration.tsx src/components/WeatherDataIntegration.test.tsx
git commit -m "$(cat <<'EOF'
Render WeatherWarningsPanel under the weather-fetch box

Stores mapping warnings in WeatherApiState and renders them as a
bulleted amber list. Warnings clear at the start of every fetch
and refresh on success. Establishes the warnings infrastructure
that later phases (Open-Meteo, G-AIRMET) plug into.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A6: Phase A end-of-PR verification

- [ ] **Step 1: Manual smoke test in dev**

```bash
npm run dev
```

Open http://localhost:3000. Set a sortie with two different airports, a date/time within TAF coverage, and a duration that crosses a TAF period boundary (e.g. 4 hours starting at 14:00Z if the TAF rolls at 18:00Z). Click "Fetch Weather" and visually confirm:
- Departure temp/altim differ from arrival temp/altim when the TAF actually has different periods.
- Setting the date 6 days out triggers the amber warnings panel naming the stale-forecast period.

Stop the dev server.

- [ ] **Step 2: Verify all tests, lint, typecheck, build**

```bash
npm test -- --silent
npm run lint
npx tsc --noEmit
npm run build
```
All four must pass before opening PR 1.

- [ ] **Step 3: Open PR 1**

If running on a PR-shipping flow:

```bash
git push -u origin HEAD
gh pr create --title "Issue #56 (1/3): Time-aware dep/arr weather + warnings panel" --body "$(cat <<'EOF'
## Summary
- Replace single-time selectTAFForFlightTime with per-airport selectAirportWeather
- Departure uses depTime; arrival uses depTime + duration
- Falls back to METAR temp when matched TAF period has no temperature
- Stale-forecast warnings surface in a new amber WeatherWarningsPanel
- Removes the buggy single-time helper and dead mapTemperaturePressureData

Spec: docs/superpowers/specs/2026-05-10-weather-data-improvements-design.md (Phase A)

## Test plan
- [ ] All existing tests pass
- [ ] New airportTimeWeather unit tests cover all 5 decision branches
- [ ] WeatherWarningsPanel renders warnings when present, nothing when empty
- [ ] Manual: dep≠arr times pick different TAF periods in the live app
- [ ] Manual: 6-days-out date triggers warnings panel

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Skip if you're working on a single integrated branch.)

---

## Phase B — Open-Meteo aloft + area-of-ops weather + delete windtemp

Phase B goal: replace the SLC-hardcoded windtemp pipeline with location/time-aware Open-Meteo (GFS) data. Adds operating temp at user's altitude, MSL-pressure-derived operating altimeter, and writes them to `temp[1]` / `altimeter[1]`.

### Task B1: Open-Meteo proxy route

**Files:**
- Create: `src/app/api/open-meteo/route.ts`
- Test: `src/app/api/open-meteo/route.test.ts`

- [ ] **Step 1: Write failing route test**

Create `src/app/api/open-meteo/route.test.ts`:

```ts
import { GET } from "./route";
import { NextRequest } from "next/server";

global.fetch = jest.fn();

describe("GET /api/open-meteo", () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it("forwards query params to api.open-meteo.com/v1/gfs and returns JSON", async () => {
    const upstream = {
      latitude: 40.5,
      longitude: -112,
      hourly: { time: ["2026-05-12T16:00"], temperature_700hPa: [10] },
    };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => upstream,
    });

    const req = new NextRequest(
      "http://localhost/api/open-meteo?latitude=40.5&longitude=-112&hourly=temperature_700hPa&start_date=2026-05-12&end_date=2026-05-12"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(upstream);
    const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.open-meteo.com/v1/gfs");
    expect(calledUrl).toContain("latitude=40.5");
    expect(calledUrl).toContain("hourly=temperature_700hPa");
  });

  it("returns 400 when required params missing", async () => {
    const req = new NextRequest("http://localhost/api/open-meteo");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("propagates upstream HTTP errors", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      headers: { get: () => "application/json" },
      text: async () => "upstream down",
    });
    const req = new NextRequest(
      "http://localhost/api/open-meteo?latitude=40.5&longitude=-112"
    );
    const res = await GET(req);
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest src/app/api/open-meteo/route.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the proxy**

Create `src/app/api/open-meteo/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/gfs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (!searchParams.get("latitude") || !searchParams.get("longitude")) {
      return NextResponse.json(
        { error: "Missing required latitude/longitude parameters" },
        { status: 400 }
      );
    }
    const upstreamUrl = `${OPEN_METEO_BASE}?${searchParams.toString()}`;
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Open-Meteo API error",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Open-Meteo proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx jest src/app/api/open-meteo/route.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/open-meteo/
git commit -m "$(cat <<'EOF'
Add Open-Meteo GFS proxy route

Thin server-side proxy to api.open-meteo.com/v1/gfs to avoid CORS and
enable short server-side caching (10 min). Validates required
latitude/longitude and propagates upstream HTTP errors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B2: Open-Meteo client + altitude bracketing

**Files:**
- Create: `src/utils/openMeteoApi.ts`
- Test: `src/utils/__tests__/openMeteoApi.test.ts`

- [ ] **Step 1: Write failing tests for the client**

Create `src/utils/__tests__/openMeteoApi.test.ts`:

```ts
import {
  fetchPointForecast,
  interpolateAtAltitude,
  PRESSURE_LEVELS,
  M_TO_FT,
} from "../openMeteoApi";

global.fetch = jest.fn();

describe("openMeteoApi", () => {
  describe("fetchPointForecast", () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockClear();
    });

    it("requests temperature/wind/geopotential at all configured pressure levels", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hourly: { time: [] } }),
      });
      await fetchPointForecast(40.5, -112, {
        start: new Date("2026-05-12T00:00:00Z"),
        end: new Date("2026-05-13T00:00:00Z"),
      });
      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain("/api/open-meteo");
      expect(url).toContain("latitude=40.5");
      expect(url).toContain("longitude=-112");
      expect(url).toContain("wind_speed_unit=kn");
      for (const level of PRESSURE_LEVELS) {
        expect(url).toContain(`temperature_${level}hPa`);
        expect(url).toContain(`wind_speed_${level}hPa`);
        expect(url).toContain(`wind_direction_${level}hPa`);
        expect(url).toContain(`geopotential_height_${level}hPa`);
      }
      expect(url).toContain("pressure_msl");
    });

    it("throws on non-OK response", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "down",
      });
      await expect(
        fetchPointForecast(40.5, -112, {
          start: new Date(),
          end: new Date(),
        })
      ).rejects.toThrow(/Open-Meteo/);
    });
  });

  describe("interpolateAtAltitude", () => {
    // Heights chosen so 9000 ft falls between 850 hPa (5000 ft) and 700 hPa (10000 ft)
    const sample = {
      timeIdx: 0,
      heightsFtByLevel: {
        925: 2500,
        900: 3300,
        850: 5000,
        800: 6500,
        700: 10000,
        600: 14000,
        500: 18000,
      },
      tempByLevel: { 925: 20, 900: 18, 850: 14, 800: 10, 700: 4, 600: -5, 500: -15 },
      wspdByLevel: { 925: 5, 900: 6, 850: 8, 800: 10, 700: 14, 600: 20, 500: 30 },
      wdirByLevel: { 925: 350, 900: 355, 850: 5, 800: 10, 700: 20, 600: 30, 500: 40 }, // wraps 0
    };

    it("brackets and linearly interpolates temp at 9000 ft", () => {
      const r = interpolateAtAltitude(9000, sample);
      // 9000 between 850 (5000ft, 14C) and 700 (10000ft, 4C)
      // f = (9000-5000)/(10000-5000) = 0.8 → 14 + 0.8*(4-14) = 14 - 8 = 6
      expect(r.temp).toBe(6);
      expect(r.wspd).toBe(13); // 8 + 0.8*(14-8)=8+4.8 → round → 13
    });

    it("circular-interpolates wind direction across 0/360 boundary", () => {
      // Between 925 (2500ft, 350°) and 900 (3300ft, 355°), at 2900ft → ~352.5° → round 353
      const r = interpolateAtAltitude(2900, sample);
      expect(r.wdir).toBeGreaterThanOrEqual(351);
      expect(r.wdir).toBeLessThanOrEqual(355);
    });

    it("snaps to highest level and warns when target above range", () => {
      const r = interpolateAtAltitude(20000, sample);
      expect(r.temp).toBe(-15); // 500 hPa value
      expect(r.warnings.length).toBeGreaterThan(0);
      expect(r.warnings[0]).toMatch(/above/i);
    });

    it("snaps to lowest level and warns when target below range", () => {
      const r = interpolateAtAltitude(1000, sample);
      expect(r.temp).toBe(20); // 925 hPa value
      expect(r.warnings.length).toBeGreaterThan(0);
      expect(r.warnings[0]).toMatch(/below/i);
    });

    it("converts metres to feet via M_TO_FT", () => {
      expect(M_TO_FT).toBeCloseTo(3.28084, 4);
    });
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/utils/__tests__/openMeteoApi.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the client**

Create `src/utils/openMeteoApi.ts`:

```ts
export const PRESSURE_LEVELS = [925, 900, 850, 800, 700, 600, 500] as const;
export type PressureLevel = (typeof PRESSURE_LEVELS)[number];

export const M_TO_FT = 3.28084;
export const HPA_TO_INHG = 0.02953;

export interface OpenMeteoHourly {
  time: string[];
  pressure_msl?: number[];
  [key: string]: number[] | string[] | undefined;
}

export interface OpenMeteoPointForecast {
  hourly: OpenMeteoHourly;
}

function buildHourlyParams(): string[] {
  const params = ["pressure_msl"];
  for (const level of PRESSURE_LEVELS) {
    params.push(
      `temperature_${level}hPa`,
      `wind_speed_${level}hPa`,
      `wind_direction_${level}hPa`,
      `geopotential_height_${level}hPa`
    );
  }
  return params;
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchPointForecast(
  latitude: number,
  longitude: number,
  window: { start: Date; end: Date }
): Promise<OpenMeteoPointForecast> {
  const url = new URL("/api/open-meteo", window === undefined ? "http://localhost" : window === null ? "http://localhost" : (typeof globalThis !== "undefined" && (globalThis as { window?: { location: { origin: string } } }).window) ? (globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin : "http://localhost");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("start_date", dateOnly(window.start));
  url.searchParams.set("end_date", dateOnly(window.end));
  url.searchParams.set("wind_speed_unit", "kn");
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("hourly", buildHourlyParams().join(","));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as OpenMeteoPointForecast;
}

export interface InterpolationSample {
  timeIdx: number;
  heightsFtByLevel: Record<PressureLevel, number>;
  tempByLevel: Record<PressureLevel, number>;
  wspdByLevel: Record<PressureLevel, number>;
  wdirByLevel: Record<PressureLevel, number>;
}

export interface InterpolatedAloft {
  temp: number | null;
  wspd: number | null;
  wdir: number | null;
  warnings: string[];
}

function circularInterp(low: number, high: number, f: number): number {
  if (Math.abs(high - low) > 180) {
    if (high > low) return ((low + 360) * (1 - f) + high * f) % 360;
    return (low * (1 - f) + (high + 360) * f) % 360;
  }
  return low * (1 - f) + high * f;
}

export function interpolateAtAltitude(
  targetFt: number,
  s: InterpolationSample
): InterpolatedAloft {
  const warnings: string[] = [];
  const sortedLevels = [...PRESSURE_LEVELS].sort(
    (a, b) => s.heightsFtByLevel[a] - s.heightsFtByLevel[b]
  );

  const lowest = sortedLevels[0];
  const highest = sortedLevels[sortedLevels.length - 1];

  if (targetFt <= s.heightsFtByLevel[lowest]) {
    if (targetFt < s.heightsFtByLevel[lowest]) {
      warnings.push(
        `Target altitude ${targetFt} ft below available pressure-level range (${Math.round(
          s.heightsFtByLevel[lowest]
        )} ft); snapping to lowest level`
      );
    }
    return {
      temp: Math.round(s.tempByLevel[lowest]),
      wspd: Math.round(s.wspdByLevel[lowest]),
      wdir: Math.round(s.wdirByLevel[lowest]),
      warnings,
    };
  }
  if (targetFt >= s.heightsFtByLevel[highest]) {
    if (targetFt > s.heightsFtByLevel[highest]) {
      warnings.push(
        `Target altitude ${targetFt} ft above available pressure-level range (${Math.round(
          s.heightsFtByLevel[highest]
        )} ft); snapping to highest level`
      );
    }
    return {
      temp: Math.round(s.tempByLevel[highest]),
      wspd: Math.round(s.wspdByLevel[highest]),
      wdir: Math.round(s.wdirByLevel[highest]),
      warnings,
    };
  }

  let lowerLevel: PressureLevel = lowest;
  let upperLevel: PressureLevel = highest;
  for (let i = 0; i < sortedLevels.length - 1; i++) {
    if (
      s.heightsFtByLevel[sortedLevels[i]] <= targetFt &&
      targetFt <= s.heightsFtByLevel[sortedLevels[i + 1]]
    ) {
      lowerLevel = sortedLevels[i];
      upperLevel = sortedLevels[i + 1];
      break;
    }
  }
  const lowerHeight = s.heightsFtByLevel[lowerLevel];
  const upperHeight = s.heightsFtByLevel[upperLevel];
  const f = (targetFt - lowerHeight) / (upperHeight - lowerHeight);

  const temp = s.tempByLevel[lowerLevel] * (1 - f) + s.tempByLevel[upperLevel] * f;
  const wspd = s.wspdByLevel[lowerLevel] * (1 - f) + s.wspdByLevel[upperLevel] * f;
  const wdir = circularInterp(
    s.wdirByLevel[lowerLevel],
    s.wdirByLevel[upperLevel],
    f
  );
  return {
    temp: Math.round(temp),
    wspd: Math.round(wspd),
    wdir: Math.round(wdir),
    warnings,
  };
}

export function buildSampleAtTime(
  raw: OpenMeteoPointForecast,
  timeIdx: number
): InterpolationSample {
  const heightsFtByLevel = {} as Record<PressureLevel, number>;
  const tempByLevel = {} as Record<PressureLevel, number>;
  const wspdByLevel = {} as Record<PressureLevel, number>;
  const wdirByLevel = {} as Record<PressureLevel, number>;
  for (const level of PRESSURE_LEVELS) {
    const heights = raw.hourly[`geopotential_height_${level}hPa`] as
      | number[]
      | undefined;
    const temps = raw.hourly[`temperature_${level}hPa`] as number[] | undefined;
    const wspds = raw.hourly[`wind_speed_${level}hPa`] as number[] | undefined;
    const wdirs = raw.hourly[`wind_direction_${level}hPa`] as
      | number[]
      | undefined;
    heightsFtByLevel[level] = (heights?.[timeIdx] ?? 0) * M_TO_FT;
    tempByLevel[level] = temps?.[timeIdx] ?? NaN;
    wspdByLevel[level] = wspds?.[timeIdx] ?? NaN;
    wdirByLevel[level] = wdirs?.[timeIdx] ?? NaN;
  }
  return { timeIdx, heightsFtByLevel, tempByLevel, wspdByLevel, wdirByLevel };
}

export function pickClosestTimeIdx(
  raw: OpenMeteoPointForecast,
  target: Date
): { idx: number; deltaMs: number } {
  const targetMs = target.getTime();
  const times = raw.hourly.time;
  if (!times || times.length === 0) return { idx: -1, deltaMs: Infinity };
  let bestIdx = 0;
  let bestDelta = Math.abs(Date.parse(times[0] + "Z") - targetMs);
  for (let i = 1; i < times.length; i++) {
    const t = Date.parse(times[i] + "Z");
    const d = Math.abs(t - targetMs);
    if (d < bestDelta) {
      bestDelta = d;
      bestIdx = i;
    }
  }
  return { idx: bestIdx, deltaMs: bestDelta };
}
```

Note on the `URL` construction in `fetchPointForecast`: replace the inline `window`/`globalThis` mess with a simple test-friendly origin. Use this cleaner version instead:

```ts
function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost";
}

export async function fetchPointForecast(
  latitude: number,
  longitude: number,
  win: { start: Date; end: Date }
): Promise<OpenMeteoPointForecast> {
  const url = new URL("/api/open-meteo", getOrigin());
  url.searchParams.set("latitude", String(latitude));
  // ...rest unchanged
}
```

Apply that simpler `getOrigin()` form when implementing — discard the convoluted inline expression.

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx jest src/utils/__tests__/openMeteoApi.test.ts`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/utils/openMeteoApi.ts src/utils/__tests__/openMeteoApi.test.ts
git commit -m "$(cat <<'EOF'
Add Open-Meteo client with altitude bracketing

fetchPointForecast issues a single /api/open-meteo call requesting
temp/wind/geopotential-height at pressure levels 500-925 hPa.
interpolateAtAltitude brackets the requested altitude using
geopotential heights, linearly interpolates temp and wind speed,
and circular-interpolates wind direction across the 0/360 boundary.
Snaps to nearest level with a warning when target is out of range.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B3: `areaOfOpsWeather` orchestrator

**Files:**
- Create: `src/utils/areaOfOpsWeather.ts`
- Test: `src/utils/__tests__/areaOfOpsWeather.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/__tests__/areaOfOpsWeather.test.ts`:

```ts
import { buildAreaOfOpsWeather, greatCircleMidpoint } from "../areaOfOpsWeather";
import type { OpenMeteoPointForecast } from "../openMeteoApi";

const mockRaw: OpenMeteoPointForecast = {
  hourly: {
    time: ["2026-05-12T16:00", "2026-05-12T17:00"],
    pressure_msl: [1015, 1016],
    temperature_925hPa: [20, 21],
    temperature_900hPa: [18, 19],
    temperature_850hPa: [14, 15],
    temperature_800hPa: [10, 11],
    temperature_700hPa: [4, 5],
    temperature_600hPa: [-5, -4],
    temperature_500hPa: [-15, -14],
    wind_speed_925hPa: [5, 6],
    wind_speed_900hPa: [6, 7],
    wind_speed_850hPa: [8, 9],
    wind_speed_800hPa: [10, 11],
    wind_speed_700hPa: [14, 15],
    wind_speed_600hPa: [20, 21],
    wind_speed_500hPa: [30, 31],
    wind_direction_925hPa: [350, 351],
    wind_direction_900hPa: [355, 356],
    wind_direction_850hPa: [5, 6],
    wind_direction_800hPa: [10, 11],
    wind_direction_700hPa: [20, 21],
    wind_direction_600hPa: [30, 31],
    wind_direction_500hPa: [40, 41],
    // Heights in metres so heights*3.28084 ft come out roughly: 925→2500, 900→3300, 850→5000, 800→6500, 700→10000, 600→14000, 500→18000
    geopotential_height_925hPa: [762, 762],
    geopotential_height_900hPa: [1006, 1006],
    geopotential_height_850hPa: [1524, 1524],
    geopotential_height_800hPa: [1981, 1981],
    geopotential_height_700hPa: [3048, 3048],
    geopotential_height_600hPa: [4267, 4267],
    geopotential_height_500hPa: [5486, 5486],
  },
};

describe("greatCircleMidpoint", () => {
  it("computes midpoint of equal lat/lon pair as same point", () => {
    expect(greatCircleMidpoint([40, -111], [40, -111])).toEqual([40, -111]);
  });

  it("computes midpoint of two CONUS airports", () => {
    const [lat, lon] = greatCircleMidpoint([40.2, -111.7], [37.1, -113.6]);
    expect(lat).toBeGreaterThan(38);
    expect(lat).toBeLessThan(40);
    expect(lon).toBeGreaterThan(-113.6);
    expect(lon).toBeLessThan(-111.7);
  });
});

describe("buildAreaOfOpsWeather", () => {
  it("uses user position when both coords present", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.positionSource).toBe("user");
    expect(r.position).toEqual([40.5, -112.0]);
  });

  it("falls back to dep/arr midpoint when position blank", () => {
    const r = buildAreaOfOpsWeather({
      position: [null, null],
      depAirportLatLon: [40.2, -111.7],
      arrAirportLatLon: [37.1, -113.6],
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.positionSource).toBe("midpoint");
    expect(r.warnings.some((w) => /position not entered/i.test(w))).toBe(true);
  });

  it("populates 5-altitude wind table from interpolation", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    // wind table has direction[5], speed[5], temp[5]
    expect(r.windsAloft.direction).toHaveLength(5);
    expect(r.windsAloft.speed).toHaveLength(5);
    expect(r.windsAloft.temp).toHaveLength(5);
    expect(r.windsAloft.temp[0]).not.toBeNull();
  });

  it("computes opTemp at user altitude and opAltimeter from pressure_msl", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.opTemp).toBeGreaterThan(0);
    expect(r.opTemp).toBeLessThan(15);
    // 1015 hPa × 0.02953 ≈ 29.97 inHg
    expect(r.opAltimeter).toBeCloseTo(29.97, 2);
  });

  it("returns null op fields and warning when no airport coords either", () => {
    const r = buildAreaOfOpsWeather({
      position: [null, null],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.positionSource).toBe("none");
    expect(r.opTemp).toBeNull();
    expect(r.warnings.some((w) => /skipped/i.test(w))).toBe(true);
  });

  it("warns when forecast time snap delta exceeds 1 hour", () => {
    // mockRaw covers 2026-05-12T16:00 and T17:00; midTime far away → snap
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-13T05:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.warnings.some((w) => /forecast time snapped/i.test(w))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/utils/__tests__/areaOfOpsWeather.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement orchestrator**

Create `src/utils/areaOfOpsWeather.ts`:

```ts
import {
  pickClosestTimeIdx,
  buildSampleAtTime,
  interpolateAtAltitude,
  HPA_TO_INHG,
  type OpenMeteoPointForecast,
} from "./openMeteoApi";

export const TARGET_ALTITUDES_FT = [3000, 6000, 9000, 12000, 15000];

export type AreaOfOpsPositionSource = "user" | "midpoint" | "none";

export interface AreaOfOpsWeather {
  position: [number, number] | null;
  positionSource: AreaOfOpsPositionSource;
  windsAloft: {
    direction: (number | null)[];
    speed: (number | null)[];
    temp: (number | null)[];
  };
  opTemp: number | null;
  opAltimeter: number | null;
  warnings: string[];
}

export function greatCircleMidpoint(
  a: [number, number],
  b: [number, number]
): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a[0]);
  const lon1 = toRad(a[1]);
  const lat2 = toRad(b[0]);
  const dLon = toRad(b[1] - a[1]);
  const Bx = Math.cos(lat2) * Math.cos(dLon);
  const By = Math.cos(lat2) * Math.sin(dLon);
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) ** 2 + By ** 2)
  );
  const lon3 = toRad(a[1]) + Math.atan2(By, Math.cos(lat1) + Bx);
  return [
    Math.round(toDeg(lat3) * 10000) / 10000,
    Math.round(((toDeg(lon3) + 540) % 360) - 180 * 10000) / 10000 + 0,
  ];
}

interface BuildOptions {
  position: [number | null, number | null];
  depAirportLatLon: [number, number] | null;
  arrAirportLatLon: [number, number] | null;
  midTime: Date;
  opAltitudeFt: number | null;
  raw: OpenMeteoPointForecast;
}

const TIME_SNAP_THRESHOLD_MS = 60 * 60 * 1000;

function emptyWindsAloft() {
  return {
    direction: Array(5).fill(null) as (number | null)[],
    speed: Array(5).fill(null) as (number | null)[],
    temp: Array(5).fill(null) as (number | null)[],
  };
}

export function buildAreaOfOpsWeather(opts: BuildOptions): AreaOfOpsWeather {
  const warnings: string[] = [];

  let position: [number, number] | null = null;
  let positionSource: AreaOfOpsPositionSource = "none";

  if (opts.position[0] !== null && opts.position[1] !== null) {
    position = [opts.position[0], opts.position[1]];
    positionSource = "user";
  } else if (opts.depAirportLatLon && opts.arrAirportLatLon) {
    position = greatCircleMidpoint(
      opts.depAirportLatLon,
      opts.arrAirportLatLon
    );
    positionSource = "midpoint";
    warnings.push(
      "Operating area position not entered; using midpoint of departure↔arrival airports"
    );
  } else {
    warnings.push(
      "Operating area weather skipped: position and airport coordinates unavailable"
    );
    return {
      position: null,
      positionSource,
      windsAloft: emptyWindsAloft(),
      opTemp: null,
      opAltimeter: null,
      warnings,
    };
  }

  const { idx, deltaMs } = pickClosestTimeIdx(opts.raw, opts.midTime);
  if (idx < 0) {
    warnings.push("Open-Meteo response had no hourly times");
    return {
      position,
      positionSource,
      windsAloft: emptyWindsAloft(),
      opTemp: null,
      opAltimeter: null,
      warnings,
    };
  }
  if (deltaMs > TIME_SNAP_THRESHOLD_MS) {
    warnings.push(
      `Operating area forecast time snapped to ${
        opts.raw.hourly.time[idx]
      }Z (Δt = ${Math.round(deltaMs / 60000)} min from requested ${opts.midTime
        .toISOString()
        .slice(0, 16)}Z)`
    );
  }

  const sample = buildSampleAtTime(opts.raw, idx);

  const wind = emptyWindsAloft();
  TARGET_ALTITUDES_FT.forEach((alt, i) => {
    const r = interpolateAtAltitude(alt, sample);
    wind.direction[i] = r.wdir;
    wind.speed[i] = r.wspd;
    wind.temp[i] = r.temp;
    warnings.push(...r.warnings);
  });

  let opTemp: number | null = null;
  if (typeof opts.opAltitudeFt === "number" && opts.opAltitudeFt > 0) {
    const r = interpolateAtAltitude(opts.opAltitudeFt, sample);
    opTemp = r.temp;
    warnings.push(...r.warnings);
  }

  const pressureMsl = (opts.raw.hourly.pressure_msl as number[] | undefined)?.[
    idx
  ];
  const opAltimeter =
    typeof pressureMsl === "number"
      ? Math.round(pressureMsl * HPA_TO_INHG * 100) / 100
      : null;

  return {
    position,
    positionSource,
    windsAloft: wind,
    opTemp,
    opAltimeter,
    warnings,
  };
}
```

Note: the `greatCircleMidpoint` longitude line above is brittle — replace it with this clearer normalization:

```ts
  let lonDeg = toDeg(lon3);
  while (lonDeg > 180) lonDeg -= 360;
  while (lonDeg < -180) lonDeg += 360;
  return [
    Math.round(toDeg(lat3) * 10000) / 10000,
    Math.round(lonDeg * 10000) / 10000,
  ];
```

Use that form in the actual implementation.

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx jest src/utils/__tests__/areaOfOpsWeather.test.ts`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/utils/areaOfOpsWeather.ts src/utils/__tests__/areaOfOpsWeather.test.ts
git commit -m "$(cat <<'EOF'
Add areaOfOpsWeather orchestrator

buildAreaOfOpsWeather takes (position, dep/arr lat-lon, midTime, opAltitude,
Open-Meteo raw) and returns winds aloft at 3k/6k/9k/12k/15k MSL, op temp at
user altitude, and op altimeter from pressure_msl. Falls back to great-circle
midpoint when position is blank but airport coords are known. Surfaces
warnings for position fallback, forecast time snapping > 1 hr, and
out-of-range altitudes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B4: Wire area-of-ops fetch into `WeatherDataIntegration` and merge results

**Files:**
- Modify: `src/utils/weatherDataMapper.ts`
- Modify: `src/utils/weatherDataMapper.test.ts`
- Modify: `src/components/WeatherDataIntegration.tsx`

- [ ] **Step 1: Update `mergeWeatherData` to allow operating temp/altimeter writes**

Edit `src/utils/weatherDataMapper.ts`. Find the `mergeWeatherData` function (currently around line 788-885). Replace the `temp` and `altimeter` merging blocks with the simpler version that allows index 1 writes:

```ts
  if (apiData.temp) {
    if (!result.temp) result.temp = [null, null, null];
    apiData.temp.forEach((val, i) => {
      if (val !== undefined && val !== -1) {
        result.temp![i] = val;
      }
    });
  }

  if (apiData.altimeter) {
    if (!result.altimeter) result.altimeter = [null, null, null];
    apiData.altimeter.forEach((val, i) => {
      if (val !== undefined && val !== -1) {
        result.altimeter![i] = val;
      }
    });
  }
```

This removes the deliberate `existingOperatingTemp` / `existingOperatingAltimeter` preservation — operating values are now writeable.

- [ ] **Step 2: Add a regression test for operating temp/altimeter writes**

Add to `src/utils/weatherDataMapper.test.ts`, inside the `describe("mergeWeatherData", ...)` block (find an existing `mergeWeatherData` describe or create one):

```ts
it("writes operating temp[1] and altimeter[1] when API provides them", () => {
  const existing = {
    temp: [10, 12, 14] as [number | null, number | null, number | null],
    altimeter: [29.92, 29.92, 29.92] as [
      number | null,
      number | null,
      number | null
    ],
  };
  const apiData = {
    temp: [20, 22, 24] as [number | null, number | null, number | null],
    altimeter: [30.0, 30.05, 30.1] as [
      number | null,
      number | null,
      number | null
    ],
  };
  const merged = mergeWeatherData(existing, apiData, true);
  expect(merged.temp).toEqual([20, 22, 24]);
  expect(merged.altimeter).toEqual([30.0, 30.05, 30.1]);
});
```

- [ ] **Step 3: Run, verify both pass**

Run: `npx jest src/utils/__tests__/weatherDataMapper.test.ts`
Expected: PASS. (Some pre-existing tests may have asserted that operating values are preserved — those need updating to match the new write-through contract. Update them by removing the expectation that operating values are preserved across `mergeWeatherData` calls.)

- [ ] **Step 4: Add `airport` lat/lon and area-of-ops sub-fetch to `mapWeatherDataToWorksheet`**

Edit `src/utils/weatherDataMapper.ts`. Extend `WeatherMappingOptions`:

```ts
export interface WeatherMappingOptions {
  flightDate?: string;
  flightTime?: string;
  durationHours?: number | null;
  departureAirport?: string;
  arrivalAirport?: string;
  position?: [number | null, number | null];
  opAltitudeFt?: number | null;
  validateData?: boolean;
}
```

Then in `mapWeatherDataToWorksheet`, replace the existing `mapWindTempData` block with a call into the new orchestrator. Find this block (around lines 441-446):

```ts
    if (windTempData.length > 0) {
      const windData = mapWindTempData(windTempData, options);
      result.data = { ...result.data, ...windData };
    } else {
      result.warnings.push("No wind/temperature data available");
    }
```

Delete it. The Open-Meteo path is invoked from `WeatherDataIntegration.tsx` instead (the mapper layer doesn't fetch from Open-Meteo — it merges results passed in). To support that, add a parameter to `mapWeatherDataToWorksheet`:

```ts
export function mapWeatherDataToWorksheet(
  apiData: {
    metar?: METARResponse[];
    taf?: TAFResponse[];
    airport?: AirportResponse[];
  },
  areaOfOps: AreaOfOpsWeather | null,
  options: WeatherMappingOptions = {}
): WeatherMappingResult {
  // ...existing init...

  // areaOfOps wind/temp/altimeter
  if (areaOfOps) {
    if (areaOfOps.windsAloft.direction.some((v) => v !== null)) {
      result.data.wind = [
        areaOfOps.windsAloft.direction,
        areaOfOps.windsAloft.speed,
        areaOfOps.windsAloft.temp,
      ];
    }
    if (areaOfOps.opTemp !== null) {
      if (!result.data.temp) result.data.temp = [-1, -1, -1];
      result.data.temp[1] = areaOfOps.opTemp;
    }
    if (areaOfOps.opAltimeter !== null) {
      if (!result.data.altimeter) result.data.altimeter = [-1, -1, -1];
      result.data.altimeter[1] = areaOfOps.opAltimeter;
    }
    result.warnings.push(...areaOfOps.warnings);
  }

  // ...existing mapAirportSpecificWeatherData call, mapRunwayData, mapAirportElevationData unchanged...
}
```

Also add the import at the top:

```ts
import type { AreaOfOpsWeather } from "./areaOfOpsWeather";
```

- [ ] **Step 5: Wire `WeatherDataIntegration` to fetch Open-Meteo and pass result through**

Edit `src/components/WeatherDataIntegration.tsx`. Add imports:

```ts
import { fetchPointForecast } from "@/utils/openMeteoApi";
import {
  buildAreaOfOpsWeather,
  type AreaOfOpsWeather,
} from "@/utils/areaOfOpsWeather";
```

Inside `fetchWeatherData`, after the existing `getWeatherDataBatch` call but before `mapWeatherDataToWorksheet`, compute and call the orchestrator:

```ts
        // Compute mid-time and op position fallback inputs
        const depDate = new Date(`${worksheetData.date!}T${worksheetData.time!}:00Z`);
        const durationHours = worksheetData.duration ?? 0;
        const midTime = new Date(
          depDate.getTime() + (durationHours / 2) * 3600 * 1000
        );
        const apiAirports = (apiData.airport ?? []) as Array<{
          icaoId: string;
          lat: number;
          lon: number;
        }>;
        const depAirportLatLon =
          apiAirports.find((a) => a.icaoId?.toUpperCase() === departureAirport)
            ?.lat !== undefined
            ? ([
                apiAirports.find(
                  (a) => a.icaoId?.toUpperCase() === departureAirport
                )!.lat,
                apiAirports.find(
                  (a) => a.icaoId?.toUpperCase() === departureAirport
                )!.lon,
              ] as [number, number])
            : null;
        const arrAirportLatLon =
          apiAirports.find((a) => a.icaoId?.toUpperCase() === arrivalAirport)
            ?.lat !== undefined
            ? ([
                apiAirports.find(
                  (a) => a.icaoId?.toUpperCase() === arrivalAirport
                )!.lat,
                apiAirports.find(
                  (a) => a.icaoId?.toUpperCase() === arrivalAirport
                )!.lon,
              ] as [number, number])
            : null;

        // Compute opPosition for the Open-Meteo lat/lon (use user position if set, else airport midpoint)
        const opPos: [number, number] | null =
          worksheetData.position?.[0] !== null &&
          worksheetData.position?.[1] !== null
            ? [worksheetData.position![0]!, worksheetData.position![1]!]
            : depAirportLatLon && arrAirportLatLon
            ? [
                (depAirportLatLon[0] + arrAirportLatLon[0]) / 2,
                (depAirportLatLon[1] + arrAirportLatLon[1]) / 2,
              ]
            : null;

        let areaOfOps: AreaOfOpsWeather | null = null;
        if (opPos) {
          const window = {
            start: new Date(midTime.getTime() - 24 * 3600 * 1000),
            end: new Date(midTime.getTime() + 24 * 3600 * 1000),
          };
          try {
            const raw = await fetchPointForecast(opPos[0], opPos[1], window);
            areaOfOps = buildAreaOfOpsWeather({
              position: worksheetData.position ?? [null, null],
              depAirportLatLon,
              arrAirportLatLon,
              midTime,
              opAltitudeFt: worksheetData.altitude?.[1] ?? null,
              raw,
            });
          } catch (err) {
            console.warn("Open-Meteo fetch failed:", err);
          }
        }
```

Then change the `mapWeatherDataToWorksheet` call to pass `areaOfOps`:

```ts
        const mappingResult = mapWeatherDataToWorksheet(apiData, areaOfOps, {
          flightDate: worksheetData.date!,
          flightTime: worksheetData.time!,
          durationHours: worksheetData.duration ?? null,
          departureAirport,
          arrivalAirport,
          validateData: true,
        });
```

Also remove `includeWindTemp: true,` from the `getWeatherDataBatch` call options.

- [ ] **Step 6: Run all tests + lint + typecheck**

Run: `npm test -- --silent && npm run lint && npx tsc --noEmit`
Expected: any tests using `mapWeatherDataToWorksheet` need their signature updated to pass `areaOfOps: null` (or a fixture). Update each call site in tests; the new signature is `mapWeatherDataToWorksheet(apiData, areaOfOps, options)`.

- [ ] **Step 7: Commit**

```bash
git add src/utils/weatherDataMapper.ts src/utils/__tests__/weatherDataMapper.test.ts src/components/WeatherDataIntegration.tsx
git commit -m "$(cat <<'EOF'
Wire Open-Meteo into the weather-fetch pipeline

WeatherDataIntegration now computes operating midpoint time, op position
(user-entered or airport midpoint), fetches Open-Meteo at that
lat/lon/time-window, runs buildAreaOfOpsWeather, and passes the result
through mapWeatherDataToWorksheet. Updates merge logic so temp[1] /
altimeter[1] are now writeable from the area-of-ops source.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B5: Delete the windtemp code path

**Files:**
- Modify: `src/utils/aviationWeatherApi.ts`
- Modify: `src/utils/aviationWeatherApi.test.ts`
- Modify: `src/app/api/aviation-weather/route.ts`
- Modify: `src/utils/weatherDataMapper.ts`
- Modify: `src/utils/weatherDataMapper.test.ts`
- Delete: `src/utils/windTempParser.ts`
- Delete: `src/utils/__tests__/windTempParser.test.ts`

- [ ] **Step 1: Remove `getWindTemp` and `WindTempResponse` from `aviationWeatherApi.ts`**

Edit `src/utils/aviationWeatherApi.ts`. Delete:
- `WindTempResponse` interface (lines 110-118)
- `getWindTemp` function (lines 327-340)
- `WindTempResponse` from the `getWeatherDataBatch` return type and `includeWindTemp` parameter (multiple lines, ~344-432).

The `getWeatherDataBatch` simplification: drop the `includeWindTemp` branch entirely. The result type becomes:

```ts
export async function getWeatherDataBatch(
  airports: string[],
  options: {
    includeMETAR?: boolean;
    includeTAF?: boolean;
    includeAirport?: boolean;
    metarHours?: number;
    tafHours?: number;
  } = {}
): Promise<{
  metar?: METARResponse[];
  taf?: TAFResponse[];
  airport?: AirportResponse[];
}> {
  // ...drop the windTemp branch entirely...
}
```

- [ ] **Step 2: Update `aviationWeatherApi.test.ts`**

Edit `src/utils/aviationWeatherApi.test.ts`. Remove the import of `getWindTemp` and `WindTempResponse`. Delete the `describe("getWindTemp", ...)` block. Delete `includeWindTemp` from any `getWeatherDataBatch` test calls.

- [ ] **Step 3: Remove the windtemp branch from the proxy route**

Edit `src/app/api/aviation-weather/route.ts`. Remove the import of `parseWindTempData` (line 7) and delete the `if (endpoint === "windtemp")` branch in the text-handling section (around lines 104-112). The remaining text branch becomes:

```ts
    } else {
      // Plain text response (legacy endpoints we don't actively use anymore)
      const textData = await response.text();
      try {
        data = JSON.parse(textData);
      } catch {
        data = { raw: textData };
      }
    }
```

- [ ] **Step 4: Remove `mapWindTempData` and `TARGET_ALTITUDES` from `weatherDataMapper.ts`**

Edit `src/utils/weatherDataMapper.ts`. Delete:
- `TARGET_ALTITUDES` constant
- `mapWindTempData` function (lines 47-91)
- The `WindTempResponse` import and `windTemp` from the `apiData` shape in `mapWeatherDataToWorksheet`
- `findClosestAltitudeData` (lines 497-574)

The `mapWeatherDataToWorksheet` signature was already updated in Task B4 to take an `apiData` shape without `windTemp`. Confirm the signature matches:

```ts
export function mapWeatherDataToWorksheet(
  apiData: {
    metar?: METARResponse[];
    taf?: TAFResponse[];
    airport?: AirportResponse[];
  },
  areaOfOps: AreaOfOpsWeather | null,
  options: WeatherMappingOptions = {}
): WeatherMappingResult
```

- [ ] **Step 5: Update `weatherDataMapper.test.ts` to remove windtemp coverage**

Edit `src/utils/__tests__/weatherDataMapper.test.ts`. Remove:
- The import of `mapWindTempData` and `TARGET_ALTITUDES`
- The `describe("mapWindTempData", ...)` block
- The `WindTempResponse` import
- Any `windTemp:` field passed to `mapWeatherDataToWorksheet` test fixtures

- [ ] **Step 6: Delete `windTempParser.ts` and its tests**

```bash
rm src/utils/windTempParser.ts src/utils/__tests__/windTempParser.test.ts
```

- [ ] **Step 7: Run full test + lint + typecheck + build**

Run: `npm test -- --silent && npm run lint && npx tsc --noEmit && npm run build`
Expected: all green. Address any leftover references found by typecheck.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Delete legacy windtemp data path

The SLC-hardcoded windtemp pipeline is replaced by Open-Meteo (GFS)
in the area-of-ops path. Removes getWindTemp, WindTempResponse,
mapWindTempData, TARGET_ALTITUDES, findClosestAltitudeData, the
windtemp branch in the proxy route, and the windTempParser module
plus its tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B6: Phase B end-of-PR verification

- [ ] **Step 1: Manual smoke test with dev server**

```bash
npm run dev
```

Open http://localhost:3000. Set a sortie:
- Two real airports (e.g. KPVU, KSGU)
- Date today/tomorrow, time 1500Z, duration 3 hours
- Operating altitude 9000 ft
- Position blank

Click "Fetch Weather". Verify:
- Wind table fills with values that vary across altitudes (no longer hardcoded SLC)
- Operating temp (`temp[1]`) populates
- Operating altimeter (`altimeter[1]`) populates
- Warnings panel mentions "midpoint of departure↔arrival airports"

Then enter a position (e.g. `38.0/-113.0`) and refetch — confirm winds change and the midpoint warning disappears.

Stop dev server.

- [ ] **Step 2: Verify all checks**

```bash
npm test -- --silent
npm run lint
npx tsc --noEmit
npm run build
```

- [ ] **Step 3: Open PR 2** (skip if integrated branch)

```bash
git push
gh pr create --title "Issue #56 (2/3): Open-Meteo aloft + area-of-ops weather, retire windtemp" --body "$(cat <<'EOF'
## Summary
- New /api/open-meteo proxy + openMeteoApi client with altitude bracketing
- areaOfOpsWeather orchestrator: position fallback to airport midpoint, op temp at user altitude, op altimeter from pressure_msl
- Wires into WeatherDataIntegration; mapWeatherDataToWorksheet now takes an areaOfOps argument
- mergeWeatherData: temp[1] and altimeter[1] are now writeable
- Deletes windTempParser, getWindTemp, mapWindTempData, TARGET_ALTITUDES, findClosestAltitudeData, and the windtemp proxy branch

Spec: docs/superpowers/specs/2026-05-10-weather-data-improvements-design.md (Phase B)

## Test plan
- [ ] All existing tests pass; new openMeteoApi and areaOfOpsWeather suites green
- [ ] Manual: winds vary by altitude using real airport pair
- [ ] Manual: operating temp/altimeter populate
- [ ] Manual: blank position falls back to midpoint with warning
- [ ] Manual: entered position changes winds and clears the midpoint warning

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase C — G-AIRMET auto-flag

Phase C goal: turbulence (TURB), ceiling/vis (IFR), and mountain obscuration (MTN OBSC) checkboxes auto-toggle based on G-AIRMET polygons covering the operating position at the midpoint time.

### Task C1: `gairmetApi` with point-in-polygon

**Files:**
- Create: `src/utils/gairmetApi.ts`
- Test: `src/utils/__tests__/gairmetApi.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/__tests__/gairmetApi.test.ts`:

```ts
import { pointInPolygon, classifyAirmets, type GAirmetFeature } from "../gairmetApi";

describe("pointInPolygon", () => {
  const square: [number, number][] = [
    [40, -113],
    [42, -113],
    [42, -111],
    [40, -111],
    [40, -113],
  ];

  it("detects interior point", () => {
    expect(pointInPolygon([41, -112], square)).toBe(true);
  });

  it("detects exterior point", () => {
    expect(pointInPolygon([45, -112], square)).toBe(false);
  });

  it("works on concave polygon", () => {
    const concave: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [2, 2],
      [0, 4],
      [0, 0],
    ];
    // (1,3) is inside the concave bay's left lobe
    expect(pointInPolygon([1, 3], concave)).toBe(true);
    // (3, 3) is in the concave indent (above the (2,2) notch) — outside
    expect(pointInPolygon([3, 3], concave)).toBe(false);
  });
});

describe("classifyAirmets", () => {
  const turbAirmet: GAirmetFeature = {
    hazard: "TURB",
    validTime: "2026-05-12T16:00:00.000Z",
    forecastHour: 0,
    geom: "AREA",
    coords: [
      { lat: "40", lon: "-113" },
      { lat: "42", lon: "-113" },
      { lat: "42", lon: "-111" },
      { lat: "40", lon: "-111" },
      { lat: "40", lon: "-113" },
    ],
  };
  const mtnObscAirmet: GAirmetFeature = {
    ...turbAirmet,
    hazard: "MTN OBSC",
  };
  const ifrAirmet: GAirmetFeature = {
    ...turbAirmet,
    hazard: "IFR",
  };

  it("flags hazards whose polygon contains the position", () => {
    const r = classifyAirmets(
      [turbAirmet, mtnObscAirmet, ifrAirmet],
      [41, -112],
      new Date("2026-05-12T16:00:00Z")
    );
    expect(r.turb).toBe(true);
    expect(r.mtnObsc).toBe(true);
    expect(r.cielVis).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("does not flag hazards whose polygon excludes the position", () => {
    const r = classifyAirmets(
      [turbAirmet, mtnObscAirmet],
      [50, -100],
      new Date("2026-05-12T16:00:00Z")
    );
    expect(r.turb).toBe(false);
    expect(r.mtnObsc).toBe(false);
    expect(r.cielVis).toBe(false);
  });

  it("filters AIRMETs by validTime closest to midTime", () => {
    const closer: GAirmetFeature = {
      ...turbAirmet,
      validTime: "2026-05-12T16:00:00.000Z",
    };
    const farther: GAirmetFeature = {
      ...turbAirmet,
      validTime: "2026-05-12T22:00:00.000Z",
      coords: [
        { lat: "0", lon: "0" },
        { lat: "1", lon: "0" },
        { lat: "1", lon: "1" },
        { lat: "0", lon: "1" },
        { lat: "0", lon: "0" },
      ],
    };
    const r = classifyAirmets(
      [closer, farther],
      [41, -112],
      new Date("2026-05-12T16:00:00Z")
    );
    expect(r.turb).toBe(true);
  });

  it("warns when no AIRMET set within 3 hr of midTime", () => {
    const r = classifyAirmets(
      [turbAirmet],
      [41, -112],
      new Date("2026-06-01T00:00:00Z")
    );
    expect(r.warnings.some((w) => /unavailable/i.test(w))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/utils/__tests__/gairmetApi.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `gairmetApi.ts`**

Create `src/utils/gairmetApi.ts`:

```ts
const BASE_URL = "/api/aviation-weather";

export interface GAirmetCoord {
  lat: string;
  lon: string;
}

export interface GAirmetFeature {
  hazard: "TURB" | "IFR" | "MTN OBSC" | "ICE" | "LLWS" | "SFC_WND" | string;
  validTime: string;
  forecastHour: number;
  geom: "AREA" | string;
  coords: GAirmetCoord[];
}

export interface AirmetClassification {
  turb: boolean | null;
  cielVis: boolean | null;
  mtnObsc: boolean | null;
  warnings: string[];
}

const VALID_TIME_THRESHOLD_MS = 3 * 60 * 60 * 1000;

export async function fetchGAirmets(): Promise<GAirmetFeature[]> {
  const url = `${BASE_URL}?endpoint=gairmet&format=json`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`G-AIRMET fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? (json as GAirmetFeature[]) : [];
}

export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  const [pLat, pLon] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [iLat, iLon] = polygon[i];
    const [jLat, jLon] = polygon[j];
    const intersect =
      iLon > pLon !== jLon > pLon &&
      pLat < ((jLat - iLat) * (pLon - iLon)) / (jLon - iLon) + iLat;
    if (intersect) inside = !inside;
  }
  return inside;
}

function airmetCoords(a: GAirmetFeature): [number, number][] {
  return a.coords.map((c) => [Number(c.lat), Number(c.lon)]);
}

export function classifyAirmets(
  features: GAirmetFeature[],
  position: [number, number],
  midTime: Date
): AirmetClassification {
  const warnings: string[] = [];
  const targetMs = midTime.getTime();
  const eligible = features.filter((f) =>
    ["TURB", "IFR", "MTN OBSC"].includes(f.hazard)
  );
  if (eligible.length === 0) {
    warnings.push(
      `No G-AIRMETs available for ${midTime.toISOString()}; turb / cielVis / mtnObsc flags not updated`
    );
    return { turb: null, cielVis: null, mtnObsc: null, warnings };
  }

  // Pick best validTime per hazard
  const byHazard = new Map<string, GAirmetFeature[]>();
  for (const f of eligible) {
    const list = byHazard.get(f.hazard) ?? [];
    list.push(f);
    byHazard.set(f.hazard, list);
  }

  const result: AirmetClassification = {
    turb: false,
    cielVis: false,
    mtnObsc: false,
    warnings,
  };

  let anyWithinThreshold = false;
  for (const [hazard, list] of byHazard.entries()) {
    // Sort by abs delta from midTime
    const sorted = [...list].sort(
      (a, b) =>
        Math.abs(Date.parse(a.validTime) - targetMs) -
        Math.abs(Date.parse(b.validTime) - targetMs)
    );
    const bestDelta = Math.abs(Date.parse(sorted[0].validTime) - targetMs);
    if (bestDelta > VALID_TIME_THRESHOLD_MS) continue;
    anyWithinThreshold = true;

    // Find the best valid time (closest), then test all AIRMETs at that time for PIP
    const bestTime = sorted[0].validTime;
    const atBestTime = list.filter((f) => f.validTime === bestTime);
    const hit = atBestTime.some((f) =>
      pointInPolygon(position, airmetCoords(f))
    );
    if (hazard === "TURB") result.turb = hit;
    if (hazard === "MTN OBSC") result.mtnObsc = hit;
    if (hazard === "IFR") result.cielVis = hit;
  }

  if (!anyWithinThreshold) {
    warnings.push(
      `No G-AIRMET set within 3 hr of ${midTime.toISOString()}; turb / cielVis / mtnObsc flags not updated`
    );
    return { turb: null, cielVis: null, mtnObsc: null, warnings };
  }
  return result;
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx jest src/utils/__tests__/gairmetApi.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/utils/gairmetApi.ts src/utils/__tests__/gairmetApi.test.ts
git commit -m "$(cat <<'EOF'
Add G-AIRMET fetch and ray-casting point-in-polygon classifier

fetchGAirmets calls /api/aviation-weather?endpoint=gairmet&format=json.
classifyAirmets selects the AIRMET set whose validTime is closest to
midTime (warning if > 3 hr off), runs PIP for each of TURB / IFR /
MTN OBSC, and returns booleans for turb / cielVis / mtnObsc.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task C2: Wire G-AIRMET into the pipeline + always-overwrite merge semantics

**Files:**
- Modify: `src/utils/weatherDataMapper.ts`
- Modify: `src/utils/weatherDataMapper.test.ts`
- Modify: `src/components/WeatherDataIntegration.tsx`

- [ ] **Step 1: Update `mergeWeatherData` to overwrite AIRMET booleans when provided**

Edit `src/utils/weatherDataMapper.ts`. In `mergeWeatherData`, add the AIRMET overwrite block (place it before the `return result;`):

```ts
  if (apiData.turb !== undefined && apiData.turb !== null) {
    result.turb = apiData.turb as boolean;
  }
  if (apiData.cielVis !== undefined && apiData.cielVis !== null) {
    result.cielVis = apiData.cielVis as boolean;
  }
  if (apiData.mtnObsc !== undefined && apiData.mtnObsc !== null) {
    result.mtnObsc = apiData.mtnObsc as boolean;
  }
```

(Sentinel: `null` means "don't update" — the AIRMET fetch failed; `false` means "AIRMET says no".)

- [ ] **Step 2: Add a regression test for AIRMET always-overwrite**

Add to `weatherDataMapper.test.ts` inside `describe("mergeWeatherData", ...)`:

```ts
it("overwrites turb/cielVis/mtnObsc to false when API explicitly says false", () => {
  const existing = { turb: true, cielVis: true, mtnObsc: true };
  const apiData = { turb: false, cielVis: false, mtnObsc: false };
  const merged = mergeWeatherData(existing, apiData, true);
  expect(merged.turb).toBe(false);
  expect(merged.cielVis).toBe(false);
  expect(merged.mtnObsc).toBe(false);
});

it("leaves turb/cielVis/mtnObsc untouched when API value is null", () => {
  const existing = { turb: true, cielVis: false, mtnObsc: true };
  const apiData = { turb: null, cielVis: null, mtnObsc: null } as Partial<
    Record<"turb" | "cielVis" | "mtnObsc", boolean | null>
  >;
  const merged = mergeWeatherData(existing, apiData as Partial<typeof existing>, true);
  expect(merged.turb).toBe(true);
  expect(merged.cielVis).toBe(false);
  expect(merged.mtnObsc).toBe(true);
});
```

- [ ] **Step 3: Pipe G-AIRMET classification through `mapWeatherDataToWorksheet`**

Edit `src/utils/weatherDataMapper.ts`. Add a new parameter:

```ts
export function mapWeatherDataToWorksheet(
  apiData: {
    metar?: METARResponse[];
    taf?: TAFResponse[];
    airport?: AirportResponse[];
  },
  areaOfOps: AreaOfOpsWeather | null,
  airmets: import("./gairmetApi").AirmetClassification | null,
  options: WeatherMappingOptions = {}
): WeatherMappingResult {
  // ... existing body ...

  if (airmets) {
    if (airmets.turb !== null) (result.data as Partial<WorksheetData>).turb = airmets.turb;
    if (airmets.cielVis !== null)
      (result.data as Partial<WorksheetData>).cielVis = airmets.cielVis;
    if (airmets.mtnObsc !== null)
      (result.data as Partial<WorksheetData>).mtnObsc = airmets.mtnObsc;
    result.warnings.push(...airmets.warnings);
  }

  // ... return ...
}
```

- [ ] **Step 4: Wire G-AIRMET fetch into `WeatherDataIntegration`**

Edit `src/components/WeatherDataIntegration.tsx`. Add imports:

```ts
import { fetchGAirmets, classifyAirmets, type AirmetClassification } from "@/utils/gairmetApi";
```

Inside `fetchWeatherData`, after computing `opPos` and `midTime` and before calling `mapWeatherDataToWorksheet`, fetch and classify AIRMETs:

```ts
        let airmets: AirmetClassification | null = null;
        if (opPos) {
          try {
            const features = await fetchGAirmets();
            airmets = classifyAirmets(features, opPos, midTime);
          } catch (err) {
            console.warn("G-AIRMET fetch failed:", err);
          }
        }
```

Update the `mapWeatherDataToWorksheet` call to include the new arg:

```ts
        const mappingResult = mapWeatherDataToWorksheet(
          apiData,
          areaOfOps,
          airmets,
          {
            flightDate: worksheetData.date!,
            flightTime: worksheetData.time!,
            durationHours: worksheetData.duration ?? null,
            departureAirport,
            arrivalAirport,
            validateData: true,
          }
        );
```

- [ ] **Step 5: Run all checks**

Run: `npm test -- --silent && npm run lint && npx tsc --noEmit && npm run build`
Expected: any test fixture using `mapWeatherDataToWorksheet(apiData, areaOfOps, options)` needs an inserted `null` for the new airmets arg. Update each call site accordingly.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Auto-flag turb / cielVis / mtnObsc from G-AIRMETs

WeatherDataIntegration fetches G-AIRMETs alongside the existing batch
and runs classifyAirmets at the operating position and midpoint time.
mergeWeatherData overwrites the three booleans when the API result is
non-null; null means the AIRMET fetch failed and existing values are
preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task C3: Phase C end-of-PR verification

- [ ] **Step 1: Manual smoke test**

```bash
npm run dev
```

Open http://localhost:3000. Set a sortie in a region with active AIRMETs (e.g. SLC area during winter or any time of year). Click "Fetch Weather".

Verify:
- The three checkboxes auto-update based on AIRMETs over the operating position
- Manually checking one then refetching results in it being unchecked if the AIRMET says so
- If the gairmet fetch fails (test by temporarily breaking the proxy URL), the checkboxes are left untouched

- [ ] **Step 2: Verify all checks**

```bash
npm test -- --silent
npm run lint
npx tsc --noEmit
npm run build
```

- [ ] **Step 3: Open PR 3** (skip if integrated branch)

```bash
git push
gh pr create --title "Issue #56 (3/3): G-AIRMET auto-flag for turb / cielVis / mtnObsc" --body "$(cat <<'EOF'
## Summary
- New gairmetApi: fetchGAirmets + ray-casting pointInPolygon + classifyAirmets
- WeatherDataIntegration fetches G-AIRMETs at op position / mid-time
- mergeWeatherData overwrites the three booleans on each fetch (null sentinel preserves existing values when AIRMET fetch failed)

Spec: docs/superpowers/specs/2026-05-10-weather-data-improvements-design.md (Phase C)

## Test plan
- [ ] All existing tests pass; new gairmetApi suite green
- [ ] Manual: AIRMETs over op position toggle the checkboxes
- [ ] Manual: refetching when AIRMETs no longer cover position unchecks the boxes
- [ ] Manual: G-AIRMET fetch failure does not toggle the boxes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

After writing this plan, reviewed against the spec:

- **Phase A** covers spec sections "Per-airport time-aware weather", "Stale-forecast warning UX", and the merge-semantics change for `temp`/`altimeter` updates from per-airport time selection.
- **Phase B** covers "Open-Meteo client and altitude interpolation", "Position fallback", and the `temp[1]`/`altimeter[1]` merge change. Also handles the spec's "Modules deleted" list (windtemp paths).
- **Phase C** covers "G-AIRMET point-in-polygon" and the always-overwrite merge semantics for the three booleans.
- The spec's testing strategy maps to: A1 / A4 / A5 unit + component tests; B1 / B2 / B3 unit + route tests; C1 / C2 unit + merge-regression tests.
- Type consistency: `AirportWeatherSource`, `AreaOfOpsWeather`, `AirmetClassification`, `OpenMeteoPointForecast` are defined in their own modules and consumed by name in subsequent tasks.
- No placeholders. Every code-changing step shows the exact code or an explicit edit instruction with file/line locations.
