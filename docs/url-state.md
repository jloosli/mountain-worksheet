# URL state format

The worksheet state round-trips through the URL query string via `src/utils/urlState.ts` and `src/utils/useUrlReducer.ts`, using the `qs` library. Links are shared between pilots, so a format change breaks every link already sent: keep old URLs parsing.

## Format rules

- Arrays → comma-separated (`?numbers=1,2,3`).
- Booleans → `"1"` / `"0"`.
- 2D arrays → `||` row separator (`?wind=,90,180||5,10,15`).
- A `null` element inside an array is kept as an empty slot (`,90,180` is `[null, 90, 180]`). A top-level `null` value is omitted from the URL.
- Spaces → `+`, not `%20`.
- Deserialization uses `initialState` as type hints to restore each field's type, so a new field needs an `initialState` entry of the right type.

## Wind

In the wind field `null` (no data for that altitude) and `0` (calm, or north) are different values, which is why empty slots are preserved rather than collapsed. See the wind rule in `CODING_STANDARDS.md`.
