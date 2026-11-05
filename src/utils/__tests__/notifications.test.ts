import {
  countByLevel,
  deriveNotifications,
  fieldSubject,
  notificationsFor,
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
  fetchedFor: { airport: ["KOGD", "KLGU"], date: "2026-05-12", time: "18:00" },
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
