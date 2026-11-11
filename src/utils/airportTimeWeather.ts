import type { METARResponse, TAFForecast, TAFResponse } from "./aviationWeatherApi";
import { fieldSubject, type Notification } from "./notifications";

const HPA_TO_INHG = 0.0295299;
const METAR_FRESHNESS_MS = 90 * 60 * 1000;
/**
 * No US civil TAF forecasts an altimeter, so carrying the airport's own
 * observed setting forward is routine. Within this window it is an Advisory;
 * beyond it a front could have moved the setting, so it stays a Caution (#301).
 */
export const ALTIMETER_PERSISTENCE_ADVISORY_MS = 12 * 60 * 60 * 1000;

export type AirportWeatherSource = "metar" | "taf-fcst" | "taf-nearest" | "metar-stale" | "none";

export interface AirportWeatherAtTime {
  temp: number | null;
  altimeter: number | null;
  source: AirportWeatherSource;
  /** Subjects are `temp[slot]` / `altimeter[slot]`. */
  notifications: Notification[];
}

/** Worksheet slot an airport fills: 0 = departure, 1 = operating, 2 = arrival. */
export type AirportSlot = 0 | 1 | 2;

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

/** How close a TAF temperature sample must be to count for the requested time. */
const TAF_TEMP_SAMPLE_MAX_OFFSET_MS = 60 * 60 * 1000;

/**
 * The TAF period's temperature for the requested time, and how far from that
 * time it applies: 0 for a single value covering the period, or the offset of
 * the closest `{validTime, sfcTemp}` sample (e.g. a TX/TN maximum or minimum).
 */
function fcstTempValue(
  fcst: TAFForecast,
  requested: Date,
): { value: number; offsetMs: number } | undefined {
  if (typeof fcst.temp === "number") return { value: fcst.temp, offsetMs: 0 };
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
    return closest.sfcTemp == null
      ? undefined
      : { value: closest.sfcTemp, offsetMs: minDiff * 1000 };
  }
  return undefined;
}

function findCoveringFcst(
  fcsts: TAFForecast[] | undefined,
  requested: Date,
): TAFForecast | undefined {
  if (!fcsts || fcsts.length === 0) return undefined;
  const reqEpoch = Math.floor(requested.getTime() / 1000);
  return fcsts.find(
    (f) => f.timeFrom != null && f.timeTo != null && reqEpoch >= f.timeFrom && reqEpoch < f.timeTo,
  );
}

