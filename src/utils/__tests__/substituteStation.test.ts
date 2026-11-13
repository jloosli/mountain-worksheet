import { pickSubstituteStation, substituteSearchBox } from "@/utils/substituteStation";
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

describe("substituteSearchBox", () => {
  it("covers every point within 100 nm of the field, and not much more", () => {
    const [minLat, minLon, maxLat, maxLon] = substituteSearchBox(44, -115);
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
