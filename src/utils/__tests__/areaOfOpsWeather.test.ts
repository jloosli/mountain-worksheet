import {
  applyOpTempForAltitudeChange,
  buildAreaOfOpsWeather,
  greatCircleMidpoint,
  interpolateOpTempFromAloft,
} from "../areaOfOpsWeather";
import type { OpenMeteoPointForecast } from "../openMeteoApi";

const mockRaw: OpenMeteoPointForecast = {
  hourly: {
    time: ["2026-05-12T16:00", "2026-05-12T17:00"],
    pressure_msl: [1015, 1016],
    temperature_925hPa: [20, 21],
    temperature_900hPa: [18, 19],
    temperature_850hPa: [14, 15],
    temperature_800hPa: [10, 11],
    temperature_700hPa: [4, 5],
    temperature_600hPa: [-5, -4],
    temperature_500hPa: [-15, -14],
    wind_speed_925hPa: [5, 6],
    wind_speed_900hPa: [6, 7],
    wind_speed_850hPa: [8, 9],
    wind_speed_800hPa: [10, 11],
    wind_speed_700hPa: [14, 15],
    wind_speed_600hPa: [20, 21],
    wind_speed_500hPa: [30, 31],
    wind_direction_925hPa: [350, 351],
    wind_direction_900hPa: [355, 356],
    wind_direction_850hPa: [5, 6],
    wind_direction_800hPa: [10, 11],
    wind_direction_700hPa: [20, 21],
    wind_direction_600hPa: [30, 31],
    wind_direction_500hPa: [40, 41],
    // Heights in metres so heights*3.28084 ft come out roughly: 925→2500, 900→3300, 850→5000, 800→6500, 700→10000, 600→14000, 500→18000
    geopotential_height_925hPa: [762, 762],
    geopotential_height_900hPa: [1006, 1006],
    geopotential_height_850hPa: [1524, 1524],
    geopotential_height_800hPa: [1981, 1981],
    geopotential_height_700hPa: [3048, 3048],
    geopotential_height_600hPa: [4267, 4267],
    geopotential_height_500hPa: [5486, 5486],
  },
};

describe("greatCircleMidpoint", () => {
  it("computes midpoint of equal lat/lon pair as same point", () => {
    expect(greatCircleMidpoint([40, -111], [40, -111])).toEqual([40, -111]);
  });

  it("computes midpoint of two CONUS airports", () => {
    const [lat, lon] = greatCircleMidpoint([40.2, -111.7], [37.1, -113.6]);
    expect(lat).toBeGreaterThan(38);
    expect(lat).toBeLessThan(40);
    expect(lon).toBeGreaterThan(-113.6);
    expect(lon).toBeLessThan(-111.7);
  });
});

describe("buildAreaOfOpsWeather", () => {
  it("uses user position when both coords present", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.positionSource).toBe("user");
    expect(r.position).toEqual([40.5, -112.0]);
  });

  it("falls back to dep/arr midpoint when position blank", () => {
    const r = buildAreaOfOpsWeather({
      position: [null, null],
      depAirportLatLon: [40.2, -111.7],
      arrAirportLatLon: [37.1, -113.6],
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.positionSource).toBe("midpoint");
    expect(r.warnings.some((w) => /position not entered/i.test(w))).toBe(true);
  });

  it("populates 5-altitude wind table from interpolation", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    // wind table has direction[5], speed[5], temp[5]
    expect(r.windsAloft.direction).toHaveLength(5);
    expect(r.windsAloft.speed).toHaveLength(5);
    expect(r.windsAloft.temp).toHaveLength(5);
    expect(r.windsAloft.temp[0]).not.toBeNull();
  });

  it("computes opTemp at user altitude and opAltimeter from pressure_msl", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.opTemp).toBeGreaterThan(0);
    expect(r.opTemp).toBeLessThan(15);
    // 1015 hPa × 0.02953 ≈ 29.97 inHg
    expect(r.opAltimeter).toBeCloseTo(29.97, 2);
  });

  it("returns null op fields and warning when no airport coords either", () => {
    const r = buildAreaOfOpsWeather({
      position: [null, null],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.positionSource).toBe("none");
    expect(r.opTemp).toBeNull();
    expect(r.warnings.some((w) => /skipped/i.test(w))).toBe(true);
  });

  it("warns when forecast time snap delta exceeds 1 hour", () => {
    // mockRaw covers 2026-05-12T16:00 and T17:00; midTime far away → snap
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-13T05:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.warnings.some((w) => /forecast time snapped/i.test(w))).toBe(true);
  });
});

