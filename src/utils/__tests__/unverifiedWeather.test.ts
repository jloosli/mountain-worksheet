import { unverifiedWeatherNotifications } from "../unverifiedWeather";
import type { WorksheetData } from "../types";

const blank = {
  temp: [null, null, null],
  altimeter: [null, null, null],
  wind: [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
} as unknown as WorksheetData;

const withSharedTemp = { ...blank, temp: [21, null, null] } as WorksheetData;

describe("unverifiedWeatherNotifications", () => {
  it("raises a Caution on the weather step for weather values not fetched this session", () => {
    const notes = unverifiedWeatherNotifications(withSharedTemp, "unverified");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      level: "caution",
      subject: { kind: "step", step: "weather" },
    });
    expect(notes[0].message).toMatch(/shared link/i);
    expect(notes[0].message).toMatch(/fetch/i);
  });

  it("covers the weather fields a shared link carries, not the airport data", () => {
    const [note] = unverifiedWeatherNotifications(withSharedTemp, "unverified");
    expect(note.covers).toEqual([
      { kind: "field", field: "temp" },
      { kind: "field", field: "altimeter" },
      { kind: "field", field: "wind" },
      { kind: "field", field: "turb" },
      { kind: "field", field: "cielVis" },
      { kind: "field", field: "mtnObsc" },
    ]);
  });

  it.each(["fetched", "stale"] as const)("raises nothing once weather is %s this session", (status) => {
    expect(unverifiedWeatherNotifications(withSharedTemp, status)).toEqual([]);
  });

  it("raises nothing for a worksheet with no weather values", () => {
    expect(unverifiedWeatherNotifications(blank, "none")).toEqual([]);
  });

  describe.each(["cielVis", "turb", "mtnObsc"] as const)("a ticked %s box alone (#277)", (box) => {
    const ticked = { ...blank, [box]: true } as WorksheetData;

    it("raises the Caution before any fetch this session, though the status is none", () => {
      const notes = unverifiedWeatherNotifications(ticked, "none");
      expect(notes).toHaveLength(1);
      expect(notes[0].message).toMatch(/shared link/i);
    });

    it("raises nothing once weather has been fetched this session", () => {
      expect(unverifiedWeatherNotifications(ticked, "fetched")).toEqual([]);
    });
  });
});
