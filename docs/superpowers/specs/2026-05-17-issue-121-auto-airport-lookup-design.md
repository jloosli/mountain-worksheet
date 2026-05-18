# Auto airport lookup on change / URL load (issue #121)

## Problem

Runway dropdown options in `AirportCard` are populated only as a side-effect of clicking **Fetch Weather**. When a user opens a shared URL with airport codes already filled in, `airportRunways` stays `[null, null]` until the user manually triggers a full weather fetch — runway info is unavailable even though the codes are known.

Issue #121 asks for two triggers:

1. Look up airport info whenever the airport code changes.
2. Look up airport info on first load if codes are already present in the URL.

## Goal

Decouple airport runway hydration from the weather fetch. Runways should populate automatically and ambiently whenever the worksheet has a valid airport code, without requiring the user to click **Fetch Weather**.

## Non-goals

- No METAR/TAF/AIRMET auto-fetch on URL load — out of scope.
- No new loading indicator or error UI for the runway dropdown. The dropdown already renders a sensible empty state, and silent failure matches the "ambient lookup" intent. Manual **Fetch Weather** remains an explicit user-driven path.
- No change to the AviationWeather API client; `getAirportInfo()` already exists.

## Design

### New hook: `useAirportRunways`

Location: `src/utils/useAirportRunways.ts`

```ts
export function useAirportRunways(
  airports: [string, string]
): [RunwayOption[] | null, RunwayOption[] | null];
```

Responsibilities:

- Watches the `airports` tuple.
- For each slot, normalizes with `.trim().toUpperCase()` and validates the code with `/^[A-Z0-9]{3,4}$/`. `SortieInfo` already uppercases on input, but the hook normalizes defensively so a stray lowercase value from URL state can't fail the regex. Invalid or empty codes resolve that slot to `null` with no API call.
- Debounces fetches by **400 ms** so typing "KDEN" produces one call, not four.
- Dedupes when `dep === arr`: a single `getAirportInfo([code])` request is split into both slots.
- Tracks the last-resolved code pair internally. When the incoming tuple already matches the resolved pair, the hook is a no-op (covers the case where a parent re-render passes the same tuple).
- Uses a monotonic sequence id (or `AbortController`) to discard stale responses if the user changes a code while a fetch is in flight.
- On API failure, leaves the slot at `null` and logs `console.warn`. No modal, no toast.

Return value updates synchronously:

- When `airports` changes to a different valid tuple → the hook returns `[null, null]` immediately for affected slots, then the resolved runways once the fetch completes.
- When a code becomes invalid → that slot returns to `null` immediately.

### `AppContainer` changes

Replace the existing `useState` + callback wiring:

```ts
// before
const [airportRunways, setAirportRunways] = useState<
  [RunwayOption[] | null, RunwayOption[] | null]
>([null, null]);
const handleAirportInfoUpdate = (info: AirportRunwayInfo) => {
  setAirportRunways([info.departure, info.arrival]);
};
```

with:

```ts
// after
const airportRunways = useAirportRunways(state.airport);
```

Remove the `setAirportRunways([null, null])` block inside `handleUpdate` — the hook now owns that lifecycle.

Stop passing `onAirportInfoUpdate` to `WeatherDataIntegration` at the call site in `AppContainer`.

### `WeatherDataIntegration` changes

Remove the `onAirportInfoUpdate` prop, the `extractRunways` helper, and the block that builds and calls the callback. The weather fetch still requests the airport endpoint (used elsewhere for `lat`/`lon`/`elev` and area-of-ops position fallback), but its runway side-effect is no longer needed.

Update `WeatherDataIntegration.test.tsx`: drop the two `onAirportInfoUpdate callback` test cases.

### Data flow after change

```
state.airport  ──►  useAirportRunways (debounced, validated)
                          │
                          ▼
                    getAirportInfo
                          │
                          ▼
                    airportRunways  ──►  AppInputs ──► WeatherSection ──► AirportCard
```

`WeatherDataIntegration` is no longer in the runway path.

### Edge cases

| Case | Behavior |
|---|---|
| URL has both airports → mount | Hook fires once after debounce, populates both. |
| User edits one code | Old runways for that slot clear immediately; other slot untouched; refetch after debounce. |
| Invalid code (e.g., `K`) | No API call for that slot; slot stays `null`. |
| Same code dep & arr | Single API call; result fans out to both slots. |
| API failure / network error | Slot stays `null`; `console.warn` logged. |
| In-flight fetch when code changes again | Stale response discarded via seq-id / abort. |
| Unmount during fetch | Cleanup discards response. |

## Testing

New: `src/utils/useAirportRunways.test.ts`

- Mounts with both airports set → `getAirportInfo` called once after debounce with both codes; hook returns runways for both slots.
- Mounts with empty airports → no API call; returns `[null, null]`.
- Updates one airport → only-changed slot triggers refetch; other slot's runways unchanged.
- Rapid changes within debounce window → single API call with final value.
- Invalid code (length 1) → no API call for that slot; slot stays `null`.
- Dep === arr → single API call; both slots receive same runways.
- API rejection → both slots stay `null`; no thrown error.
- Stale response handling → if code changes mid-flight, late response is ignored.

Update: `src/components/WeatherDataIntegration.test.tsx`

- Remove the `onAirportInfoUpdate callback` describe block (two tests).

Update: `src/components/AppContainer.test.tsx`

- If it asserts the `onAirportInfoUpdate` prop is passed to `WeatherDataIntegration`, remove or replace with a test that mocks `useAirportRunways` and verifies the returned tuple is threaded down to `AppInputs`.

Mocks: tests mock `@/utils/aviationWeatherApi`'s `getAirportInfo` directly. Use `jest.useFakeTimers()` to drive the debounce.

## Risks & rollback

- **Risk:** more API calls overall (every airport edit triggers a lookup). Mitigated by debounce, code-format validation, and last-resolved-pair memoization.
- **Risk:** silent failure could mask outages. Acceptable because the user can still click **Fetch Weather** to surface a modal error if they need the data and the dropdown is empty.
- **Rollback:** revert the hook introduction and restore the `onAirportInfoUpdate` wiring. Self-contained.
