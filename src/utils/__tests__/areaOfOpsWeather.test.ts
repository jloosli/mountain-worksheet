import { buildAreaOfOpsWeather, greatCircleMidpoint } from "../areaOfOpsWeather";
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
