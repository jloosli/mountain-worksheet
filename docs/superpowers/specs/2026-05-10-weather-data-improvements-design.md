# Weather Data Improvements (Issue #56) — Design

## Background

The current "Fetch Weather" pipeline has three accuracy problems:

1. **Departure and arrival surface weather use a single combined `flightDate` + `flightTime` for TAF period selection.** `selectTAFForFlightTime` (in `weatherDataMapper.ts`) is called once with the departure datetime, so the arrival airport's temp / altimeter come from the TAF period covering the *departure* time, not the actual arrival time. For multi-hour sorties this is materially wrong.

2. **Winds aloft are hardcoded to the SLC FD station and the legacy NWS `windtemp` text product.** `windTempParser.ts:79` literally `line.startsWith("SLC")`. Pilots flying anywhere outside the immediate SLC area get wrong winds. The legacy FD product also has very coarse spatial granularity (~50–200 mi between stations).

3. **Operating-area `temp[1]` / `altimeter[1]` are not populated at all.** The merge logic in `mergeWeatherData` intentionally preserves them as manual-entry only.

In addition, the AIRMET-related checkboxes (turbulence, ceiling/vis, mountain obscuration) are manual-entry only, even though G-AIRMET polygons are programmatically available.

## Goals

- Fetch dep / arr surface weather using each airport's actual planned time (dep time and dep + duration).
- Fetch area-of-ops winds aloft, temperature aloft, and operating altimeter using the actual operating position and the operating midpoint time.
- Auto-set the three AIRMET checkboxes by point-in-polygon test against G-AIRMETs valid at the midpoint time.
- When a forecast does not cover the requested time, populate using the nearest available data and surface a warning to the pilot.
- Replace the legacy `/api/data/windtemp` data path entirely.

## Non-goals

- No change to surface wind on the worksheet (worksheet has no surface-wind field).
- No change to runway / airport-elevation auto-population.
- No SIGMET / CWA / G-AIRMET icing / LLWS handling — only the three flags the worksheet already has.
- No offline / persistent forecast cache; per-fetch network calls only.

## Data sources after this work

| Worksheet field | Source | Endpoint |
|---|---|---|
| `temp[0]`, `altimeter[0]` (dep at dep time) | AviationWeather METAR + TAF | `/api/data/metar`, `/api/data/taf` (existing) |
| `temp[2]`, `altimeter[2]` (arr at dep + duration) | AviationWeather METAR + TAF | same |
| `wind[0..2][0..4]` (3k / 6k / 9k / 12k / 15k MSL) at midpoint | Open-Meteo GFS | `api.open-meteo.com/v1/gfs` |
| `temp[1]` (op temp at `altitude[1]`) at midpoint | Open-Meteo GFS | same call |
| `altimeter[1]` (op altimeter) at midpoint | Open-Meteo `pressure_msl` | same call |
| `turb`, `cielVis`, `mtnObsc` at midpoint | AviationWeather G-AIRMET | `/api/data/gairmet` |
| `rwy[]`, `altitude[0]`, `altitude[2]` | AviationWeather airport | unchanged |

Open-Meteo's `/v1/gfs` is a free JSON wrapper around NOAA GFS — the same upstream forecast NOMADS serves as raw GRIB2.

## Architecture

### New modules

- `src/app/api/open-meteo/route.ts` — thin proxy mirroring the existing `aviation-weather/route.ts` (avoid CORS, allow short server-side caching).
- `src/utils/openMeteoApi.ts` — typed client. Returns the raw `OpenMeteoPointForecast` shape; no business logic.
- `src/utils/airportTimeWeather.ts` — `selectAirportWeather(metar, taf, requestedTimeUtc) → AirportWeatherAtTime`. Replaces today's single-time `selectTAFForFlightTime`.
- `src/utils/areaOfOpsWeather.ts` — orchestration for the operating area: takes `(position, depAirportLatLon, arrAirportLatLon, midTime, opAltitudeFt, openMeteoRaw)`, returns `{ windsAloft, opTemp, opAltimeter, positionSource, warnings }`.
- `src/utils/gairmetApi.ts` — fetches `/api/data/gairmet`, runs ray-casting point-in-polygon, returns `{ turb, cielVis, mtnObsc, warnings }`. Inline PIP — no geo-library dependency.
- `src/components/WeatherWarningsPanel.tsx` — amber warning list under the existing weather data box.

