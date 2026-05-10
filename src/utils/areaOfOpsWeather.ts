import {
  pickClosestTimeIdx,
  buildSampleAtTime,
  interpolateAtAltitude,
  HPA_TO_INHG,
  type OpenMeteoPointForecast,
} from "./openMeteoApi";

export const TARGET_ALTITUDES_FT = [3000, 6000, 9000, 12000, 15000];

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
