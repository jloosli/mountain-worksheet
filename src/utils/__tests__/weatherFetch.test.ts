import { fetchWorksheetWeather } from "@/utils/weatherFetch";
import { getWeatherDataBatch } from "@/utils/aviationWeatherApi";
import { fetchPointForecast } from "@/utils/openMeteoApi";
import { fetchGAirmets } from "@/utils/gairmetApi";
import {
  deriveNotifications,
  fieldSubject,
  subjectKey,
  type Notification,
} from "@/utils/notifications";
import type { WorksheetData } from "@/utils/types";

jest.mock("@/utils/aviationWeatherApi", () => ({
  ...jest.requireActual("@/utils/aviationWeatherApi"),
  getWeatherDataBatch: jest.fn(),
}));
jest.mock("@/utils/openMeteoApi", () => ({
  ...jest.requireActual("@/utils/openMeteoApi"),
  fetchPointForecast: jest.fn(),
}));
jest.mock("@/utils/gairmetApi", () => ({
  ...jest.requireActual("@/utils/gairmetApi"),
  fetchGAirmets: jest.fn(),
}));

const mockBatch = getWeatherDataBatch as jest.Mock;
const mockPoint = fetchPointForecast as jest.Mock;
const mockGairmets = fetchGAirmets as jest.Mock;

const worksheet: WorksheetData = {
  pilot: "",
  date: "2026-05-12",
  time: "16:00",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["KORD", "KXYZ"],
  route: "",
  position: [40.5, -112.0],
  wind: [Array(5).fill(1), Array(5).fill(1), Array(5).fill(1)] as WorksheetData["wind"],
  turb: true,
  cielVis: false,
  mtnObsc: false,
  // Values left over from an earlier fetch
  temp: [10, 5, 15],
  altimeter: [29.5, 29.6, 29.7],
  altitude: [1000, 9000, 2000],
  rwy: [5000, 6000],
  weight: null,
  mtnEndorse: false,
  mtnCert: false,
};

const kordMetar = {
  icaoId: "KORD",
  obsTime: "2026-05-12T16:00:00Z",
  temp: 21,
  altim: 1013.2,
};
const kordAirport = {
  icaoId: "KORD",
  lat: 41.97,
  lon: -87.9,
  elev: 200,
  runway: [{ id: "10/28", length: 8000, alignment: 100 }],
};

const pointForecast = {
  hourly: {
    time: ["2026-05-12T16:00"],
    pressure_msl: [1015],
    temperature_925hPa: [20],
    temperature_900hPa: [18],
    temperature_850hPa: [14],
    temperature_800hPa: [10],
    temperature_700hPa: [4],
    temperature_600hPa: [-5],
    temperature_500hPa: [-15],
    wind_speed_925hPa: [5],
    wind_speed_900hPa: [6],
    wind_speed_850hPa: [8],
    wind_speed_800hPa: [10],
    wind_speed_700hPa: [14],
    wind_speed_600hPa: [20],
    wind_speed_500hPa: [30],
    wind_direction_925hPa: [350],
    wind_direction_900hPa: [355],
    wind_direction_850hPa: [5],
    wind_direction_800hPa: [10],
    wind_direction_700hPa: [20],
    wind_direction_600hPa: [30],
    wind_direction_500hPa: [40],
    geopotential_height_925hPa: [762],
    geopotential_height_900hPa: [1006],
    geopotential_height_850hPa: [1524],
    geopotential_height_800hPa: [1981],
    geopotential_height_700hPa: [3048],
    geopotential_height_600hPa: [4267],
    geopotential_height_500hPa: [5486],
  },
};

const subjectsAt = (list: Notification[], level: Notification["level"]) =>
  list.filter((n) => n.level === level).map((n) => subjectKey(n.subject));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockBatch.mockResolvedValue({
    metar: [kordMetar],
    taf: [],
    airport: [kordAirport],
    notifications: [],
  });
  mockPoint.mockResolvedValue(pointForecast);
  mockGairmets.mockResolvedValue([]);
});

