# Coding Standards

Review rules for this repo. Check every rule against the diff; each one carries the reason it exists, so a reviewer can judge a case the wording does not cover. Skip anything ESLint, Prettier or `tsc` already enforces.

## Derived values

**Every display value is derived during render by a pure function.** A new derived value is a pure function in `src/utils/derived.ts`, called from `evaluateWorksheet` (`src/utils/worksheetEvaluation.ts`) and added to `WorksheetEvaluation`. Components read only from the evaluation they are given.

Flag any `useState`, `useEffect`, `useMemo`-as-cache or ref that holds a value recomputable from props or the worksheet state. Table lookups here are sub-millisecond, so caching buys nothing, and the effect-driven chain this replaced caused issue #98: calculations went stale after a weather fetch because array references were mutated in place.

**Weather mappers return new arrays.** Every function in `src/utils/weatherDataMapper.ts` builds and returns fresh arrays and objects, leaving its inputs untouched. `setState` triggers downstream recomputation only when reference equality changes, so an in-place mutation silently freezes everything derived from it (the other half of #98).

## Input components

An input component whose props are recreated on every `onUpdate` (the parent rebuilds the worksheet state on each keystroke) fires any `useEffect` watching those props on every keystroke, not just on external changes. Syncing local state from props in that effect creates a feedback loop that clears the field mid-entry.

The required shape (`src/components/PositionInput.tsx` is the reference):

- A local string state holds the raw input display value.
- A `useRef` tracks the last value pushed through `onUpdate`.
- A prop-watching `useEffect` syncs local state only when the incoming value differs from that last-pushed value.
- Range checks happen in `onChange` before `onUpdate` is called. `min`/`max` on `<input type="number">` constrain the browser's spinner, not the value that reaches state.

## Wind values

In the wind field `0` is a real direction or velocity and `null` means no data for that altitude. ESLint's `prefer-nullish-coalescing` rule already rejects `||` fallbacks, so the review checks what it cannot see: a truthiness test (`!value`, `value ? … : …`, `if (value)`) on a wind value turns calm or north into "no data" and is a hard violation; compare with `=== null` instead. Where code writes out an explicit check so that `0` or `""` falls back on purpose, judge whether that fallback is right for the field.

## POH table gaps

Some aircraft tables hold `null` at extreme altitudes and temperatures. `trilinearInterpolate` absorbs a null corner by averaging the others (and `trilinearTableGaps` reports it so the caller can announce the Substitution). `bilinearInterpolate` and `bilinearInterpolateDetailed` throw instead, on a null corner or on out-of-range input with extrapolation disabled. A bounds check alone does not make a call safe: an in-range lookup still throws when one of its four corners is null. Every bilinear caller wraps the call in `try`/`catch` and degrades to a missing result (an `unavailable` value, or `null`), or validates both the bounds and the selected corners first; an uncaught throw takes down the render.

## Tests

Every code change ships new or updated tests:

- A new utility gets unit tests in `src/utils/__tests__/`.
- A new or modified component gets a co-located `ComponentName.test.tsx`.
- A bug fix gets a regression test that fails without the fix.
- Cross-cutting behaviour (notifications, withheld values, Limit checks, step status) is tested through `evaluateWorksheet`, not by rendering `AppContainer`. Weather-session behaviour is tested by replaying events on the `weatherSession` reducer.

A diff that changes behaviour with no test change is a hard violation. A docs-only or config-only change is exempt and should say so in the PR.
