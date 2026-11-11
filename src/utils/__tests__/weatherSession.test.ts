import {
  fieldSubject,
  stepSubject,
  subjectKey,
  type Notification,
  type WeatherFetchResult,
} from "@/utils/notifications";
import type { WorksheetData } from "@/utils/types";
import {
  canFetch,
  initialWeatherSession,
  sessionNotifications,
  weatherSessionReducer,
  weatherStatus,
  type WeatherSession,
  type WeatherSessionEvent,
} from "@/utils/weatherSession";

const base: WorksheetData = {
  pilot: "",
  date: "2026-05-12",
  time: "18:00",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["KOGD", "KLGU"],
  route: "",
  position: [null, null],
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)] as WorksheetData["wind"],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [null, null, null],
  altimeter: [null, null, null],
  altitude: [null, null, null],
  rwy: [null, null],
  weight: null,
  mtnEndorse: false,
  mtnCert: false,
};

/** Weather a fetch for `worksheet`'s inputs returns. */
const fetchFor = (
  worksheet: WorksheetData,
  data: Partial<WorksheetData> | null,
  notifications: Notification[] = [],
  at = new Date("2026-05-12T17:00:00Z"),
): WeatherSessionEvent => {
  const result: WeatherFetchResult = {
    fetchedFor: {
      airport: worksheet.airport,
      date: worksheet.date,
      time: worksheet.time,
      duration: worksheet.duration,
      position: worksheet.position,
    },
    applied: data ?? {},
    notifications,
  };
  return { type: "fetchApplied", data, result, at };
};

const fetched: Partial<WorksheetData> = {
  temp: [21, 5, 15],
  altimeter: [30.01, 30.0, 29.95],
  altitude: [4473, -1, 4457] as WorksheetData["altitude"],
  wind: [
    [270, 280, 290, 300, 310],
    [15, 20, 25, 30, 35],
    [10, 4, -2, -8, -14],
  ],
};

/** Replays `events` from a fresh session on `worksheet`. */
const replay = (
  events: ((s: WeatherSession) => WeatherSessionEvent)[],
  worksheet: WorksheetData = base,
): WeatherSession =>
  events.reduce(
    (s, event) => weatherSessionReducer(s, event(s)),
    initialWeatherSession(worksheet, null),
  );

const edit =
  (updates: Partial<WorksheetData>) =>
  (): WeatherSessionEvent => ({ type: "edit", updates });
const fetch =
  (data: Partial<WorksheetData> | null = fetched, notifications: Notification[] = []) =>
  (s: WeatherSession) =>
    fetchFor(s.worksheet, data, notifications);

const keys = (list: Notification[]) => list.map((n) => `${n.level} ${subjectKey(n.subject)}`);
const warnings = (s: WeatherSession) =>
  keys(sessionNotifications(s).filter((n) => n.level === "warning"));

describe("weather session — fetch, change, refetch", () => {
  it("warns on the arrival airport's fetched fields after the arrival changes, until a refetch", () => {
    // Fetched for an entered position, so the area weather doesn't move with the airports.
    const atPosition = { ...base, position: [40.5, -111.2] as WorksheetData["position"] };
    const changed = replay([fetch(), edit({ airport: ["KOGD", "KSLC"] })], atPosition);
    expect(warnings(changed)).toEqual([
      "warning field:temp.2",
      "warning field:altimeter.2",
      "warning field:altitude.2",
    ]);
    const refetched = weatherSessionReducer(changed, fetchFor(changed.worksheet, fetched));
    expect(warnings(refetched)).toEqual([]);
  });

  it("applies the fetched values and remembers when they arrived", () => {
    const s = replay([fetch()]);
    expect(s.worksheet.temp).toEqual([21, 5, 15]);
    expect(s.lastUpdated).toEqual(new Date("2026-05-12T17:00:00Z"));
    expect(weatherStatus(s)).toBe("fetched");
  });

  it("keeps the last successful time through a failed fetch, and shows the failure's Warning", () => {
    const failure: Notification = {
      level: "warning",
      subject: stepSubject("weather"),
      message: "Weather fetch failed",
    };
    const s = replay([fetch(), fetch(null, [failure])]);
    expect(s.lastUpdated).toEqual(new Date("2026-05-12T17:00:00Z"));
    expect(s.worksheet.temp).toEqual([21, 5, 15]);
    expect(sessionNotifications(s)).toEqual([failure]);
  });
});