describe("interpolateOpTempFromAloft", () => {
  const aloft = [20, 14, 8, 2, -10]; // temps at 3k, 6k, 9k, 12k, 15k

  it("returns the bucket temp when altitude lands exactly on one", () => {
    expect(interpolateOpTempFromAloft(9000, aloft)).toBe(8);
  });

  it("interpolates between buckets", () => {
    // 10000 ft → 1/3 between 9000(8) and 12000(2) → 8 + (1/3)*(2-8) = 6
    expect(interpolateOpTempFromAloft(10000, aloft)).toBe(6);
  });

  it("snaps to lowest bucket below 3000 ft", () => {
    expect(interpolateOpTempFromAloft(1500, aloft)).toBe(20);
  });

  it("snaps to highest bucket above 15000 ft", () => {
    expect(interpolateOpTempFromAloft(18000, aloft)).toBe(-10);
  });

  it("returns null when altitude is missing", () => {
    expect(interpolateOpTempFromAloft(null, aloft)).toBeNull();
    expect(interpolateOpTempFromAloft(undefined, aloft)).toBeNull();
  });

  it("returns null when aloft temps are missing or all null", () => {
    expect(interpolateOpTempFromAloft(9000, null)).toBeNull();
    expect(
      interpolateOpTempFromAloft(9000, [null, null, null, null, null])
    ).toBeNull();
  });

  it("skips null buckets and interpolates from the rest", () => {
    // Only 3k=20 and 12k=2 available → at 9k, f=(9k-3k)/(12k-3k)=2/3 → 20 + 2/3*(2-20) = 8
    expect(
      interpolateOpTempFromAloft(9000, [20, null, null, 2, null])
    ).toBe(8);
  });

  it("returns the only available bucket when just one is present", () => {
    expect(
      interpolateOpTempFromAloft(10000, [null, null, 7, null, null])
    ).toBe(7);
  });

  it("snaps to the lowest *available* bucket when the 3k bucket is missing", () => {
    // 3k missing → 6k=14 is the lowest available. Altitude 4000 (below 6k)
    // snaps to 14, not to a null 3k value.
    expect(
      interpolateOpTempFromAloft(4000, [null, 14, 8, 2, -10])
    ).toBe(14);
  });

  it("snaps to the highest *available* bucket when the 15k bucket is missing", () => {
    // 15k missing → 12k=2 is the highest available. Altitude 16000 (above 12k)
    // snaps to 2, not to a null 15k value.
    expect(
      interpolateOpTempFromAloft(16000, [20, 14, 8, 2, null])
    ).toBe(2);
  });
});

describe("applyOpTempForAltitudeChange", () => {
  const aloftTemps = [20, 14, 8, 2, -10];
  const wind: [
    (number | null)[],
    (number | null)[],
    (number | null)[],
  ] = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    aloftTemps,
  ];

  it("recomputes temp[1] when altitude[1] changes (regression for #117)", () => {
    // User fetched weather with altitude[1] = 6000 (temp[1]=14), then bumps
    // altitude to 10000 ft. Expected new temp[1] interpolates 9k→12k: at 10k
    // that's 8 + (1/3)*(2-8) = 6.
    const prev = {
      altitude: [4500, 6000, 4490] as [number | null, number | null, number | null],
      temp: [21, 14, 19] as [number | null, number | null, number | null],
      wind,
    };
    const updates = {
      altitude: [4500, 10000, 4490] as [number | null, number | null, number | null],
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toEqual([21, 6, 19]);
  });

  it("snaps to lowest bucket when the new operating altitude is below 3k", () => {
    const prev = {
      altitude: [4500, 9000, 4490] as [number | null, number | null, number | null],
      temp: [21, 8, 19] as [number | null, number | null, number | null],
      wind,
    };
    const updates = {
      altitude: [4500, 1500, 4490] as [number | null, number | null, number | null],
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toEqual([21, 20, 19]);
  });

  it("returns null when altitude[1] is unchanged", () => {
    const prev = {
      altitude: [4500, 9000, 4490] as [number | null, number | null, number | null],
      temp: [21, 8, 19] as [number | null, number | null, number | null],
      wind,
    };
    const updates = {
      altitude: [4500, 9000, 5000] as [number | null, number | null, number | null], // only arrival changed
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toBeNull();
  });

  it("returns null when the update already carries an explicit temp (fresh weather fetch)", () => {
    // A weather fetch may include altitude, temp, and wind together. The
    // mapper already wrote the correct opTemp; don't second-guess it.
    const prev = {
      altitude: [null, null, null] as [number | null, number | null, number | null],
      temp: [null, null, null] as [number | null, number | null, number | null],
      wind: null,
    };
    const updates = {
      altitude: [4500, 10000, 4490] as [number | null, number | null, number | null],
      temp: [21, 4, 19] as [number | null, number | null, number | null],
      wind,
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toBeNull();
  });

  it("returns null when no winds-aloft data is available", () => {
    const prev = {
      altitude: [null, null, null] as [number | null, number | null, number | null],
      temp: [null, null, null] as [number | null, number | null, number | null],
      wind: null,
    };
    const updates = {
      altitude: [null, 10000, null] as [number | null, number | null, number | null],
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toBeNull();
  });

  it("returns null when the recomputed temp equals the existing temp[1]", () => {
    const prev = {
      altitude: [null, 6000, null] as [number | null, number | null, number | null],
      temp: [null, 14, null] as [number | null, number | null, number | null],
      wind,
    };
    const updates = {
      altitude: [null, 6001, null] as [number | null, number | null, number | null],
    };
    // Interpolation rounds to 14 again → no change → null
    expect(applyOpTempForAltitudeChange(prev, updates)).toBeNull();
  });
});