### Modules refactored

- `src/utils/weatherDataMapper.ts` becomes the merger only. The big `mapWeatherDataToWorksheet` dispatcher is rewritten to call the new per-source helpers and aggregate `warnings`. `mergeWeatherData` is updated so `temp[1]` and `altimeter[1]` are now writeable (from the area-of-ops source) and the AIRMET booleans are always overwritten on fetch.
- `src/components/WeatherDataIntegration.tsx` runs the full pipeline via `Promise.allSettled` over the four parallel sub-fetches (dep, arr, op, AIRMETs) and renders `WeatherWarningsPanel` for the aggregated warnings.

### Modules deleted

- `src/utils/windTempParser.ts`
- `getWindTemp()` and the `windtemp` parameter in `getWeatherDataBatch` (`src/utils/aviationWeatherApi.ts`)
- `mapWindTempData()` and `selectTAFForFlightTime` (`src/utils/weatherDataMapper.ts`)
- The `endpoint === "windtemp"` branch in `src/app/api/aviation-weather/route.ts`

## Per-fetch data flow

Inputs from the worksheet at click time:
`airport=[dep,arr]`, `date`, `time` (UTC), `duration` hours, `position=[lat|null, lon|null]`, `altitude[1]` ft.

```
Compute times:
  depTime = parse(date, time)
  arrTime = depTime + duration
  midTime = depTime + duration / 2

Compute op position:
  opPos = position[0,1] if both non-null
        else greatCircleMidpoint(depAirportLatLon, arrAirportLatLon)
  positionSource = "user" | "midpoint"
  (if dep/arr lat/lon also unavailable, area-of-ops sub-fetch is skipped with a warning)

Promise.allSettled:
  (1) getAirportInfo([dep, arr])         // existing — runways, elevations, lat/lon for fallback
  (2) airportWeatherAtTime(dep, depTime) // METAR + TAF, pick fcst period containing depTime
  (3) airportWeatherAtTime(arr, arrTime) // same with arrTime
  (4) openMeteoPointForecast(opPos, midTime) → buildAreaOfOpsWeather(...)
  (5) fetchGAirmets(midTime) → point-in-polygon at opPos for {TURB, IFR, MTN OBSC}

Merge → WorksheetData partial → mergeWeatherData(...)
Aggregate warnings → WeatherWarningsPanel
```

## Per-airport time-aware weather

`selectAirportWeather(metar, taf, requestedTimeUtc) → AirportWeatherAtTime` with decision order:

1. If `requestedTime` is within ~90 min of METAR `obsTime` → use METAR (live observation beats forecast).
2. Else if a TAF `fcsts[]` entry's `[timeFrom, timeTo)` covers `requestedTime` → use that period's `wdir / wspd / temp / altim`.
3. If the matched TAF period has no `temp`, fall back to the METAR `temp` and emit `"forecast period has no temperature; using current observation (Δt = N hr)"`.
4. If no TAF period covers the time, pick the chronologically closest period and emit `"forecast unavailable for <iso>; using nearest TAF period at <iso> (Δt)"`.
5. If neither METAR nor TAF data exists for the airport, return `{ temp: null, altimeter: null, source: "none" }` with a warning.

`altimeter` unit handling stays as today — METAR `altim` is hectopascals (`× 0.0295299` → inHg, 2 decimals); TAF `altim` is inHg directly.

## Open-Meteo client and altitude interpolation

Request URL pattern (built by `openMeteoApi.ts`, called via the new proxy):

```
/api/open-meteo?latitude=37.5&longitude=-113.2
  &start_date=2026-05-12&end_date=2026-05-13
  &wind_speed_unit=kn&temperature_unit=celsius
  &hourly=pressure_msl,
          temperature_925hPa,...,temperature_500hPa,
          wind_speed_925hPa,...,wind_speed_500hPa,
          wind_direction_925hPa,...,wind_direction_500hPa,
          geopotential_height_925hPa,...,geopotential_height_500hPa
```

Pressure levels requested: `925, 900, 850, 800, 700, 600, 500`. These bracket all worksheet altitudes (~2.5k–18.3k ft) for typical CONUS conditions.

