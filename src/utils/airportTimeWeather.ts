import type {
  METARResponse,
  TAFForecast,
  TAFResponse,
} from "./aviationWeatherApi";

const HPA_TO_INHG = 0.0295299;
const METAR_FRESHNESS_MS = 90 * 60 * 1000;

export type AirportWeatherSource =
  | "metar"
  | "taf-fcst"
  | "taf-nearest"
  | "metar-stale"
  | "none";

export interface AirportWeatherAtTime {
  temp: number | null;
  altimeter: number | null;
  source: AirportWeatherSource;
  warnings: string[];
}

function parseObsTimeMs(obsTime: string | number | undefined): number {
  // Live API returns Unix epoch seconds (number); some fixtures use ISO strings.
  if (obsTime == null) return NaN;
  if (typeof obsTime === "number") return obsTime * 1000;
  return Date.parse(obsTime);
}

function metarAltimeterInHg(altim: number | null | undefined): number | null {
  // The live AviationWeather API can return null for altim despite the typed shape;
  // treat null and undefined the same.
  if (altim == null) return null;
  return Math.round(altim * HPA_TO_INHG * 100) / 100;
}

function fcstTempValue(fcst: TAFForecast, requested: Date): number | undefined {
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
  fcsts: TAFForecast[] | undefined,
  requested: Date
): TAFForecast | undefined {
  if (!fcsts || fcsts.length === 0) return undefined;
  const reqEpoch = Math.floor(requested.getTime() / 1000);
  return fcsts.find(
    (f) =>
      f.timeFrom != null &&
      f.timeTo != null &&
      reqEpoch >= f.timeFrom &&
      reqEpoch < f.timeTo
  );
}

function findClosestFcst(
  fcsts: TAFForecast[] | undefined,
  requested: Date
): { fcst: TAFForecast; deltaMs: number } | undefined {
  if (!fcsts || fcsts.length === 0) return undefined;
  const reqMs = requested.getTime();
  let best: { fcst: TAFForecast; deltaMs: number } | undefined;
  for (const f of fcsts) {
    if (f.timeFrom == null || f.timeTo == null) continue;
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

  // 1) METAR if fresh
  const obsMs = parseObsTimeMs(metar?.obsTime);
  const metarFresh =
    metar != null &&
    Number.isFinite(obsMs) &&
    Math.abs(requestedTime.getTime() - obsMs) <= METAR_FRESHNESS_MS;
  if (metar?.obsTime != null && !Number.isFinite(obsMs)) {
    warnings.push(
      `${metar.icaoId}: obsTime "${metar.obsTime}" could not be parsed`
    );
  }
  if (metarFresh && metar) {
    return {
      temp: metar.temp != null ? Math.round(metar.temp) : null,
      altimeter: metarAltimeterInHg(metar.altim),
      source: "metar",
      warnings,
    };
  }

  // 2) TAF period covering requested time
  const fcsts = taf?.fcsts;
  const covering = findCoveringFcst(fcsts, requestedTime);
  if (covering) {
    let temp = fcstTempValue(covering, requestedTime);
    if (temp == null && metar?.temp != null) {
      temp = metar.temp;
      const tempObsMs = parseObsTimeMs(metar.obsTime);
      const delta = Number.isFinite(tempObsMs)
        ? fmtDelta(Math.abs(requestedTime.getTime() - tempObsMs))
        : "unknown";
      warnings.push(
        `${metar.icaoId}: forecast period has no temperature; using current observation (Δt = ${delta})`
      );
    }
    // TAF fcst.altim is already inHg (unlike METARResponse.altim, which is hPa — see metarAltimeterInHg).
    // Use `!= null` rather than `!== undefined` because the live API returns
    // `altim: null` (not undefined) when the period has no altimeter forecast.
    return {
      temp: temp != null ? Math.round(temp) : null,
      altimeter:
        covering.altim != null
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
    if (temp == null) temp = metar?.temp ?? undefined;
    return {
      temp: temp != null ? Math.round(temp) : null,
      altimeter:
        closest.fcst.altim != null
          ? Math.round(closest.fcst.altim * 100) / 100
          : metarAltimeterInHg(metar?.altim),
      source: "taf-nearest",
      warnings,
    };
  }

  // 4) Stale METAR as last-resort fallback (better than nothing for airports
  //    without TAF service — small / uncontrolled fields).
  if (metar != null && (metar.temp != null || metar.altim != null)) {
    const id = metar.icaoId ?? "airport";
    const delta = Number.isFinite(obsMs)
      ? fmtDelta(Math.abs(requestedTime.getTime() - obsMs))
      : "unknown";
    const reason =
      taf == null
        ? "no TAF available"
        : "no usable TAF forecast period";
    warnings.push(
      `${id}: ${reason}; using current METAR observation as fallback (Δt = ${delta})`
    );
    return {
      temp: metar.temp != null ? Math.round(metar.temp) : null,
      altimeter: metarAltimeterInHg(metar.altim),
      source: "metar-stale",
      warnings,
    };
  }

  // 5) Nothing
  const id = taf?.icaoId ?? metar?.icaoId ?? "airport";
  warnings.push(
    `${id}: no METAR or TAF data available for requested time ${requestedIso}`
  );
  return { temp: null, altimeter: null, source: "none", warnings };
}
