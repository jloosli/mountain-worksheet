/**
 * One weather fetch for the worksheet: METAR/TAF/airport data, area-of-ops
 * weather (Open-Meteo) and G-AIRMETs, mapped into worksheet values plus the
 * notifications the fetch raised.
 *
 * Never throws and never blocks: a Partial fetch applies what succeeded, and
 * a total failure is a Warning on the weather step with nothing applied.
 */
import {
  getWeatherDataBatch,
  type AirportResponse,
  type WeatherDataBatch,
} from "./aviationWeatherApi";
import {
  airportIdentityNotification,
  classifyAirport,
  correctionCandidate,
  matchCount,
  nonReportingAdvisory,
  type AirportIdentity,
} from "./airportIdentity";
import {
  areaOfOpsUnavailable,
  buildAreaOfOpsWeather,
  enteredPosition,
  greatCircleMidpoint,
  noPositionWarning,
  type AreaOfOpsWeather,
} from "./areaOfOpsWeather";
import {
  airmetFlagsUnavailable,
  classifyAirmets,
  fetchGAirmets,
  type AirmetClassification,
  type GAirmetFeature,
} from "./gairmetApi";
import { normalizeAirportCode } from "./airportCode";
import { stepSubject, type Notification, type WeatherFetchResult } from "./notifications";
import {
  fetchFieldForecast,
  fetchPointForecast,
  type OpenMeteoPointForecast,
} from "./openMeteoApi";
import type { WorksheetData } from "./types";
import {
  mapWeatherDataToWorksheet,
  mergeWeatherData,
  type AirportCondition,
} from "./weatherDataMapper";

