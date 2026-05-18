# Open Route in SkyVector — Design

**Issue:** #101 — Add a button to open the route visualized in SkyVector
**Date:** 2026-05-17

## Goal

Give pilots a one-click way to open the worksheet's planned route on
[skyvector.com](https://skyvector.com) in a new tab. The route is
`departure → operating → arrival`, using the airport identifiers and the parsed
Area-of-Operations coordinates already present in worksheet state.

## User experience

A button labeled **"Open in SkyVector"** appears at the bottom of the
**Where** section in `SortieInfo`, directly after the grid that contains
the Departure, Arrival, Operating Altitude, Area of Operations, and
Aircraft Takeoff Weight inputs.

- Enabled when both Departure Airport and Arrival Airport are non-blank
  (after trim).
- Disabled otherwise, with the title `Set departure and arrival airports`.
- Clicking calls `window.open(url, "_blank", "noopener,noreferrer")`.

The button never blocks worksheet entry — it is purely additive.

## Architecture

One new pure utility module and a button rendered in an existing component:

- `src/utils/skyvector.ts` — pure functions, no React, no side effects.
  - `latLonToDmsWaypoint(lat: number, lon: number): string`
  - `buildSkyvectorUrl(input): string | null`
- `src/components/SortieInfo.tsx` — adds the button. Reads from the
  existing `formData` (no new props, no new state).

A unit test file `src/utils/__tests__/skyvector.test.ts` covers the
utility; component tests are added to the existing
`src/components/SortieInfo.test.tsx`.

## Data flow

1. The button component reads `formData.airport[0]`,
   `formData.airport[1]`, and `formData.position` from the same
   `SortieInfo` state the rest of the **Where** section uses.
2. It calls `buildSkyvectorUrl({ departure, arrival, operating })` where
   `operating` is `formData.position` if both entries are non-null, else
   `null`.
3. If the helper returns `null`, the button renders disabled. Otherwise
   the button is enabled and the URL is used in `window.open` on click.

There is no derived React state, no `useEffect`, and no caching. The URL
is computed on each render — it's a few string operations on values
already in scope.

## URL construction

Base URL: `https://skyvector.com/?fpl=` followed by waypoints joined by
`%20`.

Waypoints, in order:
1. Departure airport identifier (trimmed, uppercased).
2. Operating waypoint, **only when** `formData.position` has both lat
   and lon non-null. Encoded via `latLonToDmsWaypoint`.
3. Arrival airport identifier (trimmed, uppercased).

`buildSkyvectorUrl` returns `null` if departure or arrival is empty
after trim — this is the single signal the button uses to decide its
disabled state.

### Examples

- All three set:
  `https://skyvector.com/?fpl=KPVU%20403008N1104444W%20KSGU`
- Operating blank or unparsed:
  `https://skyvector.com/?fpl=KPVU%20KSGU`

## DMS waypoint format

SkyVector accepts ICAO-style coordinate waypoints in the form
`DDMMSS[NS]DDDMMSS[EW]` (no decimals, integer seconds). The conversion:

1. Take the absolute value of the coordinate.
2. Compute integer degrees, integer minutes, and seconds rounded to the
   nearest integer.
3. Carry overflow: 60 seconds → +1 minute, 60 minutes → +1 degree.
4. Clamp degrees to ≤90 for latitude and ≤180 for longitude as a
   floating-point safety net (e.g. inputs like `89.999999...` after
   rounding).
5. Format with `padStart`: degrees → 2 digits (lat) or 3 digits (lon);
   minutes and seconds → 2 digits each.
6. Suffix: `N` if `lat ≥ 0` else `S`; `E` if `lon ≥ 0` else `W`. A
   negative-zero coordinate (`-0`) is treated as positive — use
   `lat < 0` not `Object.is(lat, -0)` to pick the suffix.

### Conversion examples

| Input lat, lon         | Output                  |
|------------------------|-------------------------|
| 40.5023, -110.7456     | `403008N1104444W`       |
| 40.0, -110.0           | `400000N1100000W`       |
| 0, 0                   | `000000N0000000E`       |
| -33.8688, 151.2093     | `335208S1511234E`       |
| 89.9999, 179.9999      | `900000N1800000E` (clamped) |

The latitude block is `DDMMSS` (6 digits) and the longitude block is
`DDDMMSS` (7 digits), each followed by its hemisphere suffix.

## Edge cases

- Either airport blank or whitespace-only → button disabled, no URL.
- Operating `position` is `[null, null]` (route field empty or free text
  that didn't parse) → two-waypoint URL; button stays enabled.
- ICAO with surrounding whitespace or lowercase letters → trimmed and
  uppercased before insertion.
- Exactly-zero latitude or longitude is a valid coordinate (the missing
  signal is `null`, not `0`).
- Coordinate near the poles or anti-meridian → degree value clamped so
  the formatter never produces 4-digit-degree output.
- Popup blocked → not handled. `window.open` is fire-and-forget,
  consistent with the rest of this codebase. The user will see their
  browser's standard popup-blocked indicator.

## Testing

### `src/utils/__tests__/skyvector.test.ts`

`latLonToDmsWaypoint`:
- Positive latitude, positive longitude.
- Negative latitude, negative longitude.
- Exact integer degrees (no fractional minutes/seconds).
- Rollover when seconds round to 60 (e.g. inputs that produce
  `…59.6"` seconds carrying into the minutes field).
- `0, 0` produces `000000N0000000E` (latitude block 6 digits, longitude
  block 7 digits, both with positive suffix).
- `-0` latitude and `-0` longitude produce `N`/`E` suffixes.
- Values at ±90 / ±180 produce clamped, 2- or 3-digit degree output.

`buildSkyvectorUrl`:
- All three fields set → exact expected URL (literal string match — catches
  `%20` vs `+` regressions).
- Operating `null` → two-waypoint URL.
- Departure blank string → returns `null`.
- Arrival whitespace-only → returns `null`.
- Lowercase ICAO → uppercased in the output URL.
- Operating with one `null` coordinate → treated as missing
  (two-waypoint URL).

### `src/components/SortieInfo.test.tsx`

- Button is disabled when departure missing.
- Button is disabled when arrival missing.
- Button is enabled and `window.open` is called with the expected URL
  when both airports and operating coordinates are set (mock
  `window.open`).
- Button is enabled with a two-waypoint URL when operating `position`
  is `[null, null]`.
- `window.open` is called with `"_blank"` and `"noopener,noreferrer"`.

## What this design does **not** include

- No pretty-label passthrough for operating airports or VOR-RDs — the
  operating waypoint is always a coordinate. (Option B/C in the
  approaches discussion.) This can be added later without a schema
  change.
- No support for printing or copying the SkyVector URL.
- No UX surfacing of popup-blocked errors.
- No second button location (ActionBar) — discoverability is satisfied
  by the inline placement next to the inputs the button uses.

## Files touched

- `src/utils/skyvector.ts` (new)
- `src/utils/__tests__/skyvector.test.ts` (new)
- `src/components/SortieInfo.tsx` (button added; no other changes)
- `src/components/SortieInfo.test.tsx` (button tests added)
