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

  it("keeps a runway Warning through a date or time change, and drops it when its airport changes", () => {
    const noRunway: Notification = {
      level: "warning",
      subject: fieldSubject("rwy", 1),
      message: "KLGU: no runway data",
    };
    const s = replay([fetch(fetched, [noRunway])]);
    expect(sessionNotifications(weatherSessionReducer(s, { type: "edit", updates: { time: "19:00" } }))).toContainEqual(noRunway);
    expect(
      sessionNotifications(weatherSessionReducer(s, { type: "edit", updates: { airport: ["KOGD", "KSLC"] } })),
    ).not.toContainEqual(noRunway);
  });

  it("keeps the no-position Warning through a time or duration change, and drops it when the midpoint moves", () => {
    const noPosition: Notification = {
      level: "warning",
      subject: fieldSubject("position"),
      message: "Operating area weather skipped",
    };
    const s = replay([fetch(fetched, [noPosition])]);
    for (const updates of [{ time: "19:00" }, { duration: 2 }]) {
      expect(sessionNotifications(weatherSessionReducer(s, { type: "edit", updates }))).toContainEqual(noPosition);
    }
    expect(
      sessionNotifications(weatherSessionReducer(s, { type: "edit", updates: { airport: ["KSLC", "KLGU"] } })),
    ).not.toContainEqual(noPosition);
  });

  it("keeps an unresolved elevation Warning through a time or duration change, and drops it when its airport changes", () => {
    const noElevation: Notification = {
      level: "warning",
      subject: fieldSubject("altitude", 2),
      message: "KLGU: no field elevation",
    };
    const s = replay([fetch({ ...fetched, altitude: [4473, -1, null] as WorksheetData["altitude"] }, [noElevation])]);
    for (const updates of [{ time: "19:00" }, { duration: 2 }]) {
      expect(sessionNotifications(weatherSessionReducer(s, { type: "edit", updates }))).toContainEqual(noElevation);
    }
    expect(
      sessionNotifications(weatherSessionReducer(s, { type: "edit", updates: { airport: ["KOGD", "KSLC"] } })),
    ).not.toContainEqual(noElevation);
  });

  it("never calls the pilot's own position stale: a fetch doesn't fill it", () => {
    const halfEntered = { ...base, position: [40.5, null] as WorksheetData["position"] };
    // The applied snapshot is the merged worksheet, so it carries the position.
    const s = replay(
      [fetch({ ...fetched, position: halfEntered.position }), edit({ airport: ["KSLC", "KLGU"] })],
      halfEntered,
    );
    expect(warnings(s)).not.toContain("warning field:position");
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

describe("weather session — link notifications", () => {
  it("retires a link notification on the operating temperature once an altitude change re-derives it", () => {
    const linked: WorksheetData = { ...base, ...fetched, temp: [21, 0, 15] } as WorksheetData;
    const linkWarning: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 1),
      message: "Operating temperature from the link was reset",
    };
    const s0 = initialWeatherSession(linked, {
      state: linked,
      notifications: [linkWarning],
      cells: [{ field: "temp", index: 1 }],
    });
    expect(sessionNotifications(s0)).toContainEqual(linkWarning);
    const s = weatherSessionReducer(s0, { type: "edit", updates: { altitude: [4473, 9000, 4457] } });
    expect(s.worksheet.temp[1]).toBe(-2);
    expect(s.linkLoad?.notifications).toEqual([]);
  });
});

describe("weather session — selectors", () => {
  it("can fetch once both airports, the date and the time are entered", () => {
    expect(canFetch(initialWeatherSession(base, null))).toBe(true);
    expect(canFetch(initialWeatherSession({ ...base, airport: ["KOGD", " "] }, null))).toBe(false);
  });

});

describe("weather session — weather status (#285)", () => {
  const withWind = {
    ...base,
    wind: [[270, null, null, null, null], Array(5).fill(null), Array(5).fill(null)],
  } as WorksheetData;

  it("is none with no weather values and no fetch this session", () => {
    expect(weatherStatus(initialWeatherSession(base, null))).toBe("none");
  });

  it("is unverified with weather values that weren't fetched this session, as from a shared link", () => {
    expect(weatherStatus(initialWeatherSession(withWind, null))).toBe("unverified");
    expect(weatherStatus(replay([edit({ temp: [20, null, null] })]))).toBe("unverified");
  });

  it("is none for a ticked advisory box alone, which isn't weather data (#277)", () => {
    expect(weatherStatus(initialWeatherSession({ ...base, cielVis: true }, null))).toBe("none");
  });

  it("is fetched once a fetch applies weather, even over unverified values", () => {
    expect(weatherStatus(replay([fetch()]))).toBe("fetched");
    expect(weatherStatus(replay([fetch()], withWind))).toBe("fetched");
  });

  it("stays none or unverified after a fetch that applied nothing", () => {
    expect(weatherStatus(replay([fetch(null)]))).toBe("none");
    expect(weatherStatus(replay([fetch(null)], withWind))).toBe("unverified");
  });

  it("is stale once a fetch input changes under fetched values, and fetched again after a refetch", () => {
    const stale = replay([fetch(), edit({ time: "20:00" })]);
    expect(weatherStatus(stale)).toBe("stale");
    expect(weatherStatus(weatherSessionReducer(stale, fetchFor(stale.worksheet, fetched)))).toBe(
      "fetched",
    );
  });

  it("stays stale, with its Warnings, when a refetch for the new inputs fails", () => {
    const failure: Notification = {
      level: "warning",
      subject: stepSubject("weather"),
      message: "Weather fetch failed.",
    };
    const s = replay([fetch(), edit({ time: "20:00" }), fetch(null, [failure])]);
    expect(weatherStatus(s)).toBe("stale");
    expect(warnings(s)).toContain("warning field:temp.0");
    expect(warnings(s)).toContain("warning step:weather");
  });

  it("is fetched again once the pilot replaces every stale value with their own", () => {
    const atPosition = { ...base, position: [40.5, -111.2] as WorksheetData["position"] };
    const stale = replay([fetch(), edit({ airport: ["KOGD", "KSLC"] })], atPosition);
    expect(weatherStatus(stale)).toBe("stale");
    const replaced = weatherSessionReducer(stale, {
      type: "edit",
      updates: { temp: [21, 5, 12], altimeter: [30.01, 30.0, 30.1], altitude: [4473, -1, 4227] },
    });
    expect(weatherStatus(replaced)).toBe("fetched");
  });
});