export interface WorksheetWeatherFetch {
  /** Worksheet values to apply, or `null` when nothing could be applied. */
  data: Partial<WorksheetData> | null;
  result: WeatherFetchResult;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function emptyAreaOfOps(notifications: AreaOfOpsWeather["notifications"]): AreaOfOpsWeather {
  const empty = () => Array(5).fill(null) as (number | null)[];
  return {
    position: null,
    positionSource: "none",
    windsAloft: { direction: empty(), speed: empty(), temp: empty() },
    opTemp: null,
    opAltimeter: null,
    notifications,
  };
}

const BATCH_OPTIONS = {
  includeMETAR: true,
  includeTAF: true,
  includeAirport: true,
  metarHours: 1,
};

const failedIn = (batch: WeatherDataBatch, kind: "metar" | "taf" | "airport") =>
  (batch.failed ?? []).includes(kind);

const hasDataFor = (id: string, list: readonly { icaoId?: string }[] = []) =>
  list.some((x) => x.icaoId?.toUpperCase() === id);

interface ResolvedAirports {
  apiData: WeatherDataBatch;
  identities: [AirportIdentity, AirportIdentity];
}

/**
 * Fetches the entered airports and, for any 3-character ID the airport lookup
 * doesn't know, its `K`-prefixed form; then classifies each ID (#216).
 */
async function fetchAndResolveAirports(entered: [string, string]): Promise<ResolvedAirports> {
  const unique = Array.from(new Set(entered.filter(Boolean)));
  let apiData = await getWeatherDataBatch(unique, BATCH_OPTIONS);
  const lookup = failedIn(apiData, "airport") ? null : (apiData.airport ?? []);

  const candidates = lookup
    ? Array.from(
        new Set(
          unique
            .filter((id) => matchCount(id, lookup) === 0)
            .map(correctionCandidate)
            .filter((c): c is string => c !== null),
        ),
      )
    : [];
  let candidateLookup: WeatherDataBatch["airport"] | null | undefined;
  if (candidates.length > 0) {
    const extra = await getWeatherDataBatch(candidates, BATCH_OPTIONS);
    candidateLookup = failedIn(extra, "airport") ? null : (extra.airport ?? []);
    apiData = {
      metar: [...(apiData.metar ?? []), ...(extra.metar ?? [])],
      taf: [...(apiData.taf ?? []), ...(extra.taf ?? [])],
      airport: [...(apiData.airport ?? []), ...(extra.airport ?? [])],
      notifications: [...apiData.notifications, ...extra.notifications],
      failed: Array.from(new Set([...(apiData.failed ?? []), ...(extra.failed ?? [])])),
    };
  }

  const classify = (id: string): AirportIdentity =>
    classifyAirport(id, lookup, correctionCandidate(id) ? candidateLookup : undefined);
  return { apiData, identities: [classify(entered[0]), classify(entered[1])] };
}

/**
 * How an airport's identity affects the fields it fills: an Unknown airport
 * needs all of them entered by hand; a Non-reporting airport needs weather.
 */
function airportCondition(
  identity: AirportIdentity,
  apiData: WeatherDataBatch,
): AirportCondition | undefined {
  if (identity.kind === "unknown") return "unknown";
  if (identity.kind === "unchecked") return undefined;
  const weatherLookupFailed = failedIn(apiData, "metar") || failedIn(apiData, "taf");
  if (
    !weatherLookupFailed &&
    !hasDataFor(identity.id, apiData.metar) &&
    !hasDataFor(identity.id, apiData.taf)
  ) {
    return "non-reporting";
  }
  return undefined;
}

/**
 * The AIRMET flags from a settled G-AIRMET fetch. A failed fetch, or a sortie
 * no forecast covers, leaves the flags as they were with a Warning.
 */
function classifyGAirmetResult(
  gairmet: PromiseSettledResult<GAirmetFeature[] | null>,
  position: [number, number],
  midTime: Date,
): AirmetClassification {
  if (gairmet.status === "fulfilled" && gairmet.value !== null) {
    return classifyAirmets(gairmet.value, position, midTime);
  }
  const reason =
    gairmet.status === "rejected"
      ? `G-AIRMET request failed (${reasonOf(gairmet.reason)})`
      : `No G-AIRMET forecast covers ${midTime.toISOString()} (they run 12 hr ahead)`;
  return {
    turb: null,
    cielVis: null,
    mtnObsc: null,
    notifications: [airmetFlagsUnavailable(reason)],
  };
}

/**
 * The model point forecast at each reporting airport's own position and
 * elevation, keyed by airport ID (#301). An airport whose request fails is
 * left out: its temperature falls back to the observation, whose Caution
 * already tells the pilot.
 */
async function fetchFieldForecasts(
  airports: Array<[code: string, airport: AirportResponse | undefined]>,
  win: { start: Date; end: Date },
): Promise<Record<string, OpenMeteoPointForecast>> {
  const unique = new Map(airports);
  const entries = await Promise.all(
    [...unique].map(async ([code, a]) => {
      if (
        !a ||
        typeof a.lat !== "number" ||
        typeof a.lon !== "number" ||
        typeof a.elev !== "number" ||
        !Number.isFinite(a.elev)
      ) {
        return null;
      }
      try {
        return [code, await fetchFieldForecast(a.lat, a.lon, a.elev, win)] as const;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((e) => e !== null));
}

export async function fetchWorksheetWeather(
  worksheet: WorksheetData,
): Promise<WorksheetWeatherFetch> {
  const enteredDeparture = normalizeAirportCode(worksheet.airport[0]);
  const enteredArrival = normalizeAirportCode(worksheet.airport[1]);
  const fetchedFor: WeatherFetchResult["fetchedFor"] = {
    airport: [enteredDeparture, enteredArrival],
    date: worksheet.date,
    time: worksheet.time,
    duration: worksheet.duration,
    position: worksheet.position,
  };

  try {
    if (!enteredDeparture && !enteredArrival) {
      throw new Error("no departure or arrival airport entered");
    }

    const { apiData, identities } = await fetchAndResolveAirports([
      enteredDeparture,
      enteredArrival,
    ]);
    const departure = enteredDeparture && identities[0].id;
    const arrival = enteredArrival && identities[1].id;
    // Corrected IDs are written back, so the fetch is "for" them.
    fetchedFor.airport = [departure, arrival];

    const identityNotifications: Notification[] = [];
    const conditions = ([0, 1] as const).map((slot) => {
      if (!fetchedFor.airport[slot]) return undefined;
      const identity = identities[slot];
      const note = airportIdentityNotification(identity, slot);
      if (note) identityNotifications.push(note);
      const condition = airportCondition(identity, apiData);
      if (condition === "non-reporting") {
        identityNotifications.push(nonReportingAdvisory(identity.id, slot));
      }
      return condition;
    });

    const depTime = new Date(`${worksheet.date}T${worksheet.time}:00Z`);
    const midTime = new Date(depTime.getTime() + ((worksheet.duration ?? 0) / 2) * 3600 * 1000);
    const airportOf = (code: string): AirportResponse | undefined =>
      (apiData.airport ?? []).find((x) => x.icaoId?.toUpperCase() === code);
    const latLonOf = (code: string): [number, number] | null => {
      const a = airportOf(code);
      return a && typeof a.lat === "number" && typeof a.lon === "number" ? [a.lat, a.lon] : null;
    };
    // Same rule as the mapper's arrival time: no valid duration means 0.
    const durationHours =
      typeof worksheet.duration === "number" &&
      Number.isFinite(worksheet.duration) &&
      worksheet.duration > 0
        ? worksheet.duration
        : 0;
    const fieldForecastsPromise = fetchFieldForecasts(
      ([0, 1] as const).flatMap((slot) => {
        const code = fetchedFor.airport[slot];
        return code && !conditions[slot]
          ? [[code, airportOf(code)] as [string, AirportResponse | undefined]]
          : [];
      }),
      { start: depTime, end: new Date(depTime.getTime() + durationHours * 3600 * 1000) },
    );
    const depLatLon = latLonOf(departure);
    const arrLatLon = latLonOf(arrival);

    // Same great-circle midpoint buildAreaOfOpsWeather will pick, so the
    // point we fetch is the point we display.
    const opPos: [number, number] | null =
      enteredPosition(worksheet.position) ??
      (depLatLon && arrLatLon ? greatCircleMidpoint(depLatLon, arrLatLon) : null);

    let areaOfOps: AreaOfOpsWeather;
    let airmets: AirmetClassification | null = null;
    if (!opPos) {
      areaOfOps = emptyAreaOfOps([noPositionWarning()]);
    } else {
      const win = {
        start: new Date(midTime.getTime() - 24 * 3600 * 1000),
        end: new Date(midTime.getTime() + 24 * 3600 * 1000),
      };
      const [point, gairmet] = await Promise.allSettled([
        fetchPointForecast(opPos[0], opPos[1], win),
        fetchGAirmets(midTime),
      ]);
      areaOfOps =
        point.status === "fulfilled"
          ? buildAreaOfOpsWeather({
              position: worksheet.position,
              depAirportLatLon: depLatLon,
              arrAirportLatLon: arrLatLon,
              midTime,
              opAltitudeFt: worksheet.altitude[1],
              raw: point.value,
            })
          : emptyAreaOfOps(
              areaOfOpsUnavailable(`Open-Meteo request failed (${reasonOf(point.reason)})`),
            );
      airmets = classifyGAirmetResult(gairmet, opPos, midTime);
    }

    const fieldForecasts = await fieldForecastsPromise;
    const mapping = mapWeatherDataToWorksheet(apiData, areaOfOps, airmets, {
      fieldForecasts,
      flightDate: worksheet.date,
      flightTime: worksheet.time,
      durationHours: worksheet.duration,
      departureAirport: departure,
      arrivalAirport: arrival,
      airportConditions: { departure: conditions[0], arrival: conditions[1] },
      opAltitudeFt: worksheet.altitude[1],
      validateData: true,
    });
    const notifications = [...identityNotifications, ...mapping.notifications];
    if (!mapping.success) {
      return {
        data: null,
        result: { fetchedFor, applied: {}, notifications },
      };
    }

    const data = mergeWeatherData(
      worksheet,
      { ...mapping.data, airport: fetchedFor.airport },
      true,
    );
    return {
      data,
      result: { fetchedFor, applied: data, notifications },
    };
  } catch (error) {
    console.error("Weather data fetch error:", error);
    return {
      data: null,
      result: {
        fetchedFor,
        applied: {},
        notifications: [
          {
            level: "warning",
            subject: stepSubject("weather"),
            message: `Weather fetch failed (${reasonOf(error)}); weather values were not updated`,
          },
        ],
      },
    };
  }
}
