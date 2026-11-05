import { deserializeState } from "../urlState";
import {
  deriveUrlNotifications,
  sanitizeWorksheetUrlState,
} from "../worksheetUrlState";
import { fieldSubject } from "../notifications";
import type { WorksheetData } from "../types";

const initial: WorksheetData = {
  pilot: "",
  date: "2026-11-04",
  time: "16:00",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  wind: [
    Array(5).fill(null) as (number | null)[],
    Array(5).fill(null) as (number | null)[],
    Array(5).fill(null) as (number | null)[],
  ] as WorksheetData["wind"],
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

const load = (query: string) =>
  sanitizeWorksheetUrlState(deserializeState(query, initial), query, initial);

describe("sanitizeWorksheetUrlState", () => {
  it("passes a well-formed link through with no notifications", () => {
    const r = load(
      "weight=2300&temp=12,,8&wind=,90,180||5,10,15&turb=1&date=2026-11-05&time=09:30"
    );
    expect(r.notifications).toEqual([]);
    expect(r.state.weight).toBe(2300);
    expect(r.state.temp).toEqual([12, null, 8]);
    expect(r.state.turb).toBe(true);
  });

  it("clears a non-numeric single value with a Warning on that field", () => {
    const r = load("weight=abc");
    expect(r.state.weight).toBeNull();
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("weight"),
        message: expect.stringMatching(/"abc".*isn't a number/),
      },
    ]);
  });

  it("clears a non-numeric array slot with a Warning on that slot", () => {
    const r = load("altimeter=29.92,x,30.01");
    expect(r.state.altimeter).toEqual([29.92, null, 30.01]);
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("altimeter", 1),
        message: expect.stringMatching(/"x".*isn't a number/),
      },
    ]);
  });

  it("clears a non-numeric winds-aloft cell with a Warning on its column", () => {
    const r = load("wind=,90,abc||5,10,15");
    expect(r.state.wind[0][2]).toBeNull();
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("wind", 2),
        message: expect.stringMatching(/"abc".*isn't a number/),
      },
    ]);
  });

  it("warns when a flag isn't 1/0 and was read as off", () => {
    const r = load("turb=yes");
    expect(r.state.turb).toBe(false);
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("turb"),
        message: expect.stringMatching(/"yes".*read as off/),
      },
    ]);
  });

  it("restores the default date and time when the link's are malformed", () => {
    const r = load("date=tomorrow&time=9am");
    expect(r.state.date).toBe("2026-11-04");
    expect(r.state.time).toBe("16:00");
    expect(r.notifications.map((n) => n.subject)).toEqual([
      fieldSubject("date"),
      fieldSubject("time"),
    ]);
  });

  it("restores the default date when the link's date doesn't exist on the calendar", () => {
    const r = load("date=2026-02-31");
    expect(r.state.date).toBe("2026-11-04");
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("date"),
        message: expect.stringMatching(/"2026-02-31"/),
      },
    ]);
  });

  it("keeps a real leap day from the link", () => {
    const r = load("date=2028-02-29");
    expect(r.state.date).toBe("2028-02-29");
    expect(r.notifications).toEqual([]);
  });
});

describe("deriveUrlNotifications", () => {
  it("keeps a link Warning while the field still holds the value it was given, and drops it after", () => {
    const r = load("weight=abc");
    expect(deriveUrlNotifications(r.state, r)).toHaveLength(1);
    expect(
      deriveUrlNotifications({ ...r.state, weight: 2300 }, r)
    ).toEqual([]);
  });
});
