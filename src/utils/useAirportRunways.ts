import { useEffect, useRef, useState } from "react";
import { getAirportInfo, type AirportResponse } from "./aviationWeatherApi";
import type { RunwayOption } from "./types";

const ICAO_RE = /^[A-Z0-9]{3,4}$/;
const DEBOUNCE_MS = 400;

type RunwaysTuple = [RunwayOption[] | null, RunwayOption[] | null];

interface RunwaysState {
  resolvedFor: [string, string];
  runways: RunwaysTuple;
}

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
  const [state, setState] = useState<RunwaysState>({
    resolvedFor: ["", ""],
    runways: [null, null],
  });
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
        });
      } catch (err) {
        if (cancelled || seq !== seqRef.current) return;
        console.warn("Airport lookup failed:", err);
        lastResolvedRef.current = [dep, arr];
        setState({
          resolvedFor: [dep, arr],
          runways: [null, null],
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dep, arr, depValid, arrValid]);

  const depOut =
    depValid && state.resolvedFor[0] === dep ? state.runways[0] : null;
  const arrOut =
    arrValid && state.resolvedFor[1] === arr ? state.runways[1] : null;
  return [depOut, arrOut];
}