describe("fetchWorksheetWeather", () => {
  it("fills the airport that reported and blanks the one that didn't, with Warnings", async () => {
    const { data, result } = await fetchWorksheetWeather(worksheet);

    expect(data?.temp?.[0]).toBe(21);
    expect(data?.rwy?.[0]).toBe(8000);
    // Not the stale values from the earlier fetch
    expect(data?.temp?.[2]).toBeNull();
    expect(data?.altimeter?.[2]).toBeNull();
    expect(data?.rwy?.[1]).toBeNull();
    expect(data?.altitude?.[2]).toBeNull();

    const warned = subjectsAt(result.notifications, "warning");
    expect(warned).toEqual(
      expect.arrayContaining([
        "field:temp.2",
        "field:altimeter.2",
        "field:rwy.1",
        "field:altitude.2",
      ])
    );
    expect(warned).not.toContain("field:temp.0");
  });

  it("records what it fetched for and applied, so notifications derive from state", async () => {
    const { data, result } = await fetchWorksheetWeather(worksheet);
    expect(result.fetchedFor).toEqual({
      airport: ["KORD", "KXYZ"],
      date: "2026-05-12",
      time: "16:00",
    });
    const state = { ...worksheet, ...data } as WorksheetData;
    const live = deriveNotifications(state, result);
    expect(subjectsAt(live, "warning")).toContain("field:temp.2");

    // The pilot enters the arrival temperature: that Warning goes away.
    const fixed = { ...state, temp: [21, state.temp[1], 12] as WorksheetData["temp"] };
    expect(subjectsAt(deriveNotifications(fixed, result), "warning")).not.toContain(
      "field:temp.2"
    );
  });

  it("passes on METAR/TAF/airport request failures", async () => {
    const failure: Notification = {
      level: "warning",
      subject: { kind: "step", step: "weather" },
      message: "TAF request failed for KORD, KXYZ (500 Internal Server Error)",
    };
    mockBatch.mockResolvedValue({
      metar: [kordMetar],
      taf: [],
      airport: [kordAirport],
      notifications: [failure],
    });
    const { result } = await fetchWorksheetWeather(worksheet);
    expect(result.notifications).toContainEqual(failure);
  });

  it("raises Warnings on the winds aloft and operating values when Open-Meteo fails", async () => {
    mockPoint.mockRejectedValue(new Error("network down"));
    const { data, result } = await fetchWorksheetWeather(worksheet);

    expect(data?.wind).toEqual([
      Array(5).fill(null),
      Array(5).fill(null),
      Array(5).fill(null),
    ]);
    expect(data?.altimeter?.[1]).toBeNull();
    expect(result.notifications).toContainEqual({
      level: "warning",
      subject: fieldSubject("wind"),
      message: expect.stringMatching(/Open-Meteo.*network down/),
    });
    expect(subjectsAt(result.notifications, "warning")).toEqual(
      expect.arrayContaining(["field:temp.1", "field:altimeter.1"])
    );
  });

  it("raises a Warning on the weather step when G-AIRMET fails, leaving the flags as they were", async () => {
    mockGairmets.mockRejectedValue(new Error("gairmet down"));
    const { data, result } = await fetchWorksheetWeather(worksheet);

    expect(data?.turb).toBe(true);
    expect(result.notifications).toContainEqual({
      level: "warning",
      subject: { kind: "step", step: "weather" },
      message: expect.stringMatching(/G-AIRMET request failed \(gairmet down\)/),
    });
  });

  it("raises a Warning on the position field when there is no position to fetch for", async () => {
    mockBatch.mockResolvedValue({ metar: [], taf: [], airport: [], notifications: [] });
    const { result } = await fetchWorksheetWeather({
      ...worksheet,
      position: [null, null],
    });
    expect(mockPoint).not.toHaveBeenCalled();
    expect(result.notifications).toContainEqual(
      expect.objectContaining({
        level: "warning",
        subject: fieldSubject("position"),
      })
    );
  });

  it("reports a total failure as a Warning on the weather step and applies nothing", async () => {
    mockBatch.mockRejectedValue(new Error("boom"));
    const { data, result } = await fetchWorksheetWeather(worksheet);

    expect(data).toBeNull();
    expect(result.notifications).toEqual([
      {
        level: "warning",
        subject: { kind: "step", step: "weather" },
        message: expect.stringMatching(/Weather fetch failed.*boom/),
      },
    ]);
  });

  describe("airport code whitespace (#208)", () => {
    it("dedupes and trims ['KOGD', 'KOGD '] into a single KOGD request", async () => {
      await fetchWorksheetWeather({ ...worksheet, airport: ["KOGD", "KOGD "] });
      expect(mockBatch.mock.calls[0][0]).toEqual(["KOGD"]);
    });

    it("trims padded codes on both airports", async () => {
      await fetchWorksheetWeather({ ...worksheet, airport: [" kslc", "KOGD "] });
      expect(mockBatch.mock.calls[0][0]).toEqual(["KSLC", "KOGD"]);
    });
  });
});