Date range: `start_date = midTime - 1d`, `end_date = midTime + 1d` (covers timezone edges and gives nearest-available fallback room).

For each target altitude `target_ft` ∈ `{3000, 6000, 9000, 12000, 15000}` and for `altitude[1]`:

1. Pick `hourly.time` index `i` closest to `midTime` (warn if Δt > 1 hr).
2. For each pressure level `L`, read `geopotential_height_LhPa[i]` (m × 3.28084 → ft).
3. Find `L_low`, `L_high` whose heights bracket `target_ft`. If target is above the highest level or below the lowest, snap to the boundary level and emit a warning.
4. Interpolate temp + wind speed linearly with `f = (target_ft − height_low_ft) / (height_high_ft − height_low_ft)`.
5. Wind direction: circular interpolation handling 360° wrap (reuse the algorithm in `weatherDataMapper.ts:findClosestAltitudeData:530-541`).
6. Round all results to integers.

`opAltimeter = pressure_msl[i] × 0.02953`, rounded to 2 decimals. (`0.02953` matches the conversion factor already in `mapAirportSpecificWeatherData`.)

`opTemp` uses the same bracketing routine but against the user's `altitude[1]` value, not a fixed wind row.

Open-Meteo wind direction is "from", in degrees true — same as the worksheet, no conversion needed.

## G-AIRMET point-in-polygon

`fetchGAirmets(midTime) → { turb, cielVis, mtnObsc, warnings }`

`/api/data/gairmet?format=json` returns all current AIRMETs. Filter to `hazard ∈ {"TURB", "IFR", "MTN OBSC"}` and pick the AIRMET set whose `validTime` is closest to `midTime` (warn if Δt > 3 hr).

For each remaining AIRMET, run ray-casting PIP against the operating position. Hazard-to-field mapping:

| Field | Hazard |
|---|---|
| `turb` | `TURB` (AIRMET Tango) |
| `cielVis` | `IFR` (AIRMET Sierra IFR — ceil < 1000 ft / vis < 3 sm) |
| `mtnObsc` | `MTN OBSC` (AIRMET Sierra MTN OBSC) |

Note: the worksheet labels `cielVis` as "Ceiling and Vis < 10sm/2000′" — that VFR-marginal threshold is broader than the G-AIRMET IFR threshold. We map IFR to this field and surface a one-line note in the warnings panel: `"AIRMET IFR auto-flag uses 1000 ft / 3 sm threshold, not the worksheet's 2000 ft / 10 sm threshold"`.

Always-overwrite semantics on fetch (matches how winds and temps already work). If the G-AIRMET fetch fails entirely, the three booleans are left untouched (no toggle-off on fetch failure).

Ray-casting PIP is implemented inline; ~30 LOC; not worth a geo dependency.

## Position fallback

`buildOpPosition(position, depAirportLatLon, arrAirportLatLon)`:

- Both lat and lon non-null → `positionSource: "user"`, return as-is.
- Position blank but both airport lat/lons known → great-circle midpoint, `positionSource: "midpoint"`, emit `"Operating area position not entered; using midpoint of <DEP>↔<ARR>"`.
- Position blank and any airport lat/lon missing → skip area-of-ops sub-fetch entirely, emit `"Operating area weather skipped: position and airport coordinates unavailable"`. Other sub-fetches still run.

Great-circle midpoint formula (standard `atan2`-based; no third-party dep needed).

## Stale-forecast warning UX

Each per-source helper returns its own `warnings: string[]`. The orchestrator collects all warnings into a single array on `WeatherDataIntegration`'s state. `WeatherWarningsPanel` renders them under the existing "Aviation Weather Data" box: amber background, list of bullets, persistent until the next fetch (no dismiss button needed — fresh fetch replaces the list).

Examples (literal format):

- `"Departure forecast unavailable for 2026-05-20T17:00Z; using nearest TAF period at 2026-05-15T18:00Z (Δt = 5 d)"`
- `"Operating area winds: forecast time snapped to 2026-05-12T16:00Z (30 min off requested 16:30Z)"`
- `"Operating area position not entered; using midpoint of KPVU↔KSGU"`
- `"AIRMET data unavailable; mountain obscuration / turbulence / ceil-vis flags not updated"`
- `"Forecast period has no temperature; using current observation (Δt = 4 hr) for arrival"`

