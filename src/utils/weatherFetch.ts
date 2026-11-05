/**
 * One weather fetch for the worksheet: METAR/TAF/airport data, area-of-ops
 * weather (Open-Meteo) and G-AIRMETs, mapped into worksheet values plus the
 * notifications the fetch raised.
 *
 * Never throws and never blocks: a Partial fetch applies what succeeded, and
 * a total failure is a Warning on the weather step with nothing applied.
 */
import { getWeatherDataBatch } from "./aviationWeatherApi";
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
import { stepSubject, type WeatherFetchResult } from "./notifications";
import { fetchPointForecast } from "./openMeteoApi";
import type { WorksheetData } from "./types";
import { mapWeatherDataToWorksheet, mergeWeatherData } from "./weatherDataMapper";

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

export async function fetchWorksheetWeather(
  worksheet: WorksheetData
): Promise<WorksheetWeatherFetch> {
  const departure = normalizeAirportCode(worksheet.airport[0]);
  const arrival = normalizeAirportCode(worksheet.airport[1]);
  const fetchedFor: WeatherFetchResult["fetchedFor"] = {
    airport: [departure, arrival],
    date: worksheet.date,
    time: worksheet.time,
  };

  try {
    const uniqueAirports = Array.from(
      new Set([departure, arrival].filter(Boolean))
    );
    if (uniqueAirports.length === 0) {
      throw new Error("no departure or arrival airport entered");
    }

    const apiData = await getWeatherDataBatch(uniqueAirports, {
      includeMETAR: true,
      includeTAF: true,
      includeAirport: true,
      metarHours: 1,
      tafHours: 6,
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
      opAltitudeFt: worksheet.altitude[1],
      validateData: true,
    });
    if (!mapping.success) {
      return {
        data: null,
        result: { fetchedFor, applied: {}, notifications: mapping.notifications },
      };
    }

    const data = mergeWeatherData(worksheet, mapping.data, true);
    return {
      data,
      result: { fetchedFor, applied: data, notifications: mapping.notifications },
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
