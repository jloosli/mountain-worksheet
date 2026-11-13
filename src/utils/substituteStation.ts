/**
 * The Substitute station for a Non-reporting airport (GLOSSARY.md, ADR 0003,
 * #226): the nearest airport, by great-circle distance only, whose METAR has
 * an altimeter, within 100 nm. Terrain is left to the pilot, who judges it
 * from the distance and direction the Caution names.
 */
import { getWeatherInBox, type METARResponse, type TAFResponse } from "./aviationWeatherApi";
import { nonReportingAdvisory } from "./airportIdentity";
import { selectAirportWeather, type AirportWeatherAtTime } from "./airportTimeWeather";
import { fieldSubject, subjectKey, type Notification } from "./notifications";
import { compassPoint, greatCircleDistanceNm, initialBearingDeg } from "./positionMath";

/** 14 CFR 91.121 allows an altimeter setting from a station within 100 nm. */
export const SUBSTITUTE_STATION_MAX_NM = 100;

export interface SubstituteStation {
  /** The station's latest observation; it has an altimeter. */
  metar: METARResponse;
  distanceNm: number;
  /** TRUE bearing from the Non-reporting field to the station. */
  bearingDeg: number;
  /** e.g. `KYYY, 18 nm NE`: the station, its distance and its direction from the field. */
  location: string;
}

const obsMs = (m: METARResponse): number =>
  typeof m.obsTime === "number" ? m.obsTime * 1000 : Date.parse(String(m.obsTime));

/**
 * The nearest station within 100 nm of the field whose latest METAR has an
 * altimeter, or null when there is none. Never the field itself.
 */
export function pickSubstituteStation(
  field: { id: string; lat: number; lon: number },
  metars: readonly METARResponse[],
): SubstituteStation | null {
  const latest = new Map<string, METARResponse>();
  for (const m of metars) {
    const id = m.icaoId?.toUpperCase();
    if (!id || id === field.id.toUpperCase()) continue;
    const seen = latest.get(id);
    if (!seen || obsMs(m) > obsMs(seen)) latest.set(id, m);
  }

  let best: SubstituteStation | null = null;
  for (const [id, m] of latest) {
    if (m.altim == null || typeof m.lat !== "number" || typeof m.lon !== "number") continue;
    const at: [number, number] = [m.lat, m.lon];
    const distanceNm = greatCircleDistanceNm([field.lat, field.lon], at);
    if (distanceNm > SUBSTITUTE_STATION_MAX_NM) continue;
    if (best && distanceNm >= best.distanceNm) continue;
    const bearingDeg = initialBearingDeg([field.lat, field.lon], at);
    const rounded = Math.round(distanceNm);
    best = {
      metar: m,
      distanceNm,
      bearingDeg,
      location: rounded === 0 ? `${id}, 0 nm` : `${id}, ${rounded} nm ${compassPoint(bearingDeg)}`,
    };
  }
  return best;
}

type Box = [minLat: number, minLon: number, maxLat: number, maxLon: number];

/**
 * `[minLat, minLon, maxLat, maxLon]` boxes that together hold every point
 * within 100 nm of the field, for bounding-box METAR/TAF queries. They are a
 * little generous; `pickSubstituteStation` applies the exact great-circle
 * cutoff. A box that would cross ±180° is split in two, since a query box's
 * longitudes must stay within -180..180 (e.g. in the Aleutians).
 */
export function substituteSearchBoxes(lat: number, lon: number): Box[] {
  // 1° of latitude is just over 60 nm, so 1/60° per nm (plus a margin) covers it.
  const dLat = (SUBSTITUTE_STATION_MAX_NM / 60) * 1.02;
  const minLat = Math.max(-90, lat - dLat);
  const maxLat = Math.min(90, lat + dLat);
  const poleward = Math.min(89.9, Math.abs(lat) + dLat);
  const dLon = dLat / Math.cos((poleward * Math.PI) / 180);
  if (dLon >= 180) return [[minLat, -180, maxLat, 180]];
  const minLon = lon - dLon;
  const maxLon = lon + dLon;
  if (minLon < -180) {
    return [
      [minLat, -180, maxLat, maxLon],
      [minLat, minLon + 360, maxLat, 180],
    ];
  }
  if (maxLon > 180) {
    return [
      [minLat, minLon, maxLat, 180],
      [minLat, -180, maxLat, maxLon - 360],
    ];
  }
  return [[minLat, minLon, maxLat, maxLon]];
}

/** The outcome of looking for a Non-reporting airport's Substitute station. */
export type SubstituteSearch =
  | { kind: "found"; station: SubstituteStation; taf?: TAFResponse }
  | { kind: "none" }
  | { kind: "failed"; reason: string };

/**
 * Looks for the Substitute station around a Non-reporting field: one
 * bounding-box METAR/TAF query (two across ±180°), then the great-circle
 * cutoff. Never throws.
 */