Hard failure (full error modal, no partial population):

- All four sub-fetches failed.
- Required inputs missing (no airports, no date, no time).
- Open-Meteo HTTP error AND no nearest-time fallback usable.

Per-source independence is preserved: dep can fail without killing arr/op fetches. Each sub-fetch only writes the fields it owns; failures leave existing values untouched.

## Merge semantics changes

`mergeWeatherData`:

- `temp[1]` (operating temp): now writeable. Today the function explicitly preserves it; that branch is removed.
- `altimeter[1]` (operating altimeter): now writeable. Same change as above.
- `turb`, `cielVis`, `mtnObsc`: now overwritten on every successful AIRMET fetch (including overwriting from `true` to `false`). If AIRMET fetch failed, leave existing values untouched.
- All other merge behavior unchanged.

## Caching

`/api/open-meteo` proxy sets `Cache-Control: s-maxage=600, stale-while-revalidate=3600`. GFS updates ~6 h, so 10-minute server-side cache is safe and cuts repeat-fetch latency. AviationWeather routes are unchanged.

## Testing strategy

Per `AGENTS.md`, every change ships with new or updated tests. No live network calls in tests; Open-Meteo and AviationWeather sample responses are captured into `src/test-utils/fixtures/`.

Unit tests in `src/utils/__tests__/`:

- `airportTimeWeather.test.ts` — METAR-vs-TAF selection across boundary times; TAF-no-temp fallback to METAR; nearest-period stale warning; missing-data shapes.
- `openMeteoApi.test.ts` — URL construction; response shape parsing; geopotential-height bracketing including target-above-highest-level and target-below-lowest-level; circular wind-direction interpolation across 0/360; integer rounding.
- `areaOfOpsWeather.test.ts` — position fallback to midpoint and to "skip"; op-altitude bracketing at exact level boundaries; op-altimeter unit conversion; warning aggregation.
- `gairmetApi.test.ts` — ray-casting PIP with concave polygon; on-boundary point; hazard filtering; validTime-closest selection.
- `weatherDataMapper.test.ts` — extend with merge cases for newly-writeable `temp[1]` / `altimeter[1]`; AIRMET flag always-overwrite behavior including overwrite-to-false.

Component tests:

- `WeatherDataIntegration.test.tsx` — full-pipeline happy path with all four sub-fetches mocked; stale-forecast warning panel renders the right strings; partial-failure scenarios (one sub-fetch rejected) leave other fields populated; G-AIRMET fetch failure leaves checkboxes untouched.

API route tests:

- A smoke test for `src/app/api/open-meteo/route.ts` that parallels the existing aviation-weather route test.

Regression test for the original bug: a test that fetches with `duration` such that arrival time falls in a different TAF period than departure, and asserts that `temp[2]` / `altimeter[2]` reflect the arrival period's values, not the departure period's.

## Migration / sequencing

PRs ship in this order. Each is independently passing tests + lint + build, and < ~500 lines net.

1. **PR 1 — Per-airport time-aware dep/arr weather + warnings infrastructure.** New `airportTimeWeather.ts`; refactor of `mapAirportSpecificWeatherData` to call it twice with `depTime` and `arrTime`. New `WeatherWarningsPanel` component plus warning aggregation plumbing in `WeatherDataIntegration` — landed in this PR because PR 1 is the first one to emit user-facing stale-forecast warnings, and we don't want them invisible until later. No new deps. Self-contained fix for the dep≠arr bug.
2. **PR 2 — Open-Meteo client + area-of-ops winds aloft + op temp/altimeter.** New `/api/open-meteo` proxy route, `openMeteoApi.ts`, `areaOfOpsWeather.ts`. Replace `mapWindTempData` call site. Delete the windtemp code paths and `windTempParser.ts`. Update `mergeWeatherData` to write `temp[1]` / `altimeter[1]`. Plugs new warnings into the panel from PR 1.
3. **PR 3 — G-AIRMET auto-flag.** New `gairmetApi.ts`; integration with the area-of-ops pipeline; always-overwrite semantics for the three booleans. Plugs new warnings into the panel from PR 1.

After all three merge, the `windtemp` code path is fully gone and issue #56 closes.

## Open questions

None remaining — all clarifications from the brainstorming session are resolved in the sections above.
