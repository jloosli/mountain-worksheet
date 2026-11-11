/**
 * End to end: an area-of-ops Substitution (midpoint position) reaches the
 * operating-column values computed from the fields it filled, as markers,
 * and not the airport columns (#223, PR #233 review).
 */
import {
  applyOpTempForAltitudeChange,
  buildAreaOfOpsWeather,
  describeOpTempChange,
  opTempChangeNotifications,
} from "../areaOfOpsWeather";
import { mapWeatherDataToWorksheet, mergeWeatherData } from "../weatherDataMapper";
import { deriveNotifications, fieldSubject, type WeatherFetchResult } from "../notifications";
import { computeClimbViewModel, pressureColumnDependsOn } from "../derived";
import { substitutionsFor } from "../provenance";
import type { OpenMeteoPointForecast } from "../openMeteoApi";
import type { WorksheetData } from "../types";

const levels = [925, 900, 850, 800, 700, 600, 500] as const;
const series = (values: number[]) =>
  Object.fromEntries(values.map((v, i) => [i, [v, v]])) as Record<number, number[]>;
const temps = series([20, 18, 14, 10, 4, -5, -15]);
const speeds = series([5, 6, 8, 10, 14, 20, 30]);
const dirs = series([350, 355, 5, 10, 20, 30, 40]);
const heights = series([762, 1006, 1524, 1981, 3048, 4267, 5486]);
const raw = {
  hourly: {
    time: ["2026-05-12T16:00", "2026-05-12T17:00"],
    pressure_msl: [1015, 1016],
    ...Object.fromEntries(
      levels.flatMap((l, i) => [
        [`temperature_${l}hPa`, temps[i]],
        [`wind_speed_${l}hPa`, speeds[i]],
        [`wind_direction_${l}hPa`, dirs[i]],
        [`geopotential_height_${l}hPa`, heights[i]],
      ])
    ),
  },
} as unknown as OpenMeteoPointForecast;

const worksheet: WorksheetData = {
  pilot: "",
  date: "2026-05-12",
  time: "16:00",
  duration: null,
  acType: "C182T",
  tailN: "",
  airport: ["KOGD", "KLGU"],
  route: "",
  position: [null, null],
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)] as WorksheetData["wind"],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [20, null, 18],
  altimeter: [29.92, null, 29.92],
  altitude: [4473, 9000, 4457],
  rwy: [5000, 5000],
  weight: 2800,
  mtnEndorse: false,
  mtnCert: false,
};

function fetchOverMidpoint() {
  const areaOfOps = buildAreaOfOpsWeather({
    position: worksheet.position,
    depAirportLatLon: [41.2, -112.0],
    arrAirportLatLon: [41.7, -111.8],
    midTime: new Date("2026-05-12T16:00:00Z"),
    opAltitudeFt: worksheet.altitude[1],
    raw,
  });
  const mapping = mapWeatherDataToWorksheet({}, areaOfOps, null, {
    opAltitudeFt: worksheet.altitude[1],
    validateData: true,
  });
  const applied = mergeWeatherData(worksheet, mapping.data, true);
  const state = { ...worksheet, ...applied } as WorksheetData;
  const fetch: WeatherFetchResult = {
    fetchedFor: { airport: worksheet.airport, date: worksheet.date, time: worksheet.time, duration: worksheet.duration, position: worksheet.position },
    applied,
    notifications: mapping.notifications,
  };
  return { state, fetch };
}

const midpoint = <T extends { message: string }>(list: T[]) =>
  list.filter((n) => /position not entered/i.test(n.message));

describe("midpoint Substitution markers on computed values", () => {
  it("marks operating density altitude, climb rate and service ceiling, not the airport columns", () => {
    const { state, fetch } = fetchOverMidpoint();
    const notifications = deriveNotifications(state, fetch);
    const climb = computeClimbViewModel(state, notifications);
    const opDA = { status: "computed" as const, dependsOn: pressureColumnDependsOn(1).densityAltitude };

    expect(midpoint(substitutionsFor(opDA, notifications))).not.toHaveLength(0);
    expect(midpoint(substitutionsFor(climb.rateOfClimb[1], notifications))).not.toHaveLength(0);
    expect(midpoint(substitutionsFor(climb.serviceCeiling[1], notifications))).not.toHaveLength(0);
    expect(midpoint(substitutionsFor(climb.rateOfClimb[0], notifications))).toHaveLength(0);
  });
});

describe("after the operating altitude changes", () => {
  it("keeps the midpoint marker on operating values after the temperature is re-derived", () => {
    const { state, fetch } = fetchOverMidpoint();
    const updates = { altitude: [4473, 11000, 4457] as WorksheetData["altitude"] };
    const change = describeOpTempChange(state, updates, {
      fetchedOpTemp: fetch.applied.temp?.[1] ?? null,
    });
    const next = {
      ...state,
      ...updates,
      temp: applyOpTempForAltitudeChange(state, updates) ?? state.temp,
    } as WorksheetData;
    expect(next.temp[1]).not.toBe(state.temp[1]);

    const fetched = deriveNotifications(next, fetch);
    const notifications = [...fetched, ...opTempChangeNotifications(next, change)];
    const climb = computeClimbViewModel(next, notifications);
    // The operating altimeter still holds the midpoint value, so the
    // operating values stay marked even though temp[1] was re-derived.
    const marked = midpoint(substitutionsFor(climb.rateOfClimb[1], notifications));
    expect(marked.map((n) => n.subject)).toEqual([fieldSubject("altimeter", 1)]);
  });
});
