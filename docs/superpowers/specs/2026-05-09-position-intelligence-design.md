# Position Intelligence for Area of Operations

**Issue:** [#90](https://github.com/jloosli/mountain-worksheet/issues/90)
**Date:** 2026-05-09

## Problem

The `route` field in `SortieInfo` (labeled "Area of Operations (position)") is currently a free-text input. Pilots want to enter a position in any of the eight ForeFlight-supported formats and have the worksheet resolve it to canonical decimal degrees (DD.dddd / DD.dddd).

## Goals

1. Parse all eight ForeFlight position formats into decimal-degree coordinates.
2. Preserve the pilot's original input alongside the resolved coordinates.
3. Avoid breaking existing free-text usage — pilots may still type "Cache Valley" if they want to.
4. Resolve airport and VOR identifiers via aviationweather.gov, applying current magnetic variation to convert magnetic radials to true bearings.
5. Cache resolved coordinates in URL state so a reloaded URL does not re-fetch.

## Supported Input Formats

| # | Format | Example input | Resolves to |
|---|---|---|---|
| 1 | DD.dd with letters | `36.01N/75.50W` | `36.0100, -75.5000` |
| 2 | DD.dd with minus | `36.01/-75.50` | `36.0100, -75.5000` |
| 3 | DMS with letters | `360051N/0753004W` | `36.0142, -75.5011` |
| 4 | DMS with minus | `360051/-0753004` | `36.0142, -75.5011` |
| 5 | DDM with letters | `3600.86N/07530.07W` | `36.0143, -75.5012` |
| 6 | DDM with minus | `3600.86/-07530.07` | `36.0143, -75.5012` |
| 7 | Airport ID/radial/distance | `KOGD/285/34` | resolved via airport endpoint |
| 8 | VOR ID/radial/distance | `OGD/285/34` | resolved via navaid endpoint |

## Non-Goals

- Map visualization of the parsed point
- Multiple positions or polygon "area" representation
- Persistent storage outside URL state
- Showing magvar value to the user
- Falling back from VOR → airport (or vice versa) on 3-letter ambiguity
- Supporting separators other than `/` for the formats that use it (decimal-with-minus may also accept `,` for `41.43, -112.70`)

## Data Model

### `WorksheetData` additions

`src/utils/types.ts`:

```ts
// existing
route: string;                       // raw input (unchanged)
// new
position: [number, number] | null;   // [lat, lon] in DD.dddd, or null when unparsed/unrecognized
```

`route` remains the source of truth. `position` is an advisory cache — it is recomputed from `route` whenever `route` changes. It is never edited independently. A reloaded URL with both fields skips re-resolution and renders immediately.

### URL state

`position` serializes via the existing `qs`-based mechanism in `src/utils/urlState.ts` as a length-2 number array. When `null`, omitted entirely. URL grows by ~24 chars only when present.

## Parser Pipeline

`src/utils/positionParser.ts` — pure, sync, no I/O:

```ts
type ParsedPosition =
  | { kind: "decimal";      raw: string; lat: number; lon: number }
  | { kind: "dms";          raw: string; lat: number; lon: number }
  | { kind: "ddm";          raw: string; lat: number; lon: number }
  | { kind: "airport-rd";   raw: string; stationId: string; radial: number; distanceNm: number }
  | { kind: "vor-rd";       raw: string; stationId: string; radial: number; distanceNm: number }
  | { kind: "unrecognized"; raw: string };

function parsePosition(raw: string): ParsedPosition;
```

### Detection order (first match wins)

The decimal-with-minus pattern is the most permissive and would incorrectly match strings the DMS/DDM patterns accept; therefore the more-specific patterns must be tried first.

1. **Radial-distance**: input matches `^[A-Z]{3,4}/\d{3}/\d+(\.\d+)?$`. Radial is exactly 3 digits per the issue's "Three Digit Radial" convention (e.g., `085`, not `85`). Discriminate airport vs VOR by station ID length: 4 chars → airport, 3 chars → VOR.
2. **DMS with letters**: `^\d{6}[NS]/\d{7}[EW]$`
3. **DMS with minus**: `^\d{6}/-?\d{7}$`
4. **DDM with letters**: `^\d{4}\.\d+[NS]/\d{5}\.\d+[EW]$`
5. **DDM with minus**: `^\d{4}\.\d+/-?\d{5}\.\d+$`
6. **Decimal with letters**: `^[\d.]+[NS]/[\d.]+[EW]$`
7. **Decimal with minus**: `^-?[\d.]+[/,]\s*-?[\d.]+$`
8. Otherwise → `unrecognized`

### Validation

- lat ∈ [-90, 90], lon ∈ [-180, 180]
- minutes/seconds < 60
- radial ∈ [0, 360]
- distance > 0 and < 500 nm
- Out-of-range inputs → `unrecognized` (no exceptions thrown)

### Normalization

- `trim()` whitespace
- Uppercase letters before matching
- Round all returned `lat`/`lon` to 4 decimal places (~11m precision at the equator)

### Display vs storage formats

- **Storage** (`position` field, URL state): `[lat, lon]` number array, 4-decimal precision.
- **Display** (hint beneath input): `→ 41.4321, -112.7042` — comma-separated, more readable than slash. The original input shown in `route` is whatever the pilot typed.

## Math, Magvar, and Lookups

### `src/utils/positionMath.ts`

```ts
function geodesicDestination(
  startLat: number, startLon: number,
  trueBearingDeg: number, distanceNm: number
): { lat: number; lon: number };
```

Spherical-earth direct geodesic. Earth radius constant: 3440.065 nm. Error vs WGS84 ellipsoid is well below 4-decimal precision for sub-100nm legs.

### `src/utils/magvar.ts`

Thin wrapper over the `geomagnetism` npm package (World Magnetic Model). Bundles WMM coefficients (~tens of KB), no API call:

```ts
function magneticVariation(lat: number, lon: number, date?: Date): number;
// East-positive declination in degrees.
// trueBearing = magneticBearing + variation
```

### Aviation Weather API additions

`src/utils/aviationWeatherApi.ts`:

```ts
async function getNavaidInfo(ids: string[]): Promise<NavaidResponse[]>;
// GET /api/aviation-weather?endpoint=navaid&ids=OGD&format=json
```

Response shape (fields confirmed during implementation):
```ts
interface NavaidResponse {
  id: string;
  name?: string;
  lat: number;
  lon: number;
  type?: string;     // e.g., "VOR", "VOR-DME", "VORTAC"
  magvar?: number;   // station declination, if exposed
}
```

The proxy at `src/app/api/aviation-weather/route.ts` already forwards arbitrary endpoints. No proxy changes anticipated unless the navaid response requires special parsing.

### Resolution flow for radial-distance kinds

1. Parser returns `{kind, stationId, radial, distanceNm}`.
2. Component checks the in-memory station cache; on miss, calls `getAirportInfo([id])` or `getNavaidInfo([id])`.
3. Compute `trueBearing = radial + magneticVariation(stationLat, stationLon)`.
4. `geodesicDestination(stationLat, stationLon, trueBearing, distanceNm)` → final lat/lon.
5. Round to 4dp and update `position`.

### Magvar nuance

A VOR's published station declination (the magvar baked into its calibration when last surveyed) can differ from current WMM by a few degrees in regions of rapid magnetic drift. For 4-decimal precision over short legs this rarely matters; we use WMM for both airport and VOR lookups. If the navaid endpoint exposes a `magvar` field, switching VORs to use that value is a future enhancement.

## Component: `PositionInput`

`src/components/PositionInput.tsx`:

```ts
interface PositionInputProps {
  rawValue: string;
  cachedPosition: [number, number] | null;
  onChange: (route: string, position: [number, number] | null) => void;
}
```

Replaces the inline `<input id="route">` block at `SortieInfo.tsx:320-332`. All other fields in `SortieInfo` are unchanged.

### Internal state

- `localRaw: string` — `<input>` display value, mirrored to `rawValue` via the ref-tracked last-pushed pattern documented in `AGENTS.md:30-37` (avoids feedback loops with the `initialData` prop in `SortieInfo`).
- `lookupState: { status: "idle"|"loading"|"resolved"|"error", message?: string }`

### Effect chain

1. On `localRaw` change (300ms debounce): call `parsePosition(localRaw)`.
2. Branch on `parsed.kind`:
   - `decimal | dms | ddm` → call `onChange(localRaw, [round4(lat), round4(lon)])` immediately. `lookupState = idle`.
   - `airport-rd | vor-rd` → check session cache. On hit, compute and `onChange` immediately. On miss, set `lookupState = loading`, fire API call. On success, compute, call `onChange(localRaw, [lat, lon])`, `lookupState = resolved`. On failure, `onChange(localRaw, null)`, `lookupState = error`.
   - `unrecognized` → `onChange(localRaw, null)`, render warning hint.
3. **Race protection:** each lookup tagged with a request ID; only the most-recent ID's result updates state.

### Initial mount

If `cachedPosition` is present, render it immediately. If `parsePosition(rawValue)` is sync and produces the same result, skip work. If `rawValue` is async-kind and `cachedPosition` is present, trust the cache — no re-fetch.

### Visual layout

The hint sits beneath the `<input>` in the same slot occupied by `sortieLocalTiming` for the date/time fields. Small, gray, no layout shift.

| Parser state | Hint shown |
|---|---|
| empty | (none) |
| sync parse success | `→ 41.4321, -112.7042` |
| async lookup in flight | `→ looking up KOGD…` |
| async lookup success | `→ 41.4321, -112.7042 (KOGD/285/34)` |
| async lookup failed | `⚠ Could not find KOGD` |
| unrecognized | `⚠ Unrecognized format — saved as free text` |

## Edge Cases

| Case | Behavior |
|---|---|
| `41.43, -112.70` (decimal with comma + space) | Accepted by decimal-with-minus pattern. |
| `LAX/285/34` (3 chars; LAX is both airport IATA and VOR) | Treated as VOR per issue convention. If navaid lookup fails, surface error; do not fall back to airport. |
| Lowercase input | Uppercased before parsing. |
| Radial 360 vs 0 | Both accepted. |
| Distance 0 | Accepted; resolves to station coordinates. |
| Negative distance | Rejected → `unrecognized`. |
| Empty input | `route = ""`, `position = null`, no hint. |
| Network failure | `⚠ Lookup failed — check connection`. `position = null`. No auto-retry. |
| Slow lookup (>5s) | `⚠ Lookup taking longer than expected`. Continues waiting. |
| User edits while lookup in flight | Cancel via request ID; new debounced parse fires. |
| Coordinates out of range | Treated as `unrecognized`. |
| Eastern hemisphere coords (`36.01N/75.50E`) | Parsed correctly. |

## Error Handling Philosophy

Parser failures degrade silently to `unrecognized` (saved as free text with amber warning). Only API/network failures surface as amber warnings. No exceptions thrown to the user.

## Testing

| File | Coverage |
|---|---|
| `src/utils/__tests__/positionParser.test.ts` | Each of 8 formats × valid / invalid / edge inputs (~30 cases). Pure unit test, no mocks. |
| `src/utils/__tests__/positionMath.test.ts` | Geodesic destination against known reference points (e.g., 0,0 + 90° + 60nm ≈ 0, 1°). Magvar wrapper smoke test. |
| `src/utils/__tests__/aviationWeatherApi.test.ts` | New `getNavaidInfo` request shape and error path. Existing tests already mock `fetch`. |
| `src/components/PositionInput.test.tsx` | Full flows: sync parse renders coords; async lookup renders loading then result; error path; unrecognized path; race protection (rapid edits cancel stale lookups). |
| `src/components/SortieInfo.test.tsx` | Update to reflect new component slot; add regression test that route + position round-trip through URL state. |
| `src/utils/__tests__/urlState.test.ts` | Add cases for `position` field serialization (length-2 number array; null omission). |

## Files Changed

**New files:**
- `src/utils/positionParser.ts`
- `src/utils/positionMath.ts`
- `src/utils/magvar.ts`
- `src/components/PositionInput.tsx`
- `src/utils/__tests__/positionParser.test.ts`
- `src/utils/__tests__/positionMath.test.ts`
- `src/components/PositionInput.test.tsx`

**Modified:**
- `src/utils/types.ts` — add `position` to `WorksheetData`
- `src/utils/aviationWeatherApi.ts` — add `getNavaidInfo`, `NavaidResponse`
- `src/components/SortieInfo.tsx` — replace inline route input with `<PositionInput>`; thread `position` through state
- `src/utils/urlState.ts` / `useUrlState.ts` — confirm length-2 number array round-trips correctly (likely no change)
- `src/utils/__tests__/aviationWeatherApi.test.ts` — coverage for `getNavaidInfo`
- `src/components/SortieInfo.test.tsx` — coverage for new wiring
- `src/utils/__tests__/urlState.test.ts` — coverage for `position` field
- `package.json` — add `geomagnetism` dependency
