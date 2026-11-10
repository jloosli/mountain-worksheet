import {
  countByLevel,
  deriveNotifications,
  fieldSubject,
  notificationKey,
  notificationsFor,
  staleFetchNotifications,
  valueSubjectGroup,
  stepOf,
  stepSubject,
  subjectKey,
  valueSubject,
  type Notification,
  type WeatherFetchResult,
} from "@/utils/notifications";
import type { WorksheetData } from "@/utils/types";

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
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)] as [
    (number | null)[],
    (number | null)[],
    (number | null)[],
  ],
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

const fetchFor = (
  notifications: Notification[],
  applied: Partial<WorksheetData> = {}
): WeatherFetchResult => ({
  fetchedFor: {
    airport: ["KOGD", "KLGU"],
    date: "2026-05-12",
    time: "18:00",
    duration: null,
    position: [null, null],
  },
  applied,
  notifications,
});

describe("subjects", () => {
  it("gives each subject a stable key", () => {
    expect(subjectKey(fieldSubject("temp", 0))).toBe("field:temp.0");
    expect(subjectKey(fieldSubject("wind"))).toBe("field:wind");
    expect(subjectKey(stepSubject("weather"))).toBe("step:weather");
    expect(subjectKey(valueSubject("da.departure", "decision"))).toBe(
      "value:da.departure"
    );
  });

  it("maps each subject to the step that shows it", () => {
    expect(stepOf(fieldSubject("airport", 0))).toBe("sortie");
    expect(stepOf(fieldSubject("position"))).toBe("sortie");
    expect(stepOf(fieldSubject("altitude", 1))).toBe("sortie");
    expect(stepOf(fieldSubject("altitude", 0))).toBe("weather");
    expect(stepOf(fieldSubject("temp", 2))).toBe("weather");
    expect(stepOf(fieldSubject("wind", 3))).toBe("weather");
    expect(stepOf(fieldSubject("turb"))).toBe("weather");
    expect(stepOf(stepSubject("decision"))).toBe("decision");
    expect(stepOf(valueSubject("da.departure", "decision"))).toBe("decision");
  });

  it("finds the notifications about one subject", () => {
    const a: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 0),
      message: "a",
    };
    const b: Notification = {
      level: "caution",
      subject: fieldSubject("temp", 2),
      message: "b",
    };
    expect(notificationsFor([a, b], fieldSubject("temp", 0))).toEqual([a]);
  });

  it("counts notifications by level", () => {
    const list: Notification[] = [
      { level: "warning", subject: stepSubject("weather"), message: "x" },
      { level: "warning", subject: stepSubject("weather"), message: "y" },
      { level: "advisory", subject: stepSubject("weather"), message: "z" },
    ];
    expect(countByLevel(list)).toEqual({ warning: 2, caution: 0, advisory: 1 });
  });
});

