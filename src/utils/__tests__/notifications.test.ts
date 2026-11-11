import {
  countByLevel,
  fieldSubject,
  notificationKey,
  notificationsFor,
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

