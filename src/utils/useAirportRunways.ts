import { useEffect, useRef, useState } from "react";
import { getAirportInfo, type AirportResponse } from "./aviationWeatherApi";
import type { RunwayOption } from "./types";
import { normalizeAirportCode } from "./airportCode";
import { fieldSubject, type Notification } from "./notifications";

const ICAO_RE = /^[A-Z0-9]{3,4}$/;
const DEBOUNCE_MS = 400;

type RunwaysTuple = [RunwayOption[] | null, RunwayOption[] | null];

/**
 * Where a slot's runway lookup stands: `idle` (no valid airport ID, so it
 * never ran), `pending`, `found`, `no-runways` (the lookup worked but has no
 * runways for that ID), or `failed` (the request itself failed).
 */
export type RunwayLookupStatus =
  | "idle"
  | "pending"
  | "found"
  | "no-runways"
  | "failed";

export interface RunwayLookup {
  runways: RunwaysTuple;
  status: [RunwayLookupStatus, RunwayLookupStatus];
  /** A Warning on `rwy[slot]` for each slot whose lookup failed. */
  notifications: Notification[];
}

interface RunwaysState {
  resolvedFor: [string, string];
  runways: RunwaysTuple;
  /** Set when the lookup for `resolvedFor` failed. */
  error: string | null;
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

/** The runway options for each airport slot. */
export function useAirportRunways(airports: [string, string]): RunwaysTuple {
  return useAirportRunwayLookup(airports).runways;
}

/**
 * Looks up runways for the departure and arrival airports (debounced), and
 * reports whether each lookup never ran, is pending, found runways, found
 * none, or failed. A failed lookup raises a Warning on that slot's runway.
 */
export function useAirportRunwayLookup(
  airports: [string, string]
): RunwayLookup {
  const [state, setState] = useState<RunwaysState>({
    resolvedFor: ["", ""],
    runways: [null, null],
    error: null,
  });
  const seqRef = useRef(0);
  const lastResolvedRef = useRef<[string, string]>(["", ""]);

  const dep = normalizeAirportCode(airports[0]);
  const arr = normalizeAirportCode(airports[1]);
  const depValid = isValid(dep);
  const arrValid = isValid(arr);

  useEffect(() => {
    if (
      lastResolvedRef.current[0] === dep &&
      lastResolvedRef.current[1] === arr
    ) {
      return;
    }

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
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const response = await getAirportInfo(codes);
        if (cancelled || seq !== seqRef.current) return;
        const byCode = new Map(
          response.map((a) => [a.icaoId?.toUpperCase(), a])
        );
        const depRunways = depValid ? extractRunways(byCode.get(dep)) : null;
        const arrRunways = arrValid ? extractRunways(byCode.get(arr)) : null;
        lastResolvedRef.current = [dep, arr];
        setState({
          resolvedFor: [dep, arr],
          runways: [depRunways, arrRunways],
          error: null,
        });
      } catch (err) {
        if (cancelled || seq !== seqRef.current) return;
        // Developer diagnostic; the pilot sees the Warning below.
        console.warn("Airport lookup failed:", err);
        lastResolvedRef.current = [dep, arr];
        setState({
          resolvedFor: [dep, arr],
          runways: [null, null],
          error: err instanceof Error ? err.message : "unknown error",
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dep, arr, depValid, arrValid]);

  const codes = [dep, arr] as const;
  const valid = [depValid, arrValid] as const;
  const slotStatus = (i: 0 | 1): RunwayLookupStatus => {
    if (!valid[i]) return "idle";
    if (state.resolvedFor[i] !== codes[i]) return "pending";
    if (state.error !== null) return "failed";
    return state.runways[i] ? "found" : "no-runways";
  };
  const status: [RunwayLookupStatus, RunwayLookupStatus] = [
    slotStatus(0),
    slotStatus(1),
  ];
  const runways: RunwaysTuple = [
    status[0] === "found" ? state.runways[0] : null,
    status[1] === "found" ? state.runways[1] : null,
  ];
  const notifications: Notification[] = ([0, 1] as const)
    .filter((i) => status[i] === "failed")
    .map((i) => ({
      level: "warning",
      subject: fieldSubject("rwy", i),
      message: `Couldn't look up runways for ${codes[i]} (${state.error}), so no runway can be selected.`,
    }));
  return { runways, status, notifications };
}
