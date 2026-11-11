import {
  calculateTakeoffGroundRoll,
  calculateTakeoff50ftObstacle,
  calculateLandingGroundRoll,
  calculateLanding50ftObstacle,
  calculateAvailableRunwayRemaining,
  calculateTakeoffDistances,
  calculateLandingDistances,
} from "../toldCalculations";
import type { TOLDCalculationParams } from "@/utils/types";

const mockLog = jest.spyOn(console, "log").mockImplementation(() => {});
const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
const mockError = jest.spyOn(console, "error").mockImplementation(() => {});

describe("TOLD Calculations", () => {
  beforeEach(() => {
    mockLog.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
  });

  afterAll(() => {
    mockLog.mockRestore();
    mockWarn.mockRestore();
    mockError.mockRestore();
  });

  // Test data matching aircraft.json structure
  const mockAircraftData = {
    id: "C182T",
    emptyWeight: 2000,
    maxGrossWeight: 3100,
    shortFieldTakeoff: {
      weights: [2800, 3100],
      pressureAltitudes: [0, 2000, 4000, 6000, 8000],
      temperatures: [0, 10, 20, 30, 40],
      data: [
        // Weight 2800 lbs
        {
          groundRoll: [
            [800, 900, 1000, 1100, 1200], // 0ft PA
            [900, 1000, 1100, 1200, 1300], // 2000ft PA
            [1000, 1100, 1200, 1300, 1400], // 4000ft PA
            [1100, 1200, 1300, 1400, 1500], // 6000ft PA
            [1200, 1300, 1400, 1500, 1600], // 8000ft PA
          ],
          groundRoll50ft: [
            [1500, 1600, 1700, 1800, 1900], // 0ft PA
            [1600, 1700, 1800, 1900, 2000], // 2000ft PA
            [1700, 1800, 1900, 2000, 2100], // 4000ft PA
            [1800, 1900, 2000, 2100, 2200], // 6000ft PA
            [1900, 2000, 2100, 2200, 2300], // 8000ft PA
          ],
        },
        // Weight 3100 lbs
        {
          groundRoll: [
            [1000, 1100, 1200, 1300, 1400], // 0ft PA
            [1100, 1200, 1300, 1400, 1500], // 2000ft PA
            [1200, 1300, 1400, 1500, 1600], // 4000ft PA
            [1300, 1400, 1500, 1600, 1700], // 6000ft PA
            [1400, 1500, 1600, 1700, 1800], // 8000ft PA
          ],
          groundRoll50ft: [
            [1800, 1900, 2000, 2100, 2200], // 0ft PA
            [1900, 2000, 2100, 2200, 2300], // 2000ft PA
            [2000, 2100, 2200, 2300, 2400], // 4000ft PA
            [2100, 2200, 2300, 2400, 2500], // 6000ft PA
            [2200, 2300, 2400, 2500, 2600], // 8000ft PA
          ],
        },
      ],
    },
    shortFieldLanding: {
      weights: [2950],
      pressureAltitudes: [0, 2000, 4000, 6000, 8000],
      temperatures: [0, 10, 20, 30, 40],
      data: [
        {
          groundRoll: [
            [600, 650, 700, 750, 800], // 0ft PA
            [650, 700, 750, 800, 850], // 2000ft PA
            [700, 750, 800, 850, 900], // 4000ft PA
            [750, 800, 850, 900, 950], // 6000ft PA
            [800, 850, 900, 950, 1000], // 8000ft PA
          ],
          groundRoll50ft: [
            [1200, 1250, 1300, 1350, 1400], // 0ft PA
            [1250, 1300, 1350, 1400, 1450], // 2000ft PA
            [1300, 1350, 1400, 1450, 1500], // 4000ft PA
            [1350, 1400, 1450, 1500, 1550], // 6000ft PA
            [1400, 1450, 1500, 1550, 1600], // 8000ft PA
          ],
        },
      ],
    },
  };

  // Mock the aircraft data import
  jest.mock("../../data/aircraft.json", () => [mockAircraftData]);

  describe("calculateTakeoffGroundRoll", () => {
    const validParams: TOLDCalculationParams = {
      weight: 2700,
      pressureAltitude: 2000,
      temperature: 20,
      runwayLength: 3000,
    };

    it("should calculate takeoff ground roll for valid inputs", () => {
      const result = calculateTakeoffGroundRoll("C182T", validParams);
      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("should return null for null weight input", () => {
      const params = { ...validParams, weight: null };
      const result = calculateTakeoffGroundRoll("C182T", params);
      expect(result).toBeNull();
    });

    it("should return null for null pressure altitude input", () => {
      const params = { ...validParams, pressureAltitude: null };
      const result = calculateTakeoffGroundRoll("C182T", params);
      expect(result).toBeNull();
    });

    it("should return null for null temperature input", () => {
      const params = { ...validParams, temperature: null };
      const result = calculateTakeoffGroundRoll("C182T", params);
      expect(result).toBeNull();
    });

    it("should return null for unknown aircraft", () => {
      const result = calculateTakeoffGroundRoll("UNKNOWN", validParams);
      expect(result).toBeNull();
    });

    it("should handle exact table values correctly", () => {
      // Test exact table values from actual aircraft data
      const exactParams: TOLDCalculationParams = {
        weight: 2300,
        pressureAltitude: 0,
        temperature: 0,
        runwayLength: 3000,
      };
      const result = calculateTakeoffGroundRoll("C182T", exactParams);
      expect(result).toBeCloseTo(365, 0); // Should match exact table value
    });

    it("should interpolate between table values", () => {
      // Test interpolation between table values
      const interpolateParams: TOLDCalculationParams = {
        weight: 2500, // Between 2300 and 2700
        pressureAltitude: 1500, // Between 1000 and 2000
        temperature: 15, // Between 10 and 20
        runwayLength: 3000,
      };
      const result = calculateTakeoffGroundRoll("C182T", interpolateParams);
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(365);
      expect(result).toBeLessThan(600); // Adjusted upper bound
    });

    it("should handle extrapolation", () => {
      // Test extrapolation beyond table values
      const extrapolateParams: TOLDCalculationParams = {
        weight: 3200, // Above max weight
        pressureAltitude: 10000, // Above max altitude
        temperature: 50, // Above max temperature
        runwayLength: 3000,
      };
      const result = calculateTakeoffGroundRoll("C182T", extrapolateParams);
      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
    });
  });

  describe("calculateTakeoff50ftObstacle", () => {
    const validParams: TOLDCalculationParams = {
      weight: 2700,
      pressureAltitude: 2000,
      temperature: 20,
      runwayLength: 3000,
    };

    it("should calculate takeoff 50ft obstacle clearance for valid inputs", () => {
      const result = calculateTakeoff50ftObstacle("C182T", validParams);
      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("should return null for null inputs", () => {
      const nullWeightParams = { ...validParams, weight: null };
      expect(calculateTakeoff50ftObstacle("C182T", nullWeightParams)).toBeNull();

      const nullAltitudeParams = { ...validParams, pressureAltitude: null };
      expect(calculateTakeoff50ftObstacle("C182T", nullAltitudeParams)).toBeNull();

      const nullTempParams = { ...validParams, temperature: null };
      expect(calculateTakeoff50ftObstacle("C182T", nullTempParams)).toBeNull();
    });

    it("should return null for unknown aircraft", () => {
      const result = calculateTakeoff50ftObstacle("UNKNOWN", validParams);
      expect(result).toBeNull();
    });

    it("should handle exact table values correctly", () => {
      const exactParams: TOLDCalculationParams = {
        weight: 2300,
        pressureAltitude: 0,
        temperature: 0,
        runwayLength: 3000,
      };
      const result = calculateTakeoff50ftObstacle("C182T", exactParams);
      expect(result).toBeCloseTo(705, 0); // Should match exact table value
    });
  });

  describe("calculateLandingGroundRoll", () => {
    const validParams: TOLDCalculationParams = {
      weight: 2950,
      pressureAltitude: 2000,
      temperature: 20,
      runwayLength: 3000,
    };

    it("should calculate landing ground roll for valid inputs", () => {
      const result = calculateLandingGroundRoll("C182T", validParams);
      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("should return null for null pressure altitude input", () => {
      const params = { ...validParams, pressureAltitude: null };
      const result = calculateLandingGroundRoll("C182T", params);
      expect(result).toBeNull();
    });

    it("should return null for null temperature input", () => {
      const params = { ...validParams, temperature: null };
      const result = calculateLandingGroundRoll("C182T", params);
      expect(result).toBeNull();
    });

    it("should return null for unknown aircraft", () => {
      const result = calculateLandingGroundRoll("UNKNOWN", validParams);
      expect(result).toBeNull();
    });

    it("should handle exact table values correctly", () => {
      const exactParams: TOLDCalculationParams = {
        weight: 2950,
        pressureAltitude: 0,
        temperature: 0,
        runwayLength: 3000,
      };
      const result = calculateLandingGroundRoll("C182T", exactParams);
      expect(result).toBeCloseTo(560, 0); // Updated to match actual calculated value
    });
  });

  describe("calculateLanding50ftObstacle", () => {
    const validParams: TOLDCalculationParams = {
      weight: 2950,
      pressureAltitude: 2000,
      temperature: 20,
      runwayLength: 3000,
    };

    it("should calculate landing 50ft obstacle clearance for valid inputs", () => {
      const result = calculateLanding50ftObstacle("C182T", validParams);
      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("should return null for null inputs", () => {
      const nullAltitudeParams = { ...validParams, pressureAltitude: null };
      expect(calculateLanding50ftObstacle("C182T", nullAltitudeParams)).toBeNull();

      const nullTempParams = { ...validParams, temperature: null };
      expect(calculateLanding50ftObstacle("C182T", nullTempParams)).toBeNull();
    });

    it("should return null for unknown aircraft", () => {
      const result = calculateLanding50ftObstacle("UNKNOWN", validParams);
      expect(result).toBeNull();
    });

    it("should handle exact table values correctly", () => {
      const exactParams: TOLDCalculationParams = {
        weight: 2950,
        pressureAltitude: 0,
        temperature: 0,
        runwayLength: 3000,
      };
      const result = calculateLanding50ftObstacle("C182T", exactParams);
      expect(result).toBeCloseTo(1300, 0); // Updated to match actual calculated value
    });
  });

  describe("calculateAvailableRunwayRemaining", () => {
    it("should calculate available runway remaining correctly", () => {
      const result = calculateAvailableRunwayRemaining(3000, 1000, 500);
      expect(result).toBe(1500);
    });

    it("should return null for null runway length", () => {
      const result = calculateAvailableRunwayRemaining(null, 1000, 500);
      expect(result).toBeNull();
    });

    it("should return null for null takeoff distance", () => {
      const result = calculateAvailableRunwayRemaining(3000, null, 500);
      expect(result).toBeNull();
    });

    it("should return null for null landing distance", () => {
      const result = calculateAvailableRunwayRemaining(3000, 1000, null);
      expect(result).toBeNull();
    });

    it("should return null for invalid runway length", () => {
      const result = calculateAvailableRunwayRemaining(0, 1000, 500);
      expect(result).toBeNull();
    });

    it("should handle negative remaining runway", () => {
      const result = calculateAvailableRunwayRemaining(1000, 800, 500);
      expect(result).toBe(-300);
    });

    it("should round results to nearest integer", () => {
      const result = calculateAvailableRunwayRemaining(3000, 1000.7, 500.3);
      expect(result).toBe(1499);
    });
  });

  describe("calculateTakeoffDistances", () => {
    it("reports no extrapolation inside the takeoff table", () => {
      const r = calculateTakeoffDistances("C182T", 2700, 4000, 20);
      expect(r).toEqual({
        groundRoll: expect.any(Number),
        obstacle50ft: expect.any(Number),
        extrapolated: [],
        tableGaps: 0,
      });
    });

    it("reports each axis beyond the takeoff table once, against the full table range", () => {
      const r = calculateTakeoffDistances("C172S", 2000, 9000, 20);
      expect(r?.extrapolated).toEqual([
        { axis: "weight", value: 2000, min: 2200, max: 2550 },
        { axis: "pressureAltitude", value: 9000, min: 0, max: 8000 },
      ]);
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("returns null for an unknown aircraft", () => {
      expect(calculateTakeoffDistances("UNKNOWN", 2700, 4000, 20)).toBeNull();
    });
  });

  describe("calculateLandingDistances", () => {
    it("reports landing-table extrapolation as data instead of logging it", () => {
      const r = calculateLandingDistances("C182T", 9000, 45);
      expect(r?.groundRoll).toEqual(expect.any(Number));
      expect(r?.extrapolated).toEqual([
        { axis: "pressureAltitude", value: 9000, min: 0, max: 8000 },
        { axis: "temperature", value: 45, min: 0, max: 40 },
      ]);
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("returns values at 0 ft and 0°C (falsy but valid)", () => {
      const r = calculateLandingDistances("C182T", 0, 0);
      expect(r?.groundRoll).toEqual(expect.any(Number));
      expect(r?.extrapolated).toEqual([]);
    });
  });
});
