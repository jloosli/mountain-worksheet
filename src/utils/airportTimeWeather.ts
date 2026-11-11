import type { METARResponse, TAFForecast, TAFResponse } from "./aviationWeatherApi";
import { fieldSubject, type Notification } from "./notifications";

const HPA_TO_INHG = 0.0295299;
const METAR_FRESHNESS_MS = 90 * 60 * 1000;

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

export function selectAirportWeather(
  metar: METARResponse | undefined,
  taf: TAFResponse | undefined,
  requestedTime: Date,
  airportId: string,
  slot: AirportSlot = 0,
): AirportWeatherAtTime {
  const notifications: Notification[] = [];
  const tempSubject = fieldSubject("temp", slot);
  const altSubject = fieldSubject("altimeter", slot);
  const requestedIso = requestedTime.toISOString();
  /** One Caution per field a substitution actually filled. */
  const cautionOnFilledTempAndAltimeter = (
    message: string,
    temp: number | null,
    altimeter: number | null,
  ) => {
    if (temp !== null) notifications.push({ level: "caution", subject: tempSubject, message });
    if (altimeter !== null) notifications.push({ level: "caution", subject: altSubject, message });
  };

  // 1) METAR if fresh
  const obsMs = parseObsTimeMs(metar?.obsTime);
  /** How far the observation is from the requested time, for Cautions. */
  const obsDelta = Number.isFinite(obsMs)
    ? fmtDelta(Math.abs(requestedTime.getTime() - obsMs))
    : "unknown";
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
    return {
      temp: metar.temp != null ? Math.round(metar.temp) : null,
      altimeter: metarAltimeterInHg(metar.altim),
      source: "metar",
      notifications,
    };
  }

  // 2) TAF period covering requested time
  const fcsts = taf?.fcsts;
  const covering = findCoveringFcst(fcsts, requestedTime);
  if (covering) {
    let temp = fcstTempValue(covering, requestedTime);
    if (temp == null && metar?.temp != null) {
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
          level: "caution",
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

    const tafTemp = fcstTempValue(closest.fcst, requestedTime);
    const temp = tafTemp ?? metar?.temp ?? undefined;
    const roundedTemp = temp != null ? Math.round(temp) : null;
    if (roundedTemp !== null) {
      notifications.push({
        level: "caution",
        subject: tempSubject,
        message: tafTemp != null ? nearest : fromObservation("temperature"),
      });
    }
    const tafAltimeter = closest.fcst.altim;
    const altimeter =
      tafAltimeter != null
        ? Math.round(tafAltimeter * 100) / 100
        : metarAltimeterInHg(metar?.altim);
    if (altimeter !== null) {
      notifications.push({
        level: "caution",
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
    const delta = obsDelta;
    const reason = taf == null ? "no TAF available" : "no usable TAF forecast period";
    const temp = metar.temp != null ? Math.round(metar.temp) : null;
    const altimeter = metarAltimeterInHg(metar.altim);
    cautionOnFilledTempAndAltimeter(
      `${airportId}: ${reason}; substituting the current METAR observation (Δt = ${delta})`,
      temp,
      altimeter,
    );
    return { temp, altimeter, source: "metar-stale", notifications };
  }

  // 5) Nothing
  const message = `${airportId}: no METAR or TAF data available for requested time ${requestedIso}`;
  notifications.push(
    { level: "warning", subject: tempSubject, message },
    { level: "warning", subject: altSubject, message },
  );
  return { temp: null, altimeter: null, source: "none", notifications };
}
