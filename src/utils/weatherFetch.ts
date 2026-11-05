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
  greatCircleMidpoint,
  noPositionWarning,
  type AreaOfOpsWeather,
} from "./areaOfOpsWeather";
import {
  airmetFlagsUnavailable,
  classifyAirmets,
  fetchGAirmets,
  type AirmetClassification,
} from "./gairmetApi";
import { normalizeAirportCode } from "./airportCode";
import {
  stepSubject,
  type Notification,
  type WeatherFetchResult,
} from "./notifications";
import { fetchPointForecast } from "./openMeteoApi";
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

function emptyAreaOfOps(
  notifications: AreaOfOpsWeather["notifications"]
): AreaOfOpsWeather {
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
  tafHours: 6,
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
async function fetchAndResolveAirports(
  entered: [string, string]
): Promise<ResolvedAirports> {
  const unique = Array.from(new Set(entered.filter(Boolean)));
  let apiData = await getWeatherDataBatch(unique, BATCH_OPTIONS);
  const lookup = failedIn(apiData, "airport") ? null : apiData.airport ?? [];

  const candidates = lookup
    ? Array.from(
        new Set(
          unique
            .filter((id) => matchCount(id, lookup) === 0)
            .map(correctionCandidate)
            .filter((c): c is string => c !== null)
        )
      )
    : [];
  let candidateLookup: WeatherDataBatch["airport"] | null | undefined;
  if (candidates.length > 0) {
    const extra = await getWeatherDataBatch(candidates, BATCH_OPTIONS);
    candidateLookup = failedIn(extra, "airport") ? null : extra.airport ?? [];
    apiData = {
      metar: [...(apiData.metar ?? []), ...(extra.metar ?? [])],
      taf: [...(apiData.taf ?? []), ...(extra.taf ?? [])],
      airport: [...(apiData.airport ?? []), ...(extra.airport ?? [])],
      notifications: [...apiData.notifications, ...extra.notifications],
      failed: Array.from(
        new Set([...(apiData.failed ?? []), ...(extra.failed ?? [])])
      ),
    };
  }

  const classify = (id: string): AirportIdentity =>
    classifyAirport(
      id,
      lookup,
      correctionCandidate(id) ? candidateLookup : undefined
    );
  return { apiData, identities: [classify(entered[0]), classify(entered[1])] };
}

/**
 * How an airport's identity affects the fields it fills: an Unknown airport
 * needs all of them entered by hand; a Non-reporting airport needs weather.
 */
function airportCondition(
  identity: AirportIdentity,
  apiData: WeatherDataBatch
): AirportCondition | undefined {
  if (identity.kind === "unknown") return "unknown";
  if (identity.kind === "unchecked") return undefined;
  const weatherLookupFailed =
    failedIn(apiData, "metar") || failedIn(apiData, "taf");
  if (
    !weatherLookupFailed &&
    !hasDataFor(identity.id, apiData.metar) &&
    !hasDataFor(identity.id, apiData.taf)
  ) {
    return "non-reporting";
  }
  return undefined;
}

export async function fetchWorksheetWeather(
  worksheet: WorksheetData
): Promise<WorksheetWeatherFetch> {
  const enteredDeparture = normalizeAirportCode(worksheet.airport[0]);
  const enteredArrival = normalizeAirportCode(worksheet.airport[1]);
  const fetchedFor: WeatherFetchResult["fetchedFor"] = {
    airport: [enteredDeparture, enteredArrival],
    date: worksheet.date,
    time: worksheet.time,
    duration: worksheet.duration,
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
    const midTime = new Date(
      depTime.getTime() + ((worksheet.duration ?? 0) / 2) * 3600 * 1000
    );
    const latLonOf = (code: string): [number, number] | null => {
      const a = (apiData.airport ?? []).find(
        (x) => x.icaoId?.toUpperCase() === code
      );
      return a && typeof a.lat === "number" && typeof a.lon === "number"
        ? [a.lat, a.lon]
        : null;
    };
    const depLatLon = latLonOf(departure);
    const arrLatLon = latLonOf(arrival);

    // Same great-circle midpoint buildAreaOfOpsWeather will pick, so the
    // point we fetch is the point we display.
    const [lat, lon] = worksheet.position;
    const opPos: [number, number] | null =
      lat !== null && lon !== null
        ? [lat, lon]
        : depLatLon && arrLatLon
          ? greatCircleMidpoint(depLatLon, arrLatLon)
          : null;

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
        fetchGAirmets(),
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
              areaOfOpsUnavailable(
                `Open-Meteo request failed (${reasonOf(point.reason)})`
              )
            );
      airmets =
        gairmet.status === "fulfilled"
          ? classifyAirmets(gairmet.value, opPos, midTime)
          : {
              turb: null,
              cielVis: null,
              mtnObsc: null,
              notifications: [
                airmetFlagsUnavailable(
                  `G-AIRMET request failed (${reasonOf(gairmet.reason)})`
                ),
              ],
            };
    }

    const mapping = mapWeatherDataToWorksheet(apiData, areaOfOps, airmets, {
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
      true
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