describe("weather session — one fetch-input table for staleness and Warning retirement", () => {
  const noMetar: Notification = {
    level: "warning",
    subject: fieldSubject("temp", 0),
    message: "KOGD: no METAR",
  };

  it("keeps a departure Warning when only the arrival airport changes, and drops it when the departure does", () => {
    const fetchedNoDeparture = { ...fetched, temp: [null, 5, 15] as WorksheetData["temp"] };
    const s = replay([fetch(fetchedNoDeparture, [noMetar])]);
    expect(sessionNotifications(s)).toEqual([noMetar]);
    const arrivalMoved = weatherSessionReducer(s, {
      type: "edit",
      updates: { airport: ["KOGD", "KSLC"] },
    });
    expect(sessionNotifications(arrivalMoved)).toContainEqual(noMetar);
    const departureMoved = weatherSessionReducer(s, {
      type: "edit",
      updates: { airport: ["KSLC", "KLGU"] },
    });
    expect(sessionNotifications(departureMoved)).not.toContainEqual(noMetar);
  });

  it("keeps an area Warning fetched for an entered position when an airport changes", () => {
    const noForecast: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 1),
      message: "no point forecast",
    };
    const atPosition = { ...base, position: [40.5, -111.2] as WorksheetData["position"] };
    const s = replay(
      [
        fetch({ ...fetched, temp: [21, null, 15] as WorksheetData["temp"] }, [noForecast]),
        edit({ airport: ["KSLC", "KLGU"] }),
      ],
      atPosition,
    );
    expect(sessionNotifications(s)).toContainEqual(noForecast);
  });

  it("drops a step notification when any fetch input changes", () => {
    const step: Notification = {
      level: "caution",
      subject: stepSubject("weather"),
      message: "G-AIRMET request failed",
    };
    for (const updates of [
      { airport: ["KOGD", "KSLC"] as [string, string] },
      { time: "19:00" },
      { duration: 2 },
      { position: [40.5, -111.2] as WorksheetData["position"] },
    ]) {
      const s = replay([fetch(fetched, [step]), edit(updates)]);
      expect(sessionNotifications(s)).not.toContainEqual(step);
    }
  });
});

describe("weather session — operating temperature (#117)", () => {
  const withAloft = (s: WeatherSession) => fetchFor(s.worksheet, fetched);

  it("re-derives the operating temperature and describes it against the same worksheet", () => {
    const s = replay([
      withAloft,
      edit({ temp: [21, 0, 15] }),
      edit({ altitude: [4473, 9000, 4457] }),
    ]);
    expect(s.worksheet.temp[1]).toBe(-2);
    expect(keys(sessionNotifications(s))).toEqual(["caution field:temp.1"]);
    expect(sessionNotifications(s)[0].message).toMatch(/replacing your entry of 0°C/);
  });

  it("doesn't call the fetched operating temperature the pilot's entry", () => {
    const s = replay([withAloft, edit({ altitude: [4473, 9000, 4457] })]);
    expect(s.worksheet.temp[1]).toBe(-2);
    expect(sessionNotifications(s)).toEqual([]);
  });

  it("clears the Caution once the pilot re-enters the temperature", () => {
    const s = replay([
      withAloft,
      edit({ temp: [21, 0, 15] }),
      edit({ altitude: [4473, 9000, 4457] }),
      edit({ temp: [21, 0, 15] }),
    ]);
    expect(sessionNotifications(s)).toEqual([]);
  });
});

describe("weather session — rejected entries", () => {
  const rejection = (raw: string): WeatherSessionEvent => ({
    type: "entryRejected",
    key: "altimeter:0",
    entry: {
      raw,
      storedValue: null,
      notification: {
        level: "warning",
        subject: fieldSubject("altimeter", 0),
        message: `${raw} is out of range`,
      },
    },
  });

  it("holds a rejected entry's Warning until a fetch fills the field", () => {
    const s = weatherSessionReducer(initialWeatherSession(base, null), rejection("50"));
    expect(warnings(s)).toEqual(["warning field:altimeter.0"]);
    const filled = weatherSessionReducer(s, fetchFor(s.worksheet, fetched));
    expect(warnings(filled)).toEqual([]);
    expect(filled.rejected).toEqual({});
  });

  it("retires a rejected entry for good once the pilot changes the value", () => {
    let s = weatherSessionReducer(initialWeatherSession(base, null), rejection("50"));
    s = weatherSessionReducer(s, { type: "edit", updates: { altimeter: [29.9, null, null] } });
    s = weatherSessionReducer(s, { type: "edit", updates: { altimeter: [null, null, null] } });
    expect(warnings(s)).toEqual([]);
  });

  it("leaves the worksheet unchanged", () => {
    const s0 = initialWeatherSession(base, null);
    expect(weatherSessionReducer(s0, rejection("50")).worksheet).toBe(s0.worksheet);
  });
});

describe("weather session — shared link", () => {
  it("raises Unverified weather until a fetch succeeds this session", () => {
    const linked = { ...base, temp: [21, 5, 15] as WorksheetData["temp"] };
    const s = initialWeatherSession(linked, null);
    expect(keys(sessionNotifications(s))).toEqual(["caution step:weather"]);
    expect(sessionNotifications(weatherSessionReducer(s, fetchFor(linked, fetched)))).toEqual([]);
  });
});

describe("weather session — selectors", () => {
  it("can fetch once both airports, the date and the time are entered", () => {
    expect(canFetch(initialWeatherSession(base, null))).toBe(true);
    expect(canFetch(initialWeatherSession({ ...base, airport: ["KOGD", " "] }, null))).toBe(false);
  });

  it("is ready before a fetch and incomplete without the fetch inputs", () => {
    expect(weatherStatus(initialWeatherSession(base, null))).toBe("ready");
    expect(weatherStatus(initialWeatherSession({ ...base, time: "" }, null))).toBe("incomplete");
  });
});
