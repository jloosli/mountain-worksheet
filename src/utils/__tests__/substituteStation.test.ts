import {
  pickSubstituteStation,
  selectNonReportingWeather,
  substituteSearchBoxes,
} from "@/utils/substituteStation";
import type { METARResponse } from "@/utils/aviationWeatherApi";
import { geodesicDestination } from "@/utils/positionMath";

// The Non-reporting field. One degree of latitude is 60 nm.
const field = { id: "KXNR", lat: 44, lon: -115 };

const metar = (icaoId: string, lat: number, lon: number, extra: Partial<METARResponse> = {}) =>
  ({
    icaoId,
    lat,
    lon,
    obsTime: 1778601600,
    temp: 10,
    altim: 1013.2,
    ...extra,
  }) as METARResponse;

describe("pickSubstituteStation", () => {
  it("picks the nearest reporting station and names its distance and direction from the field", () => {
    const station = pickSubstituteStation(field, [
      metar("KFAR", 45, -115), // 60 nm N
      metar("KNEA", 44.2, -114.75), // ~16 nm NE
    ]);
    expect(station?.metar.icaoId).toBe("KNEA");
    expect(station?.location).toBe("KNEA, 16 nm NE");
  });

  it("skips a nearer station whose METAR has no altimeter", () => {
    const station = pickSubstituteStation(field, [
      metar("KNOA", 44.1, -115, { altim: null }), // 6 nm N, no altimeter
      metar("KSTH", 43.5, -115), // 30 nm S
    ]);
    expect(station?.location).toBe("KSTH, 30 nm S");
  });

  it("finds no station beyond 100 nm", () => {
    expect(pickSubstituteStation(field, [metar("KFAR", 45.75, -115)])).toBeNull(); // 105 nm
    expect(pickSubstituteStation(field, [])).toBeNull();
  });

  it("accepts a station just inside 100 nm", () => {
    expect(pickSubstituteStation(field, [metar("KEDG", 42.35, -115)])?.location).toBe(
      "KEDG, 99 nm S",
    );
  });

  it("uses each station's latest observation", () => {
    const station = pickSubstituteStation(field, [
      metar("KNEA", 44.2, -114.75, { obsTime: 1778598000, altim: 1000 }),
      metar("KNEA", 44.2, -114.75, { obsTime: 1778601600, altim: 1020 }),
    ]);
    expect(station?.metar.altim).toBe(1020);
  });

  it("names all eight compass directions", () => {
    const dir = (lat: number, lon: number) =>
      pickSubstituteStation(field, [metar("KDIR", lat, lon)])
        ?.location.split(" ")
        .pop();
    expect([
      dir(44.3, -115),
      dir(44.2, -114.72),
      dir(44, -114.6),
      dir(43.8, -114.72),
      dir(43.7, -115),
      dir(43.8, -115.28),
      dir(44, -115.4),
      dir(44.2, -115.28),
    ]).toEqual(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  });

  it("never picks the field itself, nor a station with no position", () => {
    expect(
      pickSubstituteStation(field, [
        metar("KXNR", 44, -115),
        { ...metar("KNOP", 44.1, -115), lat: undefined } as unknown as METARResponse,
      ]),
    ).toBeNull();
  });
});

describe("substituteSearchBoxes", () => {
  it("covers every point within 100 nm of the field, and not much more", () => {
    const boxes = substituteSearchBoxes(44, -115);
    expect(boxes).toHaveLength(1);
    const [minLat, minLon, maxLat, maxLon] = boxes[0];
    for (let bearing = 0; bearing < 360; bearing += 15) {
      const p = geodesicDestination(44, -115, bearing, 100);
      expect(p.lat).toBeGreaterThanOrEqual(minLat);
      expect(p.lat).toBeLessThanOrEqual(maxLat);
      expect(p.lon).toBeGreaterThanOrEqual(minLon);
      expect(p.lon).toBeLessThanOrEqual(maxLon);
    }
    // 100 nm is about 1.67° of latitude, and 2.3° of longitude at 44° N
    expect(maxLat - minLat).toBeLessThan(2 * 1.75);
    expect(maxLon - minLon).toBeLessThan(2 * 2.45);
  });
});

describe("substituteSearchBoxes across the antimeridian", () => {
  const inSome = (boxes: [number, number, number, number][], lat: number, lon: number) =>
    boxes.some(([a, b, c, d]) => lat >= a && lat <= c && lon >= b && lon <= d);

  it.each([179.8, -179.8])(
    "splits a box at ±180° so every box is valid and stations on both sides are covered (%s)",
    (lon) => {
      const boxes = substituteSearchBoxes(52, lon);
      expect(boxes).toHaveLength(2);
      for (const [, minLon, , maxLon] of boxes) {
        expect(minLon).toBeGreaterThanOrEqual(-180);
        expect(maxLon).toBeLessThanOrEqual(180);
      }
      expect(inSome(boxes, 52, 179.9)).toBe(true);
      expect(inSome(boxes, 52, -179.9)).toBe(true);
    },
  );

  it("picks a station across the antimeridian by its true distance", () => {
    const station = pickSubstituteStation({ id: "PXNR", lat: 52, lon: 179.8 }, [
      metar("PEAS", 52, -179.9), // ~11 nm E across the line
      metar("PWES", 52, 179.0), // ~30 nm W
    ]);
    expect(station?.location).toBe("PEAS, 11 nm E");
  });
});

describe("selectNonReportingWeather with range checks", () => {
  const found = {
    kind: "found" as const,
    station: pickSubstituteStation(field, [metar("KNEA", 44.2, -114.75, { altim: 1016.9 })])!,
  };
  const at = new Date("2026-05-12T16:00:00Z");

  it("names a rejected model temperature as needing input, not as filled", () => {
    const sel = selectNonReportingWeather("KXNR", at, 0, found, 51, {
      temp: (t) => t <= 50,
      altimeter: () => true,
    });
    expect(sel.temp).toBeNull();
    expect(sel.altimeter).toBe(30.03);
    const messages = sel.notifications.map((n) => `${n.level} ${n.message}`);
    expect(messages).toContainEqual(
      expect.stringMatching(/^warning KXNR: .*51°C.*out of valid range/),
    );
    expect(messages.join("\n")).not.toMatch(/temperature from the Open-Meteo/);
    expect(messages).toContainEqual(
      expect.stringMatching(
        /^advisory KXNR doesn't report weather; .*enter the temperature manually/,
      ),
    );
  });

  it("raises no Caution for a station altimeter the range check rejects", () => {
    const sel = selectNonReportingWeather("KXNR", at, 0, found, 8, {
      temp: () => true,
      altimeter: () => false,
    });
    expect(sel.altimeter).toBeNull();
    expect(sel.notifications.filter((n) => n.level === "caution")).toEqual([]);
    expect(sel.notifications).toContainEqual(
      expect.objectContaining({
        level: "warning",
        message: expect.stringMatching(
          /30\.03 inHg from Substitute station KNEA.*out of valid range/,
        ),
      }),
    );
    expect(sel.notifications).toContainEqual(
      expect.objectContaining({
        level: "advisory",
        message: expect.stringMatching(/enter the altimeter manually/),
      }),
    );
  });
});
