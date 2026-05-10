import type { METARResponse, TAFResponse } from "./aviationWeatherApi";

const HPA_TO_INHG = 0.0295299;
const METAR_FRESHNESS_MS = 90 * 60 * 1000;

export type AirportWeatherSource = "metar" | "taf-fcst" | "taf-nearest" | "none";

export interface AirportWeatherAtTime {
  temp: number | null;
  altimeter: number | null;
  source: AirportWeatherSource;
  warnings: string[];
}

interface TafFcst {
  timeFrom?: number;
  timeTo?: number;
  temp?: number | { sfcTemp?: number; validTime?: number }[];
  altim?: number;
}

function metarAltimeterInHg(altim: number | undefined): number | null {
  if (altim === undefined) return null;
  return Math.round(altim * HPA_TO_INHG * 100) / 100;
}

function fcstTempValue(fcst: TafFcst, requested: Date): number | undefined {
  // TAF temp may be a number or an array of {validTime, sfcTemp}; handle both
  if (typeof fcst.temp === "number") return fcst.temp;
  if (Array.isArray(fcst.temp) && fcst.temp.length > 0) {
    const reqEpoch = Math.floor(requested.getTime() / 1000);
    let closest = fcst.temp[0];
    let minDiff = Math.abs((closest.validTime ?? 0) - reqEpoch);
    for (const candidate of fcst.temp) {
      const diff = Math.abs((candidate.validTime ?? 0) - reqEpoch);
      if (diff < minDiff) {
        minDiff = diff;
        closest = candidate;
      }
    }
    return closest.sfcTemp;
  }
  return undefined;
}

function findCoveringFcst(
  fcsts: TafFcst[] | undefined,
  requested: Date
): TafFcst | undefined {
  if (!fcsts || fcsts.length === 0) return undefined;
  const reqEpoch = Math.floor(requested.getTime() / 1000);
  return fcsts.find(
    (f) =>
      f.timeFrom !== undefined &&
      f.timeTo !== undefined &&
      reqEpoch >= f.timeFrom &&
      reqEpoch < f.timeTo
  );
}

function findClosestFcst(
  fcsts: TafFcst[] | undefined,
  requested: Date
): { fcst: TafFcst; deltaMs: number } | undefined {
  if (!fcsts || fcsts.length === 0) return undefined;
  const reqMs = requested.getTime();
  let best: { fcst: TafFcst; deltaMs: number } | undefined;
  for (const f of fcsts) {
    if (f.timeFrom === undefined || f.timeTo === undefined) continue;
    const fromMs = f.timeFrom * 1000;
    const toMs = f.timeTo * 1000;
    const delta =
      reqMs < fromMs ? fromMs - reqMs : reqMs >= toMs ? reqMs - toMs : 0;
    if (!best || delta < best.deltaMs) best = { fcst: f, deltaMs: delta };
  }
  return best;
}

function fmtDelta(ms: number): string {
  const hr = ms / (60 * 60 * 1000);
  if (hr >= 24) return `${(hr / 24).toFixed(1)} d`;
  if (hr >= 1) return `${hr.toFixed(1)} hr`;
  return `${Math.round(ms / 60000)} min`;
}

export function selectAirportWeather(
  metar: METARResponse | undefined,
  taf: TAFResponse | undefined,
  requestedTime: Date
): AirportWeatherAtTime {
  const warnings: string[] = [];
  const requestedIso = requestedTime.toISOString();

  // 1) METAR if recent
  if (metar?.obsTime) {
    const obsMs = Date.parse(metar.obsTime);
    if (
      Number.isFinite(obsMs) &&
      Math.abs(requestedTime.getTime() - obsMs) <= METAR_FRESHNESS_MS
    ) {
      return {
        temp: metar.temp !== undefined ? Math.round(metar.temp) : null,
        altimeter: metarAltimeterInHg(metar.altim),
        source: "metar",
        warnings,
      };
    }
  }

  // 2) TAF period covering requested time
  const fcsts = (taf as unknown as { fcsts?: TafFcst[] } | undefined)?.fcsts;
  const covering = findCoveringFcst(fcsts, requestedTime);
  if (covering) {
    let temp = fcstTempValue(covering, requestedTime);
    if (temp === undefined && metar?.temp !== undefined) {
      temp = metar.temp;
      const obsMs = metar.obsTime ? Date.parse(metar.obsTime) : NaN;
      const delta = Number.isFinite(obsMs)
        ? fmtDelta(Math.abs(requestedTime.getTime() - obsMs))
        : "unknown";
      warnings.push(
        `${metar.icaoId}: forecast period has no temperature; using current observation (Δt = ${delta})`
      );
    }
    return {
      temp: temp !== undefined ? Math.round(temp) : null,
      altimeter:
        covering.altim !== undefined
          ? Math.round(covering.altim * 100) / 100
          : metarAltimeterInHg(metar?.altim),
      source: "taf-fcst",
      warnings,
    };
  }

  // 3) Nearest TAF period as fallback
  const closest = findClosestFcst(fcsts, requestedTime);
  if (closest) {
    const id = taf?.icaoId ?? metar?.icaoId ?? "airport";
    warnings.push(
      `${id}: forecast unavailable for ${requestedIso}; using nearest TAF period (Δt = ${fmtDelta(
        closest.deltaMs
      )})`
    );
    let temp = fcstTempValue(closest.fcst, requestedTime);
    if (temp === undefined) temp = metar?.temp;
    return {
      temp: temp !== undefined ? Math.round(temp) : null,
      altimeter:
        closest.fcst.altim !== undefined
          ? Math.round(closest.fcst.altim * 100) / 100
          : metarAltimeterInHg(metar?.altim),
      source: "taf-nearest",
      warnings,
    };
  }

  // 4) Nothing
  warnings.push(
    `No METAR or TAF data available for requested time ${requestedIso}`
  );
  return { temp: null, altimeter: null, source: "none", warnings };
}