describe("deriveNotifications", () => {
  it("has no notifications before any fetch", () => {
    expect(deriveNotifications(base, null)).toEqual([]);
  });

  it("keeps a field Warning while the field is blank", () => {
    const warning: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 0),
      message: "KOGD: no METAR or TAF",
    };
    expect(deriveNotifications(base, fetchFor([warning]))).toEqual([warning]);
  });

  it("drops a field Warning once the pilot enters a value", () => {
    const warning: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 0),
      message: "KOGD: no METAR or TAF",
    };
    const state = { ...base, temp: [12, null, null] as WorksheetData["temp"] };
    expect(deriveNotifications(state, fetchFor([warning]))).toEqual([]);
  });

  it("keeps a winds-aloft column Warning until every cell in the column holds a value", () => {
    const warning: Notification = {
      level: "warning",
      subject: fieldSubject("wind", 2),
      message: "no data at 9,000 ft",
    };
    const partly = base.wind.map((row) => [...row]) as WorksheetData["wind"];
    partly[1][2] = 15;
    const filled = partly.map((row) => [...row]) as WorksheetData["wind"];
    filled[0][2] = 270;
    filled[2][2] = -4;
    expect(deriveNotifications(base, fetchFor([warning]))).toEqual([warning]);
    expect(
      deriveNotifications({ ...base, wind: partly }, fetchFor([warning]))
    ).toEqual([warning]);
    expect(
      deriveNotifications({ ...base, wind: filled }, fetchFor([warning]))
    ).toEqual([]);
  });

  it("drops a whole-table winds-aloft Warning once any cell holds a value", () => {
    const warning: Notification = {
      level: "warning",
      subject: fieldSubject("wind"),
      message: "winds aloft couldn't be fetched",
    };
    const partly = base.wind.map((row) => [...row]) as WorksheetData["wind"];
    partly[1][2] = 15;
    expect(
      deriveNotifications({ ...base, wind: partly }, fetchFor([warning]))
    ).toEqual([]);
  });

  it("keeps a field Caution while the field still holds the fetched value", () => {
    const caution: Notification = {
      level: "caution",
      subject: fieldSubject("temp", 2),
      message: "using nearest TAF period",
    };
    const applied = { temp: [null, null, 8] as WorksheetData["temp"] };
    const state = { ...base, temp: [null, null, 8] as WorksheetData["temp"] };
    expect(deriveNotifications(state, fetchFor([caution], applied))).toEqual([
      caution,
    ]);
  });

  it("drops a field Caution once the pilot overrides the fetched value", () => {
    const caution: Notification = {
      level: "caution",
      subject: fieldSubject("temp", 2),
      message: "using nearest TAF period",
    };
    const applied = { temp: [null, null, 8] as WorksheetData["temp"] };
    const state = { ...base, temp: [null, null, 10] as WorksheetData["temp"] };
    expect(deriveNotifications(state, fetchFor([caution], applied))).toEqual(
      []
    );
  });

  it("keeps a step notification while the fetch inputs are unchanged", () => {
    const warning: Notification = {
      level: "warning",
      subject: stepSubject("weather"),
      message: "G-AIRMET request failed",
    };
    expect(deriveNotifications(base, fetchFor([warning]))).toEqual([warning]);
  });

  it("drops step notifications and field Warnings when an airport, date or time changes", () => {
    const step: Notification = {
      level: "warning",
      subject: stepSubject("weather"),
      message: "fetch failed",
    };
    const field: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 0),
      message: "KOGD: no METAR",
    };
    const result = fetchFor([step, field]);
    expect(
      deriveNotifications(
        { ...base, airport: ["KSLC", "KLGU"] },
        result
      )
    ).toEqual([]);
    expect(deriveNotifications({ ...base, date: "2026-05-13" }, result)).toEqual(
      []
    );
    expect(deriveNotifications({ ...base, time: "19:00" }, result)).toEqual([]);
  });

  it("drops step notifications when the duration changes", () => {
    const step: Notification = {
      level: "warning",
      subject: stepSubject("weather"),
      message: "no TAF period covers the arrival time",
    };
    expect(deriveNotifications({ ...base, duration: 3 }, fetchFor([step]))).toEqual([]);
  });

  it("drops step notifications and field Warnings when the area-of-ops position changes", () => {
    const step: Notification = {
      level: "warning",
      subject: stepSubject("weather"),
      message: "no operating-area position",
    };
    const field: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 1),
      message: "no point forecast",
    };
    const result = fetchFor([step, field]);
    expect(deriveNotifications(base, result)).toEqual([step, field]);
    expect(deriveNotifications({ ...base, position: [40.5, -111.2] }, result)).toEqual([]);
  });

  // A position that isn't fully entered still means the airport midpoint, so
  // typing one coordinate doesn't move the point a refetch would use (#251).
  it("keeps step notifications and field Warnings while the position is half-entered", () => {
    const step: Notification = {
      level: "warning",
      subject: stepSubject("weather"),
      message: "no TAF period covers the arrival time",
    };
    const field: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 1),
      message: "no point forecast",
    };
    const result = fetchFor([step, field]);
    expect(deriveNotifications({ ...base, position: [40.5, null] }, result)).toEqual([step, field]);
    expect(deriveNotifications({ ...base, position: [null, -111.2] }, result)).toEqual([
      step,
      field,
    ]);

    // And back: fetched with a half-entered position, then cleared.
    const halfEntered = {
      ...result,
      fetchedFor: { ...result.fetchedFor, position: [40.5, null] as WorksheetData["position"] },
    };
    expect(deriveNotifications(base, halfEntered)).toEqual([step, field]);
  });

  // Airport weather is fetched at the airport, not the area-of-ops position.
  it("keeps an unresolved airport-field Warning when only the position changes", () => {
    const arrival: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 2),
      message: "KLGU: no METAR",
    };
    const departure: Notification = {
      level: "warning",
      subject: fieldSubject("altimeter", 0),
      message: "KOGD: no METAR",
    };
    const result = fetchFor([arrival, departure]);
    expect(deriveNotifications({ ...base, position: [40.5, -111.2] }, result)).toEqual([
      arrival,
      departure,
    ]);
  });

  // Departure weather is fetched for the departure time, which the duration
  // doesn't move; arrival and area weather are for times it does. Elevations
  // and runways belong to the airport, not a time.
  it("keeps Warnings on fields the duration doesn't move when only the duration changes", () => {
    const departure: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 0),
      message: "KOGD: no METAR",
    };
    const arrival: Notification = {
      level: "warning",
      subject: fieldSubject("temp", 2),
      message: "KLGU: no TAF period covers the arrival time",
    };
    const area: Notification = {
      level: "warning",
      subject: fieldSubject("wind", 0),
      message: "no winds aloft",
    };
    const departureRunway: Notification = {
      level: "warning",
      subject: fieldSubject("rwy", 0),
      message: "KOGD: runway length not found",
    };
    const arrivalRunway: Notification = {
      level: "warning",
      subject: fieldSubject("rwy", 1),
      message: "KLGU: runway length not found",
    };
    const result = fetchFor([departure, departureRunway, arrival, area, arrivalRunway]);
    expect(deriveNotifications({ ...base, duration: 3 }, result)).toEqual([
      departure,
      departureRunway,
      arrivalRunway,
    ]);
  });

  it("treats a blank and a zero duration as the same fetch input", () => {
    const step: Notification = {
      level: "warning",
      subject: stepSubject("weather"),
      message: "fetch failed",
    };
    expect(deriveNotifications({ ...base, duration: 0 }, fetchFor([step]))).toEqual([step]);
  });

  it("treats airport codes case- and whitespace-insensitively when comparing fetch inputs", () => {
    const step: Notification = {
      level: "warning",
      subject: stepSubject("weather"),
      message: "fetch failed",
    };
    expect(
      deriveNotifications(
        { ...base, airport: ["kogd ", "KLGU"] },
        fetchFor([step])
      )
    ).toEqual([step]);
  });
});