export async function findSubstituteStation(field: {
  id: string;
  lat: number;
  lon: number;
}): Promise<SubstituteSearch> {
  try {
    const results = await Promise.all(
      substituteSearchBoxes(field.lat, field.lon).map((box) => getWeatherInBox(box)),
    );
    const metar = results.flatMap((r) => r.metar);
    const taf = results.flatMap((r) => r.taf);
    const station = pickSubstituteStation(field, metar);
    if (!station) return { kind: "none" };
    const id = station.metar.icaoId.toUpperCase();
    return { kind: "found", station, taf: taf.find((t) => t.icaoId?.toUpperCase() === id) };
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : "unknown error" };
  }
}

/** A model forecast at the field's own position and elevation (ADR 0003). */
const MODEL_TEMP_SOURCE = "using the Open-Meteo model forecast at field elevation";

/** The fetch's range checks for the values it fills. */
export interface RangeChecks {
  temp: (celsius: number) => boolean;
  altimeter: (inHg: number) => boolean;
}

const ACCEPT_ALL: RangeChecks = { temp: () => true, altimeter: () => true };

/**
 * A Non-reporting airport's temperature and altimeter for the requested time
 * (ADR 0003, #226). Each field's own notification says where its value
 * came from or why it is blank, so the session retires it when the pilot
 * enters a value; the Non-reporting Advisory on the airport points to them.
 *
 * - Altimeter: the Substitute station's, through the same time selection a
 *   reporting airport gets. One Caution names the station, its distance and
 *   direction, plus any time substitution. No station within 100 nm leaves it
 *   blank with an Advisory, not a Caution, since nothing was substituted; a
 *   failed search leaves it blank with a Warning.
 * - Temperature: the model forecast at the field's own position and
 *   elevation. That is data for the field, not a Substitution (GLOSSARY.md),
 *   so it is an Advisory, as for a reporting airport (#301). No forecast
 *   leaves it blank with a Warning (Partial fetch).
 *
 * `accept` is the fetch's range check. A value it rejects is left blank with
 * a Warning saying to enter it, never a notification calling it filled.
 */
export function selectNonReportingWeather(
  airportId: string,
  requestedTime: Date,
  slot: 0 | 2,
  search: SubstituteSearch,
  fieldForecastTemp: number | null,
  accept: RangeChecks = ACCEPT_ALL,
): AirportWeatherAtTime {
  const notifications: Notification[] = [];
  const tempSubject = fieldSubject("temp", slot);
  const altSubject = fieldSubject("altimeter", slot);
  const needsInput = (field: "altimeter" | "temperature", why: string) => {
    notifications.push({
      level: "warning",
      subject: field === "altimeter" ? altSubject : tempSubject,
      message: `${airportId}: ${why}; enter the ${field} manually`,
    });
  };

  let altimeter: number | null = null;
  if (search.kind === "found") {
    const { station, taf } = search;
    const stationId = station.metar.icaoId.toUpperCase();
    const sel = selectAirportWeather(station.metar, taf, requestedTime, stationId, slot);
    if (sel.altimeter === null) {
      needsInput(
        "altimeter",
        `Substitute station ${station.location} has no altimeter for ${requestedTime.toISOString()}`,
      );
    } else if (!accept.altimeter(sel.altimeter)) {
      needsInput(
        "altimeter",
        `altimeter ${sel.altimeter} inHg from Substitute station ${station.location} is out of valid range`,
      );
    } else {
      altimeter = sel.altimeter;
      const timeNotes = sel.notifications
        .filter((n) => subjectKey(n.subject) === subjectKey(altSubject))
        .map((n) => n.message);
      notifications.push({
        level: "caution",
        subject: altSubject,
        message: [
          `${airportId}: altimeter from Substitute station ${station.location}`,
          ...timeNotes,
        ].join("; "),
      });
    }
  } else if (search.kind === "none") {
    notifications.push({
      level: "advisory",
      subject: altSubject,
      message: `${airportId}: no METAR or TAF, and no Substitute station within ${SUBSTITUTE_STATION_MAX_NM} nm; enter the altimeter manually`,
    });
  } else {
    needsInput(
      "altimeter",
      `no METAR or TAF, and the search for a Substitute station failed (${search.reason})`,
    );
  }

  let temp: number | null = null;
  const forecastTemp = fieldForecastTemp === null ? null : Math.round(fieldForecastTemp);
  if (forecastTemp === null) {
    needsInput(
      "temperature",
      "no METAR or TAF, and the model forecast for the field is unavailable",
    );
  } else if (!accept.temp(forecastTemp)) {
    needsInput(
      "temperature",
      `model forecast temperature ${forecastTemp}°C for the field is out of valid range`,
    );
  } else {
    temp = forecastTemp;
    notifications.push({
      level: "advisory",
      subject: tempSubject,
      message: `${airportId}: no METAR or TAF; ${MODEL_TEMP_SOURCE}`,
    });
  }

  // Each outcome is on its own weather field, where the session retires it
  // once the pilot enters a value; the airport's Advisory states only the
  // lasting fact, so it never goes stale.
  notifications.push(
    nonReportingAdvisory(airportId, slot === 0 ? 0 : 1, "see its temperature and altimeter"),
  );
  return {
    temp,
    tempSource: temp !== null ? "model" : null,
    altimeter,
    source: altimeter !== null ? "substitute-station" : "none",
    notifications,
  };
}
