import {
  fetchPointForecast,
  interpolateAtAltitude,
  PRESSURE_LEVELS,
  M_TO_FT,
} from "../openMeteoApi";

global.fetch = jest.fn();

describe("openMeteoApi", () => {
  describe("fetchPointForecast", () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockClear();
    });

    it("requests temperature/wind/geopotential at all configured pressure levels", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hourly: { time: [] } }),
      });
      await fetchPointForecast(40.5, -112, {
        start: new Date("2026-05-12T00:00:00Z"),
        end: new Date("2026-05-13T00:00:00Z"),
      });
      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain("/api/open-meteo");
      expect(url).toContain("latitude=40.5");
      expect(url).toContain("longitude=-112");
      expect(url).toContain("wind_speed_unit=kn");
      for (const level of PRESSURE_LEVELS) {
        expect(url).toContain(`temperature_${level}hPa`);
        expect(url).toContain(`wind_speed_${level}hPa`);
        expect(url).toContain(`wind_direction_${level}hPa`);
        expect(url).toContain(`geopotential_height_${level}hPa`);
      }
      expect(url).toContain("pressure_msl");
    });

    it("throws on non-OK response", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "down",
      });
      await expect(
        fetchPointForecast(40.5, -112, {
          start: new Date(),
          end: new Date(),
        })
      ).rejects.toThrow(/Open-Meteo/);
    });
  });

  describe("interpolateAtAltitude", () => {
    // Heights chosen so 9000 ft falls between 850 hPa (5000 ft) and 700 hPa (10000 ft)
    const sample = {
      timeIdx: 0,
      heightsFtByLevel: {
        925: 2500,
        900: 3300,
        850: 5000,
        800: 6500,
        700: 10000,
        600: 14000,
        500: 18000,
      },
      tempByLevel: { 925: 20, 900: 18, 850: 14, 800: 10, 700: 4, 600: -5, 500: -15 },
      wspdByLevel: { 925: 5, 900: 6, 850: 8, 800: 10, 700: 14, 600: 20, 500: 30 },
      wdirByLevel: { 925: 350, 900: 355, 850: 5, 800: 10, 700: 20, 600: 30, 500: 40 }, // wraps 0
    };

    it("brackets and linearly interpolates temp at 9000 ft", () => {
      const r = interpolateAtAltitude(9000, sample);
      // 9000 between 850 (5000ft, 14C) and 700 (10000ft, 4C)
      // f = (9000-5000)/(10000-5000) = 0.8 → 14 + 0.8*(4-14) = 14 - 8 = 6
      expect(r.temp).toBe(6);
      expect(r.wspd).toBe(13); // 8 + 0.8*(14-8)=8+4.8 → round → 13
    });

    it("circular-interpolates wind direction across 0/360 boundary", () => {
      // Between 925 (2500ft, 350°) and 900 (3300ft, 355°), at 2900ft → ~352.5° → round 353
      const r = interpolateAtAltitude(2900, sample);
      expect(r.wdir).toBeGreaterThanOrEqual(351);
      expect(r.wdir).toBeLessThanOrEqual(355);
    });

    it("snaps to highest level and warns when target above range", () => {
      const r = interpolateAtAltitude(20000, sample);
      expect(r.temp).toBe(-15); // 500 hPa value
      expect(r.warnings.length).toBeGreaterThan(0);
      expect(r.warnings[0]).toMatch(/above/i);
    });

    it("snaps to lowest level and warns when target below range", () => {
      const r = interpolateAtAltitude(1000, sample);
      expect(r.temp).toBe(20); // 925 hPa value
      expect(r.warnings.length).toBeGreaterThan(0);
      expect(r.warnings[0]).toMatch(/below/i);
    });

    it("converts metres to feet via M_TO_FT", () => {
      expect(M_TO_FT).toBeCloseTo(3.28084, 4);
    });
  });
});