function findClosestFcst(
  fcsts: TAFForecast[] | undefined,
  requested: Date,
): { fcst: TAFForecast; deltaMs: number } | undefined {
  if (!fcsts || fcsts.length === 0) return undefined;
  const reqMs = requested.getTime();
  let best: { fcst: TAFForecast; deltaMs: number } | undefined;
  for (const f of fcsts) {
    if (f.timeFrom == null || f.timeTo == null) continue;
    const fromMs = f.timeFrom * 1000;
    const toMs = f.timeTo * 1000;
    const delta = reqMs < fromMs ? fromMs - reqMs : reqMs >= toMs ? reqMs - toMs : 0;
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

export interface AirportForecastInputs {
  /**
   * 2 m temperature (°C) from a model point forecast at the airport's own
   * position and elevation, for the requested time. It is data for the
   * requested airport, time and position, so it is not a Substitution: it
   * replaces a stale observation and is announced with an Advisory (#301).
   */
  fieldForecastTemp?: number | null;
}

const MODEL_SOURCE = "using the Open-Meteo model forecast for the field";

export function selectAirportWeather(
  metar: METARResponse | undefined,
  taf: TAFResponse | undefined,
  requestedTime: Date,
  airportId: string,
  slot: AirportSlot = 0,
  forecast: AirportForecastInputs = {},
): AirportWeatherAtTime {
  const modelTemp = forecast.fieldForecastTemp ?? null;
  const notifications: Notification[] = [];
  const tempSubject = fieldSubject("temp", slot);
  const altSubject = fieldSubject("altimeter", slot);
  const requestedIso = requestedTime.toISOString();

  // 1) METAR if fresh
  const obsMs = parseObsTimeMs(metar?.obsTime);
  /** How far the observation is from the requested time, for Cautions. */
  const obsDelta = Number.isFinite(obsMs)
    ? fmtDelta(Math.abs(requestedTime.getTime() - obsMs))
    : "unknown";
  /** Level for an altimeter carried forward from the airport's own observation. */
  const persistedAltimeterLevel: "advisory" | "caution" =
    Number.isFinite(obsMs) &&
    Math.abs(requestedTime.getTime() - obsMs) <= ALTIMETER_PERSISTENCE_ADVISORY_MS
      ? "advisory"
      : "caution";
  const metarFresh =
    metar != null &&
    Number.isFinite(obsMs) &&
    Math.abs(requestedTime.getTime() - obsMs) <= METAR_FRESHNESS_MS;
  if (metar?.obsTime != null && !Number.isFinite(obsMs)) {
    notifications.push({
      level: "advisory",
      subject: tempSubject,
      message: `${metar.icaoId}: observation time "${metar.obsTime}" could not be parsed; observation not used as current`,
    });
  }
  if (metarFresh && metar) {
    let temp = metar.temp != null ? Math.round(metar.temp) : null;
    if (temp === null && modelTemp !== null) {
      temp = Math.round(modelTemp);
      notifications.push({
        level: "advisory",
        subject: tempSubject,
        message: `${airportId}: current observation has no temperature; ${MODEL_SOURCE}`,
      });
    }
    return {
      temp,
      altimeter: metarAltimeterInHg(metar.altim),
      source: "metar",
      notifications,
    };
  }

  // 2) TAF period covering requested time
  const fcsts = taf?.fcsts;
  const covering = findCoveringFcst(fcsts, requestedTime);
  if (covering) {
    const tafTemp = fcstTempValue(covering, requestedTime);
    let temp = tafTemp?.value;
    // A TAF sample hours away (a TX/TN maximum or minimum) says less about
    // the requested time than a model forecast for that hour.
    const tafTempIsForAnotherTime =
      tafTemp !== undefined && tafTemp.offsetMs > TAF_TEMP_SAMPLE_MAX_OFFSET_MS;
    if ((temp == null || tafTempIsForAnotherTime) && modelTemp !== null) {
      temp = modelTemp;
      notifications.push({
        level: "advisory",
        subject: tempSubject,
        message: tafTempIsForAnotherTime
          ? `${airportId}: forecast period's temperature is for another time; ${MODEL_SOURCE}`
          : `${airportId}: forecast period has no temperature; ${MODEL_SOURCE}`,
      });
    } else if (temp == null && metar?.temp != null) {
      temp = metar.temp;
      notifications.push({
        level: "caution",
        subject: tempSubject,
        message: `${metar.icaoId}: forecast period has no temperature; using current observation (Δt = ${obsDelta})`,
      });
    }
    // TAF fcst.altim is already inHg (unlike METARResponse.altim, which is hPa — see metarAltimeterInHg).
    // Use `!= null` rather than `!== undefined` because the live API returns
    // `altim: null` (not undefined) when the period has no altimeter forecast.
    let altimeter: number | null;
    if (covering.altim != null) {
      altimeter = Math.round(covering.altim * 100) / 100;
    } else {
      altimeter = metarAltimeterInHg(metar?.altim);
      if (altimeter !== null) {
        notifications.push({
          level: persistedAltimeterLevel,
          subject: altSubject,
          message: `${airportId}: forecast period has no altimeter; using current observation (Δt = ${obsDelta})`,
        });
      }
    }
    return {
      temp: temp != null ? Math.round(temp) : null,
      altimeter,
      source: "taf-fcst",
      notifications,
    };
  }

  // 3) Nearest TAF period as a substitution
  const closest = findClosestFcst(fcsts, requestedTime);
  if (closest) {
    // Each field is attributed to where it actually came from: the nearest
    // TAF period, or the observation when that period lacks it.
    const nearest = `${airportId}: forecast unavailable for ${requestedIso}; using nearest TAF period (Δt = ${fmtDelta(
      closest.deltaMs,
    )})`;
    const fromObservation = (what: string) =>
      `${airportId}: forecast unavailable for ${requestedIso} and the nearest TAF period has no ${what}; using the current observation (Δt = ${obsDelta})`;

    const tafTemp = fcstTempValue(closest.fcst, requestedTime)?.value;
    let roundedTemp: number | null;
    if (modelTemp !== null) {
      // A forecast for the requested hour beats a period for another time.
      roundedTemp = Math.round(modelTemp);
      notifications.push({
        level: "advisory",
        subject: tempSubject,
        message: `${airportId}: forecast unavailable for ${requestedIso}; ${MODEL_SOURCE}`,
      });
    } else {
      const temp = tafTemp ?? metar?.temp ?? undefined;
      roundedTemp = temp != null ? Math.round(temp) : null;
      if (roundedTemp !== null) {
        notifications.push({
          level: "caution",
          subject: tempSubject,
          message: tafTemp != null ? nearest : fromObservation("temperature"),
        });
      }
    }
    const tafAltimeter = closest.fcst.altim;
    const altimeter =
      tafAltimeter != null
        ? Math.round(tafAltimeter * 100) / 100
        : metarAltimeterInHg(metar?.altim);
    if (altimeter !== null) {
      notifications.push({
        level: tafAltimeter != null ? "caution" : persistedAltimeterLevel,
        subject: altSubject,
        message: tafAltimeter != null ? nearest : fromObservation("altimeter"),
      });
    }
    return {
      temp: roundedTemp,
      altimeter,
      source: "taf-nearest",
      notifications,
    };
  }

  // 4) Stale METAR as a last-resort substitution (better than nothing for airports
  //    without TAF service — small / uncontrolled fields).
  if (metar != null && (metar.temp != null || metar.altim != null)) {
    const reason = taf == null ? "no TAF available" : "no usable TAF forecast period";
    const altimeter = metarAltimeterInHg(metar.altim);
    let temp: number | null;
    if (modelTemp !== null) {
      temp = Math.round(modelTemp);
      notifications.push({
        level: "advisory",
        subject: tempSubject,
        message: `${airportId}: ${reason}; ${MODEL_SOURCE}`,
      });
    } else {
      temp = metar.temp != null ? Math.round(metar.temp) : null;
      if (temp !== null) {
        notifications.push({
          level: "caution",
          subject: tempSubject,
          message: `${airportId}: ${reason}; substituting the current METAR observation (Δt = ${obsDelta})`,
        });
      }
    }
    if (altimeter !== null) {
      notifications.push({
        level: persistedAltimeterLevel,
        subject: altSubject,
        message: `${airportId}: ${reason}; using current observation (Δt = ${obsDelta})`,
      });
    }
    return { temp, altimeter, source: "metar-stale", notifications };
  }

  // 5) Nothing
  const message = `${airportId}: no METAR or TAF data available for requested time ${requestedIso}`;
  if (modelTemp !== null) {
    notifications.push(
      {
        level: "advisory",
        subject: tempSubject,
        message: `${airportId}: no METAR or TAF data available; ${MODEL_SOURCE}`,
      },
      { level: "warning", subject: altSubject, message },
    );
    return { temp: Math.round(modelTemp), altimeter: null, source: "none", notifications };
  }
  notifications.push(
    { level: "warning", subject: tempSubject, message },
    { level: "warning", subject: altSubject, message },
  );
  return { temp: null, altimeter: null, source: "none", notifications };
}
