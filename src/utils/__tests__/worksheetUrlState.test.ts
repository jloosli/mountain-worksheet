import { deserializeState } from "../urlState";
import {
  deriveUrlNotifications,
  retireUrlNotifications,
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
      "weight=2300&temp=12,,8&wind=,90,180,,||5,10,15,,||,,,,&turb=1&date=2026-11-05&time=09:30",
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

  it("puts a malformed coordinate's Warning on the whole position, where it is shown", () => {
    const r = load("position=abc,-112");
    expect(r.state.position).toEqual([null, -112]);
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("position"),
        message: expect.stringMatching(/"abc".*isn't a number/),
      },
    ]);
  });

  it("clears a linked altimeter outside the editor's limits, with a Warning on that slot", () => {
    const r = load("altimeter=35,29.92,29.92");
    expect(r.state.altimeter).toEqual([null, 29.92, 29.92]);
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("altimeter", 0),
        message: expect.stringMatching(/altimeter value 35 .*28\.00–31\.00 inHg/),
      },
    ]);
  });

  it("clears linked winds outside the editor's limits for their row", () => {
    const r = load("wind=400,90,90,90,90||200,10,10,10,10||-60,0,0,0,0");
    expect(r.state.wind.map((row) => row[0])).toEqual([null, null, null]);
    expect(r.state.wind[0][1]).toBe(90);
    expect(r.notifications.map((n) => [n.subject, n.message])).toEqual([
      [fieldSubject("wind", 0), expect.stringMatching(/wind direction value 400 .*0–359°/)],
      [fieldSubject("wind", 0), expect.stringMatching(/wind speed value 200 .*0–150/)],
      [fieldSubject("wind", 0), expect.stringMatching(/temperature aloft value -60 .*-50–50°C/)],
    ]);
  });

  it("pads a short list to its slots and warns on the first slot", () => {
    const r = load("altimeter=29.92");
    expect(r.state.altimeter).toEqual([29.92, null, null]);
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("altimeter", 0),
        message: expect.stringMatching(/altimeter.*1 value instead of 3/),
      },
    ]);
  });

  it("cuts a long list to its slots and warns", () => {
    const r = load("temp=1,2,3,4");
    expect(r.state.temp).toEqual([1, 2, 3]);
    expect(r.notifications.map((n) => n.subject)).toEqual([fieldSubject("temp", 0)]);
  });

  it("clears a list that isn't a list, with a Warning", () => {
    const r = load("temp[a]=1");
    expect(r.state.temp).toEqual([null, null, null]);
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("temp", 0),
        message: expect.stringMatching(/temperature.*isn't a list/),
      },
    ]);
  });

  it("pads a short position on the whole position Subject", () => {
    const r = load("position=41.2");
    expect(r.state.position).toEqual([41.2, null]);
    expect(r.notifications.map((n) => n.subject)).toEqual([fieldSubject("position")]);
  });

  it("says nothing about an empty list", () => {
    expect(load("temp=").notifications).toEqual([]);
    expect(load("temp=").state.temp).toEqual([null, null, null]);
  });

  it("clears a non-numeric winds-aloft cell with a Warning on its column", () => {
    const r = load("wind=,90,abc,,||5,10,15,,||,,,,");
    expect(r.state.wind[0][2]).toBeNull();
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("wind", 2),
        message: expect.stringMatching(/"abc".*isn't a number/),
      },
    ]);
  });

  it("pads a truncated winds-aloft table to three rows with a Warning on the table", () => {
    const r = load("wind=90,90,90||5,10,15");
    expect(r.state.wind).toEqual([
      [90, 90, 90, null, null],
      [5, 10, 15, null, null],
      [null, null, null, null, null],
    ]);
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("wind"),
        message: expect.stringMatching(/winds aloft.*direction, speed and temperature/),
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
    expect(deriveUrlNotifications({ ...r.state, weight: 2300 }, r)).toEqual([]);
  });

  it("keeps a malformed wind cell's Warning when only another cell in its column changes", () => {
    const r = load("wind=abc,90,90,90,90||5,10,10,10,10||1,1,1,1,1");
    expect(r.notifications.map((n) => n.subject)).toEqual([fieldSubject("wind", 0)]);
    const speedChanged = r.state.wind.map((row) => [...row]) as WorksheetData["wind"];
    speedChanged[1][0] = 20;
    expect(deriveUrlNotifications({ ...r.state, wind: speedChanged }, r)).toHaveLength(1);
    const fixed = speedChanged.map((row) => [...row]) as WorksheetData["wind"];
    fixed[0][0] = 270;
    expect(deriveUrlNotifications({ ...r.state, wind: fixed }, r)).toEqual([]);
  });
});

describe("retireUrlNotifications", () => {
  it("retires a link Warning for good once its value is superseded", () => {
    const r = load("weight=abc");
    const entered = { ...r.state, weight: 2300 };
    const retired = retireUrlNotifications(r, entered);
    // Clearing the weight again doesn't bring back the link's Warning.
    expect(deriveUrlNotifications({ ...entered, weight: null }, retired)).toEqual([]);
  });

  it("retires a link Warning when a weather fetch fills that cell, even with the same value", () => {
    const r = load("wind=abc,90,90,90,90||5,10,10,10,10||1,1,1,1,1");
    const fetchedWind = r.state.wind; // the fetch couldn't get it either: still blank
    const retired = retireUrlNotifications(r, r.state, { wind: fetchedWind });
    expect(deriveUrlNotifications(r.state, retired)).toEqual([]);
  });

  it("keeps Warnings whose values are untouched", () => {
    const r = load("weight=abc&altimeter=29.92,x,30.01");
    const retired = retireUrlNotifications(r, { ...r.state, weight: 2300 });
    expect(deriveUrlNotifications(retired.state, retired).map((n) => n.subject)).toEqual([
      fieldSubject("altimeter", 1),
    ]);
  });
});