describe("notificationKey", () => {
  const n: Notification = {
    level: "caution",
    subject: fieldSubject("temp", 2),
    message: "Nearest TAF period",
  };

  it("is the same for notifications with the same level, Subject and message", () => {
    expect(notificationKey({ ...n })).toBe(notificationKey(n));
  });

  it("differs when the level, Subject or message differs", () => {
    const key = notificationKey(n);
    expect(notificationKey({ ...n, level: "warning" })).not.toBe(key);
    expect(notificationKey({ ...n, subject: fieldSubject("temp", 0) })).not.toBe(key);
    expect(notificationKey({ ...n, message: "Other" })).not.toBe(key);
  });
});

describe("valueSubjectGroup", () => {
  it("names the group of computed values a value Subject belongs to", () => {
    expect(valueSubjectGroup(valueSubject("told.arrival.landing", "decision"))).toBe("told");
    expect(valueSubjectGroup(valueSubject("told.departure", "decision"))).toBe("told");
    expect(valueSubjectGroup(valueSubject("climb.vy.operating", "decision"))).toBe("climb");
    expect(valueSubjectGroup(valueSubject("maneuvering", "decision"))).toBe("maneuvering");
  });

  it("is undefined for an unknown value id and for non-value Subjects", () => {
    expect(valueSubjectGroup(valueSubject("tolds.arrival", "decision"))).toBeUndefined();
    expect(valueSubjectGroup(fieldSubject("temp", 1))).toBeUndefined();
    expect(valueSubjectGroup(stepSubject("decision"))).toBeUndefined();
  });
});

