import { fetchWorksheetWeather } from "@/utils/weatherFetch";
import { getWeatherDataBatch } from "@/utils/aviationWeatherApi";
import { fetchPointForecast } from "@/utils/openMeteoApi";
import { fetchGAirmets } from "@/utils/gairmetApi";
import {
  fieldSubject,
  subjectKey,
  type Notification,
} from "@/utils/notifications";
import { fetchNotifications } from "@/utils/weatherSession";
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

// A Partial fetch: KXYZ exists but has no runway/elevation on record, and the
// TAF request failed, so its blank fields are Warnings (not Non-reporting).
const partialFetch = {
  metar: [kordMetar],
  taf: [],
  airport: [kordAirport, { icaoId: "KXYZ", lat: 40, lon: -110 }],
  notifications: [],
  failed: ["taf"],
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
    mockBatch.mockResolvedValue(partialFetch);
    const { data, result } = await fetchWorksheetWeather(worksheet);

    expect(data?.temp?.[0]).toBe(21);
    expect(data?.rwy?.[0]).toBe(8000);
    // Not the stale values from the earlier fetch
    expect(data?.temp?.[2]).toBeNull();
    expect(data?.altimeter?.[2]).toBeNull();
    expect(data?.rwy?.[1]).toBeNull();
    // KXYZ has no elevation on record: the worksheet's value is kept (#227),
    // and the Warning shows only if that value is blank.
    expect(data?.altitude?.[2]).toBe(2000);

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

    // The kept elevation isn't blank, so its Warning doesn't show; the
    // blanked runway's does.
    const shown = fetchNotifications(
      { ...worksheet, ...data } as WorksheetData,
      result
    ).map((n) => subjectKey(n.subject));
    expect(shown).not.toContain("field:altitude.2");
    expect(shown).toContain("field:rwy.1");
  });

  it("records what it fetched for and applied, so notifications derive from state", async () => {
    mockBatch.mockResolvedValue(partialFetch);
    const { data, result } = await fetchWorksheetWeather(worksheet);
    expect(result.fetchedFor).toEqual({
      airport: ["KORD", "KXYZ"],
      date: "2026-05-12",
      time: "16:00",
      duration: worksheet.duration,
      position: worksheet.position,
    });
    const state = { ...worksheet, ...data } as WorksheetData;
    const live = fetchNotifications(state, result);
    expect(subjectsAt(live, "warning")).toContain("field:temp.2");

    // The pilot enters the arrival temperature: that Warning goes away.
    const fixed = { ...state, temp: [21, state.temp[1], 12] as WorksheetData["temp"] };
    expect(subjectsAt(fetchNotifications(fixed, result), "warning")).not.toContain(
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

  describe("airport identity (#216)", () => {
    const kboiAirport = {
      icaoId: "KBOI",
      lat: 43.56,
      lon: -116.22,
      elev: 875,
      runway: [{ id: "10L/28R", length: 9763, alignment: 100 }],
    };
    const kboiMetar = {
      icaoId: "KBOI",
      obsTime: "2026-05-12T16:00:00Z",
      temp: 18,
      altim: 1016.9,
    };
    const directory: Record<
      string,
      { airport?: object; metar?: object; taf?: object }
    > = {
      KORD: { airport: kordAirport, metar: kordMetar },
      KBOI: { airport: kboiAirport, metar: kboiMetar },
    };
    // Answers like aviationweather.gov: only exact ids match.
    const serveDirectory = () =>
      mockBatch.mockImplementation(async (ids: string[]) => {
        const pick = (k: "airport" | "metar" | "taf") =>
          ids.flatMap((id) => (directory[id]?.[k] ? [directory[id][k]] : []));
        return {
          metar: pick("metar"),
          taf: pick("taf"),
          airport: pick("airport"),
          notifications: [],
        };
      });
    beforeEach(serveDirectory);

    it("resolves arrival BOI to KBOI, fills its data and names both IDs in an Advisory (regression)", async () => {
      const { data, result } = await fetchWorksheetWeather({
        ...worksheet,
        airport: ["KORD", "BOI"],
      });

      expect(data?.airport).toEqual(["KORD", "KBOI"]);
      expect(data?.temp?.[2]).toBe(18);
      expect(data?.altimeter?.[2]).toBe(30.03);
      expect(data?.altitude?.[2]).toBe(Math.round(875 * 3.28084));
      expect(data?.rwy?.[1]).toBe(9763);
      expect(result.notifications).toContainEqual({
        level: "advisory",
        subject: fieldSubject("airport", 1),
        message: expect.stringMatching(/KBOI.*BOI/),
      });
      expect(subjectsAt(result.notifications, "warning")).toEqual([]);

      // The Advisory survives the rewrite of the worksheet's airport.
      const state = { ...worksheet, ...data } as WorksheetData;
      expect(fetchNotifications(state, result)).toContainEqual(
        expect.objectContaining({
          level: "advisory",
          subject: fieldSubject("airport", 1),
        })
      );
    });

    it("raises a Caution on an ID that matches nothing even with a K prefix, and still computes the rest", async () => {
      const { data, result } = await fetchWorksheetWeather({
        ...worksheet,
        airport: ["KORD", "XQZ"],
      });

      expect(data?.airport).toEqual(["KORD", "XQZ"]);
      expect(result.notifications).toContainEqual({
        level: "caution",
        subject: fieldSubject("airport", 1),
        message: expect.stringMatching(
          /XQZ or KXQZ.*check the ID.*elevation, runway.*weather/i
        ),
      });
      // Its weather needs input: blank, with no Warning of its own. Its
      // runway and elevation keep whatever the worksheet held (#227).
      expect(data?.temp?.[2]).toBeNull();
      expect(data?.altimeter?.[2]).toBeNull();
      expect(data?.altitude?.[2]).toBe(2000);
      expect(data?.rwy?.[1]).toBe(6000);
      expect(subjectsAt(result.notifications, "warning")).toEqual([]);
      // The other airport and the area of operations still fill in.
      expect(data?.temp?.[0]).toBe(21);
      expect(data?.rwy?.[0]).toBe(8000);
      expect(data?.wind?.[0]?.some((v) => v !== null)).toBe(true);

      // The Caution holds until the pilot changes the ID.
      const state = { ...worksheet, ...data } as WorksheetData;
      expect(subjectsAt(fetchNotifications(state, result), "caution")).toContain(
        "field:airport.1"
      );
      const retyped = { ...state, airport: ["KORD", "XQY"] as [string, string] };
      expect(subjectsAt(fetchNotifications(retyped, result), "caution")).not.toContain(
        "field:airport.1"
      );
    });

    it("raises a Caution on an unknown 4-character ID without trying a correction", async () => {
      const { data, result } = await fetchWorksheetWeather({
        ...worksheet,
        airport: ["KQQQ", "KORD"],
      });
      expect(mockBatch).toHaveBeenCalledTimes(1);
      expect(data?.airport).toEqual(["KQQQ", "KORD"]);
      expect(result.notifications).toContainEqual(
        expect.objectContaining({
          level: "caution",
          subject: fieldSubject("airport", 0),
          message: expect.stringMatching(/No airport found for KQQQ\./),
        })
      );
    });

    it("treats an airport with no METAR or TAF as Non-reporting: Advisory, weather needs input, elevation and runway filled", async () => {
      directory.KXNR = {
        airport: {
          icaoId: "KXNR",
          lat: 44,
          lon: -115,
          elev: 1500,
          runway: [{ id: "16/34", length: 4200, alignment: 160 }],
        },
      };
      const { data, result } = await fetchWorksheetWeather({
        ...worksheet,
        airport: ["KORD", "KXNR"],
      });
      delete directory.KXNR;

      expect(result.notifications).toContainEqual({
        level: "advisory",
        subject: fieldSubject("airport", 1),
        message:
          "KXNR doesn't report weather; enter temperature and altimeter manually",
      });
      expect(data?.temp?.[2]).toBeNull();
      expect(data?.altimeter?.[2]).toBeNull();
      expect(data?.altitude?.[2]).toBe(Math.round(1500 * 3.28084));
      expect(data?.rwy?.[1]).toBe(4200);
      expect(subjectsAt(result.notifications, "warning")).toEqual([]);
      expect(subjectsAt(result.notifications, "caution")).toEqual([]);
    });

    it.each(["KORD", "PAJN", "PHNL"])(
      "never modifies %s, an ID that already resolves",
      async (id) => {
        directory.PAJN = { airport: { ...kordAirport, icaoId: "PAJN" }, metar: { ...kordMetar, icaoId: "PAJN" } };
        directory.PHNL = { airport: { ...kordAirport, icaoId: "PHNL" }, metar: { ...kordMetar, icaoId: "PHNL" } };
        const { data, result } = await fetchWorksheetWeather({
          ...worksheet,
          airport: [id, "KORD"],
        });
        delete directory.PAJN;
        delete directory.PHNL;

        expect(data?.airport).toEqual([id, "KORD"]);
        expect(mockBatch).toHaveBeenCalledTimes(1);
        expect(
          result.notifications.filter((n) => subjectKey(n.subject).startsWith("field:airport"))
        ).toEqual([]);
      }
    );

    it("never applies an ambiguous correction", async () => {
      mockBatch.mockImplementation(async (ids: string[]) => ({
        metar: [],
        taf: [],
        airport: ids.includes("KBOI") ? [kboiAirport, kboiAirport] : [kordAirport],
        notifications: [],
      }));
      const { data, result } = await fetchWorksheetWeather({
        ...worksheet,
        airport: ["KORD", "BOI"],
      });
      expect(data?.airport).toEqual(["KORD", "BOI"]);
      expect(subjectsAt(result.notifications, "caution")).toContain("field:airport.1");
    });

    it("neither corrects nor calls an ID Unknown when the airport lookup fails", async () => {
      mockBatch.mockImplementation(async () => ({
        metar: [kordMetar],
        taf: [],
        airport: [],
        notifications: [
          {
            level: "warning",
            subject: { kind: "step", step: "weather" },
            message: "Airport request failed (500)",
          },
        ],
        failed: ["airport"],
      }));
      const { data, result } = await fetchWorksheetWeather({
        ...worksheet,
        airport: ["KORD", "BOI"],
      });
      expect(mockBatch).toHaveBeenCalledTimes(1);
      expect(data?.airport).toEqual(["KORD", "BOI"]);
      expect(
        result.notifications.filter((n) => subjectKey(n.subject).startsWith("field:airport"))
      ).toEqual([]);
      // Unfilled fields are Warnings, as for any Partial fetch.
      expect(subjectsAt(result.notifications, "warning")).toContain("field:rwy.1");
    });

    it("does not apply a correction when looking it up fails", async () => {
      mockBatch.mockImplementation(async (ids: string[]) =>
        ids.includes("KBOI")
          ? { metar: [], taf: [], airport: [], notifications: [], failed: ["metar", "taf", "airport"] }
          : { metar: [kordMetar], taf: [], airport: [kordAirport], notifications: [] }
      );
      const { data, result } = await fetchWorksheetWeather({
        ...worksheet,
        airport: ["KORD", "BOI"],
      });
      expect(data?.airport).toEqual(["KORD", "BOI"]);
      expect(
        result.notifications.filter((n) => subjectKey(n.subject).startsWith("field:airport"))
      ).toEqual([]);
    });

    it("corrects the departure too, fetching the candidate once when both airports need it", async () => {
      const { data, result } = await fetchWorksheetWeather({
        ...worksheet,
        airport: ["boi ", "BOI"],
      });
      expect(data?.airport).toEqual(["KBOI", "KBOI"]);
      expect(mockBatch.mock.calls.map((c) => c[0])).toEqual([["BOI"], ["KBOI"]]);
      expect(subjectsAt(result.notifications, "advisory")).toEqual(
        expect.arrayContaining(["field:airport.0", "field:airport.1"])
      );
    });
  });
});
