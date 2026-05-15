import {
  pickClosestTimeIdx,
  buildSampleAtTime,
  interpolateAtAltitude,
  HPA_TO_INHG,
  type OpenMeteoPointForecast,
} from "./openMeteoApi";

export const TARGET_ALTITUDES_FT = [3000, 6000, 9000, 12000, 15000];

/**
 * Re-derive the operating-area temperature from the persisted winds-aloft
 * temperature buckets. Used when the operating altitude changes after a
 * weather fetch so `temp[1]` tracks the air temperature at the new altitude
 * instead of the value frozen at fetch time.
 *
 * Linear interpolation across `TARGET_ALTITUDES_FT` ([3k, 6k, 9k, 12k, 15k]).
 * Null buckets are skipped — interpolation uses only the available points —
 * and altitudes outside the available range snap to the lowest/highest
 * *available* (non-null) bucket. So with all buckets present, the snap
 * boundaries are 3k and 15k; with gaps at the edges, they are whichever
 * non-null buckets are nearest the edges. Returns null only when altitude
 * is missing or no buckets have data.
 */
export function interpolateOpTempFromAloft(
  altitudeFt: number | null | undefined,
  aloftTemps: (number | null | undefined)[] | null | undefined
): number | null {
  if (typeof altitudeFt !== "number" || !Number.isFinite(altitudeFt))
    return null;
  if (!aloftTemps || aloftTemps.length === 0) return null;

  const points: { alt: number; temp: number }[] = [];
  for (let i = 0; i < TARGET_ALTITUDES_FT.length; i++) {
    const t = aloftTemps[i];
    if (typeof t === "number" && Number.isFinite(t)) {
      points.push({ alt: TARGET_ALTITUDES_FT[i], temp: t });
    }
  }
  if (points.length === 0) return null;
  if (points.length === 1) return Math.round(points[0].temp);

  if (altitudeFt <= points[0].alt) return Math.round(points[0].temp);
  const last = points[points.length - 1];
  if (altitudeFt >= last.alt) return Math.round(last.temp);

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (altitudeFt >= a.alt && altitudeFt <= b.alt) {
      const f = (altitudeFt - a.alt) / (b.alt - a.alt);
      return Math.round(a.temp * (1 - f) + b.temp * f);
    }
  }
  return Math.round(last.temp);
}

/**
 * When the operating altitude changes (e.g. the user edits the altitude field
 * after a weather fetch), re-derive `temp[1]` from the persisted winds-aloft
 * temperatures so the operating temperature tracks the new altitude. Returns
 * the next `temp` triple, or `null` if no change should be applied.
 *
 * Skips when the same update already carries an explicit `temp` (a fresh
 * weather fetch already includes the correct opTemp from Open-Meteo
 * interpolation against the pressure-level grid).
 */
export function applyOpTempForAltitudeChange(
  prev: {
    altitude?: [number | null, number | null, number | null] | null;
    temp?: [number | null, number | null, number | null] | null;
    wind?: [
      (number | null)[],
      (number | null)[],
      (number | null)[],
    ] | null;
  },
  updates: {
    altitude?: [number | null, number | null, number | null];
    temp?: [number | null, number | null, number | null];
    wind?: [
      (number | null)[],
      (number | null)[],
      (number | null)[],
    ];
  }
): [number | null, number | null, number | null] | null {
  if (updates.altitude === undefined) return null;
  if (updates.altitude[1] === prev.altitude?.[1]) return null;
  if (updates.temp !== undefined) return null;

  const aloftTemps = (updates.wind ?? prev.wind)?.[2];
  const newOpTemp = interpolateOpTempFromAloft(updates.altitude[1], aloftTemps);
  if (newOpTemp === null) return null;

  const curTemp = prev.temp ?? [null, null, null];
  if (newOpTemp === curTemp[1]) return null;

  return [curTemp[0] ?? null, newOpTemp, curTemp[2] ?? null];
}

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
  const lon3 = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);

  // Normalize longitude to [-180, 180]
  let lonDeg = toDeg(lon3);
  while (lonDeg > 180) lonDeg -= 360;
  while (lonDeg < -180) lonDeg += 360;

  return [
    Math.round(toDeg(lat3) * 10000) / 10000,
    Math.round(lonDeg * 10000) / 10000,
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