describe("staleFetchNotifications", () => {
  const fetched: WorksheetData = {
    ...base,
    airport: ["KOGD", "KLGU"],
    temp: [21, 5, 15],
    altimeter: [30.01, 30.0, 29.95],
    altitude: [4473, 11500, 4457],
    wind: [
      [270, null, null, null, null],
      [15, null, null, null, null],
      [10, null, null, null, null],
    ],
    turb: true,
  };
  const applied: Partial<WorksheetData> = {
    temp: fetched.temp,
    altimeter: fetched.altimeter,
    altitude: [4473, -1, 4457] as WorksheetData["altitude"],
    wind: fetched.wind,
    turb: true,
  };
  const fetch = fetchFor([], applied);
  // Fetched for an entered position, so an airport change leaves the area
  // weather alone.
  const position: WorksheetData["position"] = [40.5, -111.2];
  const fetchAtPosition = { ...fetch, fetchedFor: { ...fetch.fetchedFor, position } };
  const fetchedAtPosition = { ...fetched, position };
  const subjects = (list: Notification[]) => list.map((n) => subjectKey(n.subject));

  it("raises nothing while the fetch's airports, date and time are unchanged", () => {
    expect(staleFetchNotifications(fetched, fetch)).toEqual([]);
    expect(staleFetchNotifications(fetched, null)).toEqual([]);
  });

  it("warns on the arrival airport's fetched fields when the arrival airport changes", () => {
    const state = {
      ...fetchedAtPosition,
      airport: ["KOGD", "KSLC"] as WorksheetData["airport"],
    };
    const list = staleFetchNotifications(state, fetchAtPosition);
    expect(subjects(list)).toEqual(["field:temp.2", "field:altimeter.2", "field:altitude.2"]);
    expect(list[0]).toEqual({
      level: "warning",
      subject: fieldSubject("temp", 2),
      message: "Fetched for KLGU at 2026-05-12 18:00; refetch weather.",
    });
  });

  it("ignores a change only in letter case or spacing", () => {
    const state = { ...fetched, airport: ["kogd ", "KLGU"] as WorksheetData["airport"] };
    expect(staleFetchNotifications(state, fetch)).toEqual([]);
  });

  it("warns on every fetched field when the date or time changes", () => {
    const list = staleFetchNotifications({ ...fetched, time: "20:00" }, fetch);
    expect(subjects(list)).toEqual([
      "field:temp.0",
      "field:altimeter.0",
      "field:altitude.0",
      "field:temp.2",
      "field:altimeter.2",
      "field:altitude.2",
      "field:temp.1",
      "field:altimeter.1",
      "field:wind.0",
      "field:turb",
    ]);
    expect(list.find((n) => n.subject.kind === "field" && n.subject.field === "wind")?.message).toBe(
      "Fetched for 2026-05-12 18:00; refetch weather."
    );
  });

  // The arrival temperature is fetched for departure time + duration and the
  // operating temperature for the midpoint, so a duration change leaves the
  // landing and climb calculations on temperatures for a different time.
  it("warns on the arrival and area fields, not departure, when the duration changes", () => {
    const list = staleFetchNotifications({ ...fetched, duration: 3 }, fetch);
    expect(subjects(list)).toEqual([
      "field:temp.2",
      "field:altimeter.2",
      "field:altitude.2",
      "field:temp.1",
      "field:altimeter.1",
      "field:wind.0",
      "field:turb",
    ]);
    expect(list[0]).toEqual({
      level: "warning",
      subject: fieldSubject("temp", 2),
      message: "Fetched for KLGU at 2026-05-12 18:00 with no duration; refetch weather.",
    });
    const fetchedWith2h = {
      ...fetch,
      fetchedFor: { ...fetch.fetchedFor, duration: 2 },
    };
    expect(
      staleFetchNotifications({ ...fetched, duration: 3 }, fetchedWith2h)[0].message
    ).toBe("Fetched for KLGU at 2026-05-12 18:00 with a 2 h duration; refetch weather.");
    expect(staleFetchNotifications({ ...fetched, duration: 2 }, fetchedWith2h)).toEqual([]);
  });

  // The area-of-ops point forecast and G-AIRMET flags are fetched for the
  // position, so moving it leaves them describing somewhere else. Airport
  // weather is fetched at the airports and is unaffected.
  it("warns on the area fields, not the airports, when the position changes", () => {
    const list = staleFetchNotifications({ ...fetched, position: [40.5, -111.2] }, fetch);
    expect(subjects(list)).toEqual([
      "field:temp.1",
      "field:altimeter.1",
      "field:wind.0",
      "field:turb",
    ]);
    expect(list[0].message).toBe(
      "Fetched for the airport midpoint at 2026-05-12 18:00; refetch weather."
    );

    const fetchedAtPosition = {
      ...fetch,
      fetchedFor: { ...fetch.fetchedFor, position: [40.5, -111.2] as [number, number] },
    };
    const atPosition = { ...fetched, position: [40.5, -111.2] as WorksheetData["position"] };
    expect(staleFetchNotifications(atPosition, fetchedAtPosition)).toEqual([]);
    expect(
      staleFetchNotifications({ ...fetched, position: [40.6, -111.2] }, fetchedAtPosition)[0]
        .message
    ).toBe("Fetched for 40.5000, -111.2000 at 2026-05-12 18:00; refetch weather.");
    // Clearing the position moves the area to the airport midpoint.
    expect(subjects(staleFetchNotifications(fetched, fetchedAtPosition))).toContain(
      "field:temp.1"
    );
  });

  // A half-entered position still means the airport midpoint (#251).
  it("doesn't warn on the area fields while the position is half-entered", () => {
    expect(staleFetchNotifications({ ...fetched, position: [40.5, null] }, fetch)).toEqual([]);
    expect(staleFetchNotifications({ ...fetched, position: [null, -111.2] }, fetch)).toEqual([]);

    // Fetched with a half-entered position (so at the midpoint): clearing it
    // is no change, but completing it moves the area off the midpoint.
    const fetchedHalfEntered = {
      ...fetch,
      fetchedFor: { ...fetch.fetchedFor, position: [40.5, null] as WorksheetData["position"] },
    };
    expect(staleFetchNotifications(fetched, fetchedHalfEntered)).toEqual([]);
    const completed = staleFetchNotifications(
      { ...fetched, position: [40.5, -111.2] },
      fetchedHalfEntered
    );
    expect(subjects(completed)).toContain("field:temp.1");
    expect(completed[0].message).toBe(
      "Fetched for the airport midpoint at 2026-05-12 18:00; refetch weather."
    );
  });

  // With no position entered, the area weather is fetched at the midpoint of
  // the two airports, so changing either airport moves it.
  it("warns on the area fields when an airport change moves the midpoint", () => {
    const state = { ...fetched, airport: ["KOGD", "KSLC"] as WorksheetData["airport"] };
    const list = staleFetchNotifications(state, fetch);
    expect(subjects(list)).toEqual([
      "field:temp.2",
      "field:altimeter.2",
      "field:altitude.2",
      "field:temp.1",
      "field:altimeter.1",
      "field:wind.0",
      "field:turb",
    ]);
    expect(list.find((n) => subjectKey(n.subject) === "field:temp.1")?.message).toBe(
      "Fetched for the airport midpoint at 2026-05-12 18:00; refetch weather."
    );
  });

  it("warns on a fetched runway length when its airport changes, but not when only the time does", () => {
    const withRunways = fetchFor([], { ...applied, rwy: [5500, 5861] });
    const state = { ...fetched, rwy: [5500, 5861] as WorksheetData["rwy"] };
    const moved = { ...state, airport: ["KOGD", "KSLC"] as WorksheetData["airport"] };
    expect(subjects(staleFetchNotifications(moved, withRunways))).toContain("field:rwy.1");
    expect(subjects(staleFetchNotifications(moved, withRunways))).not.toContain("field:rwy.0");
    expect(
      subjects(staleFetchNotifications({ ...state, time: "20:00" }, withRunways))
    ).not.toContain("field:rwy.0");
  });

  it("leaves a field the pilot has since changed", () => {
    const state = {
      ...fetchedAtPosition,
      airport: ["KOGD", "KSLC"] as WorksheetData["airport"],
      temp: [21, 5, 12] as WorksheetData["temp"],
    };
    expect(subjects(staleFetchNotifications(state, fetchAtPosition))).toEqual([
      "field:altimeter.2",
      "field:altitude.2",
    ]);
  });
});
