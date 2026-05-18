import { useEffect, useRef, useState } from "react";
import { getAirportInfo, type AirportResponse } from "./aviationWeatherApi";
import type { RunwayOption } from "./types";

const ICAO_RE = /^[A-Z0-9]{3,4}$/;
const DEBOUNCE_MS = 400;

type RunwaysTuple = [RunwayOption[] | null, RunwayOption[] | null];

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
  const [runways, setRunways] = useState<RunwaysTuple>([null, null]);
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

    setRunways((prev) => {
      const keepDep =
        depValid && lastResolvedRef.current[0] === dep ? prev[0] : null;
      const keepArr =
        arrValid && lastResolvedRef.current[1] === arr ? prev[1] : null;
      return [keepDep, keepArr];
    });

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

    const timer = setTimeout(async () => {
      try {
        const response = await getAirportInfo(codes);
        if (seq !== seqRef.current) return;
        const byCode = new Map(
          response.map((a) => [a.icaoId?.toUpperCase(), a])
        );
        const depRunways = depValid ? extractRunways(byCode.get(dep)) : null;
        const arrRunways = arrValid ? extractRunways(byCode.get(arr)) : null;
        lastResolvedRef.current = [dep, arr];
        setRunways([depRunways, arrRunways]);
      } catch (err) {
        if (seq !== seqRef.current) return;
        console.warn("Airport lookup failed:", err);
        lastResolvedRef.current = [dep, arr];
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [dep, arr, depValid, arrValid]);

  return runways;
}
