import aircraftData from "../../data/aircraft.json";
import { findInverseXgivenYandZ } from "../interpolation";

describe("C206 Aircraft with Null Values", () => {
  const c206 = aircraftData.find((a) => a.id === "C206");

  beforeAll(() => {
    if (!c206) {
      throw new Error("C206 aircraft not found in aircraft.json");
    }
  });

  it("should have correct climb performance data structure", () => {
    expect(c206).toBeDefined();
    expect(c206?.climbPerformance.pressureAltitudes).toHaveLength(11);
    expect(c206?.climbPerformance.climbSpeeds).toHaveLength(11); // Fixed: should match pressureAltitudes length
    expect(c206?.climbPerformance.temperatures).toHaveLength(4);
    expect(c206?.climbPerformance.data).toHaveLength(11);
  });

  it("should have null values at high altitude and high temperature", () => {
    const lastRow = c206?.climbPerformance.data[10]; // 24000 ft altitude
    expect(lastRow).toEqual([230, 120, null, null]);
  });

  it("should calculate service ceiling without crashing (issue from URL)", () => {
    // This is the scenario from the bug report URL
    // ?temp=1 means OAT = 1°C
    const targetROC = 300; // Service ceiling is where rate of climb = 300 ft/min
    const oat = 1; // °C from the URL

    expect(() => {
      const altitude = findInverseXgivenYandZ(
        c206!.climbPerformance.data,
        c206!.climbPerformance.pressureAltitudes,
        c206!.climbPerformance.temperatures,
        targetROC,
        oat
      );
      expect(altitude).toBeDefined();
      expect(typeof altitude).toBe("number");
      expect(altitude).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it("should calculate service ceiling at various temperatures", () => {
    const targetROC = 300;
    const temperatures = [-20, 0, 20]; // Skip 40°C as it has nulls at high altitude

    temperatures.forEach((temp) => {
      const altitude = findInverseXgivenYandZ(
        c206!.climbPerformance.data,
        c206!.climbPerformance.pressureAltitudes,
        c206!.climbPerformance.temperatures,
        targetROC,
        temp
      );
      expect(altitude).toBeDefined();
      expect(typeof altitude).toBe("number");
      expect(altitude).toBeGreaterThan(0);
    });
  });

  it("should handle temperature that requires interpolation with partial null data", () => {
    // Temperature 30°C is between 20 and 40, where 40°C column has nulls at high altitude
    const targetROC = 500;
    const oat = 30;

    expect(() => {
      const altitude = findInverseXgivenYandZ(
        c206!.climbPerformance.data,
        c206!.climbPerformance.pressureAltitudes,
        c206!.climbPerformance.temperatures,
        targetROC,
        oat
      );
      expect(altitude).toBeDefined();
      expect(typeof altitude).toBe("number");
    }).not.toThrow();
  });
});
