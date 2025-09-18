import {
  bilinearInterpolate,
  bilinearInterpolateFlexible,
  bilinearInterpolateDetailed,
  createInterpolationTable,
  findInverseXgivenYandZ,
  type InterpolationTable,
  type FlexibleInterpolationTable,
} from "../interpolation";

// Mock console.warn for testing warning messages
const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

describe("error handling", () => {
  it("should throw error for empty axis arrays", () => {
    const emptyTable: InterpolationTable = {
      xAxis: [],
      yAxis: [0],
      data: [],
    };
    expect(() => bilinearInterpolate(emptyTable, 0, 0)).toThrow(
      "Axis arrays cannot be empty"
    );
  });

  it("should throw error for mismatched data dimensions", () => {
    const mismatchedTable: InterpolationTable = {
      xAxis: [0, 1000],
      yAxis: [10],
      data: [[100], [90, 80]], // Second row has more columns than yAxis length
    };
    expect(() => bilinearInterpolate(mismatchedTable, 0, 0)).toThrow(
      "All data rows must have 1 columns to match yAxis"
    );
  });
});

// Common test data
const simpleTable: InterpolationTable = {
  xAxis: [0, 1000, 2000],
  yAxis: [0, 10, 20],
  data: [
    [100, 90, 80], // Values at x=0
    [95, 85, 75], // Values at x=1000
    [90, 80, 70], // Values at x=2000
  ],
};

const singlePointTable: InterpolationTable = {
  xAxis: [1000],
  yAxis: [10],
  data: [[100]],
};

describe("Interpolation Functions", () => {
  beforeEach(() => {
    // Clear mock calls before each test
    mockWarn.mockClear();
  });

  afterAll(() => {
    // Restore console.warn after all tests
    mockWarn.mockRestore();
  });

  describe("Error Cases", () => {
    describe("Input Validation", () => {
      it("should throw error for missing data", () => {
        const invalidTable: InterpolationTable = {
          xAxis: [0, 1000],
          yAxis: [0, 10],
          data: [], // Empty data
        };
        expect(() => bilinearInterpolate(invalidTable, 500, 5)).toThrow(
          "Data rows (0) must match xAxis length (2)"
        );
      });

      it("should validate data dimensions", () => {
        const invalidTable: InterpolationTable = {
          xAxis: [0, 1000],
          yAxis: [0],
          data: [[100]], // Not enough rows to match xAxis length
        };
        expect(() => bilinearInterpolate(invalidTable, 500, 5)).toThrow(
          "Data rows (1) must match xAxis length (2)"
        );
      });

      it("should throw error for invalid axis data in flexible interpolation", () => {
        const invalidTable: FlexibleInterpolationTable = {
          altitude: "not an array" as unknown as number[],
          temperature: [0, 10],
          data: [[100, 90]],
        };
        expect(() =>
          bilinearInterpolateFlexible(invalidTable, 500, 5, {
            xAxisName: "altitude",
            yAxisName: "temperature",
          })
        ).toThrow("Invalid axis data");
      });
    });

    describe("Edge Cases", () => {
      it("should handle single-value axes correctly", () => {
        const singleXTable: InterpolationTable = {
          xAxis: [1000],
          yAxis: [0, 10],
          data: [[100, 90]],
        };
        expect(() => bilinearInterpolate(singleXTable, 1000, 5)).not.toThrow();

        const singleYTable: InterpolationTable = {
          xAxis: [0, 1000],
          yAxis: [10],
          data: [[100], [90]],
        };
        expect(() => bilinearInterpolate(singleYTable, 500, 10)).not.toThrow();
      });

      it("should validate minimum axis lengths for interpolation", () => {
        const invalidTable: InterpolationTable = {
          xAxis: [1000],
          yAxis: [10],
          data: [[100]],
        };
        // Single point table should work
        expect(() => bilinearInterpolate(invalidTable, 1000, 10)).not.toThrow();

        // But trying to interpolate with insufficient points should throw
        const insufficientTable: InterpolationTable = {
          xAxis: [1000],
          yAxis: [],
          data: [[]],
        };
        expect(() => bilinearInterpolate(insufficientTable, 1000, 10)).toThrow(
          "Axis arrays cannot be empty"
        );
      });
    });
  });

  describe("findInverseXgivenYandZ", () => {
    // Test data matching a real aircraft performance table
    const xAxis = [0, 2000, 4000, 6000]; // Pressure altitude
    const yAxis = [-20, 0, 20, 40]; // Temperature °C
    const data = [
      [1000, 900, 800, 700], // Climb rates at 0ft for each temp
      [900, 800, 700, 600], // Climb rates at 2000ft
      [800, 700, 600, 500], // Climb rates at 4000ft
      [700, 600, 500, 400], // Climb rates at 6000ft
    ];

    it("should find altitude where climb rate matches target at exact temperature", () => {
      // At -20°C (first column), find altitude where climb rate is 800 fpm
      const result = findInverseXgivenYandZ(data, xAxis, yAxis, 800, -20);
      expect(result).toBe(4000); // Should be exactly at 4000ft
    });

    it("should interpolate for intermediate temperature", () => {
      // At 30°C (between 20° and 40°), find altitude where climb rate is 550 fpm
      const result = findInverseXgivenYandZ(data, xAxis, yAxis, 550, 30);
      // At 30°C, for each altitude we interpolate between temps 20° and 40°:
      // 0ft: between 800 and 700 = 750 fpm
      // 2000ft: between 700 and 600 = 650 fpm
      // 4000ft: between 600 and 500 = 550 fpm
      // 6000ft: between 500 and 400 = 450 fpm
      // So 550 fpm occurs exactly at 4000ft
      expect(result).toBe(4000);
    });

    it("should handle out-of-range target values", () => {
      // Looking for a climb rate higher than available at this temperature
      const result = findInverseXgivenYandZ(data, xAxis, yAxis, 1100, 0);
      expect(result).toBeLessThan(0); // Should extrapolate below 0ft
    });

    it("should handle edge of data range", () => {
      // Test interpolation at the exact boundaries
      const atMinX = findInverseXgivenYandZ(data, xAxis, yAxis, 900, 0); // At 0°C, find where rate = 900 fpm (should be at 0ft)
      const atMaxX = findInverseXgivenYandZ(data, xAxis, yAxis, 600, 0); // At 0°C, find where rate = 600 fpm (should be at 6000ft)
      expect(atMinX).toBeCloseTo(0, 0);
      expect(atMaxX).toBeCloseTo(6000, 0);
    });

    it("should validate input dimensions", () => {
      // Test with mismatched dimensions
      const invalidData = [
        [1, 2],
        [3, 4],
      ];
      const invalidXAxis = [1, 2, 3];
      const invalidYAxis = [1];

      expect(() => {
        findInverseXgivenYandZ(invalidData, invalidXAxis, invalidYAxis, 2, 0);
      }).toThrow(); // Should throw due to dimension mismatch
    });
  });

  describe("createInterpolationTable", () => {
    const xValues = [0, 1000, 2000];
    const yValues = [0, 10, 20];
    const dataMatrix = [
      [100, 90, 80],
      [95, 85, 75],
      [90, 80, 70],
    ];

    it("should create a standard interpolation table", () => {
      const table = createInterpolationTable(xValues, yValues, dataMatrix);
      expect(table).toEqual({
        xAxis: xValues,
        yAxis: yValues,
        data: dataMatrix,
      });
    });

    it("should create a flexible interpolation table with custom axis names", () => {
      const table = createInterpolationTable(
        xValues,
        yValues,
        dataMatrix,
        "altitude",
        "temperature"
      );
      expect(table).toEqual({
        xAxis: xValues,
        yAxis: yValues,
        data: dataMatrix,
        altitude: xValues,
        temperature: yValues,
      });
    });
  });

  describe("bilinearInterpolateDetailed", () => {
    it("should return correct interpolation with bounds info", () => {
      const result = bilinearInterpolateDetailed(simpleTable, 1000, 10);
      expect(result).toEqual({
        value: 85,
        wasExtrapolated: false,
        bounds: {
          xMin: 0,
          xMax: 2000,
          yMin: 0,
          yMax: 20,
        },
      });
    });

    it("should indicate extrapolation correctly", () => {
      const result = bilinearInterpolateDetailed(simpleTable, -500, 25);
      expect(result.wasExtrapolated).toBe(true);
      expect(result.bounds).toEqual({
        xMin: 0,
        xMax: 2000,
        yMin: 0,
        yMax: 20,
      });
    });

    it("should handle single point tables", () => {
      const result = bilinearInterpolateDetailed(singlePointTable, 2000, 20);
      expect(result).toEqual({
        value: 100,
        wasExtrapolated: true,
        bounds: {
          xMin: 1000,
          xMax: 1000,
          yMin: 10,
          yMax: 10,
        },
      });
    });
  });

  describe("bilinearInterpolateFlexible", () => {
    const flexibleTable: FlexibleInterpolationTable = {
      altitude: [0, 1000, 2000],
      temperature: [0, 10, 20],
      data: [
        [100, 90, 80],
        [95, 85, 75],
        [90, 80, 70],
      ],
    };

    it("should interpolate with custom axis names", () => {
      const result = bilinearInterpolateFlexible(flexibleTable, 1000, 10, {
        xAxisName: "altitude",
        yAxisName: "temperature",
      });
      expect(result).toBe(85);
    });

    it("should handle extrapolation options", () => {
      const result = bilinearInterpolateFlexible(flexibleTable, -500, 0, {
        xAxisName: "altitude",
        yAxisName: "temperature",
        allowExtrapolation: true,
        warnOnExtrapolation: true,
      });
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining("Extrapolating")
      );
      expect(typeof result).toBe("number");
    });

    it("should throw error for invalid axis names", () => {
      expect(() =>
        bilinearInterpolateFlexible(flexibleTable, 1000, 10, {
          xAxisName: "invalidAxis",
          yAxisName: "temperature",
        })
      ).toThrow("Invalid axis data");
    });
  });

  describe("bilinearInterpolate", () => {
    it("should interpolate exact points correctly", () => {
      expect(bilinearInterpolate(simpleTable, 0, 0)).toBe(100);
      expect(bilinearInterpolate(simpleTable, 2000, 20)).toBe(70);
    });

    it("should interpolate between points correctly", () => {
      // Midpoint interpolation
      expect(bilinearInterpolate(simpleTable, 1000, 10)).toBe(85);

      // Quarter-point interpolation
      expect(bilinearInterpolate(simpleTable, 500, 5)).toBeCloseTo(92.5, 5);
    });

    it("should handle single-point tables", () => {
      expect(bilinearInterpolate(singlePointTable, 1000, 10)).toBe(100);
      // Even when requesting different points, should return the only value
      expect(bilinearInterpolate(singlePointTable, 500, 5)).toBe(100);
    });

    it("should warn when extrapolating", () => {
      bilinearInterpolate(simpleTable, -500, 0);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining("Extrapolating outside table bounds")
      );

      mockWarn.mockClear();
      bilinearInterpolate(simpleTable, 0, 25);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining("Extrapolating outside table bounds")
      );
    });

    it("should throw error when extrapolation is disabled", () => {
      expect(() =>
        bilinearInterpolate(simpleTable, -500, 0, { allowExtrapolation: false })
      ).toThrow("Values outside table range");

      expect(() =>
        bilinearInterpolate(simpleTable, 0, 25, { allowExtrapolation: false })
      ).toThrow("Values outside table range");
    });

    it("should not warn when extrapolation warnings are disabled", () => {
      bilinearInterpolate(simpleTable, -500, 0, { warnOnExtrapolation: false });
      expect(mockWarn).not.toHaveBeenCalled();
    });

    describe("error handling", () => {
      it("should throw error for empty axis arrays", () => {
        const emptyTable: InterpolationTable = {
          xAxis: [],
          yAxis: [0],
          data: [],
        };
        expect(() => bilinearInterpolate(emptyTable, 0, 0)).toThrow(
          "Axis arrays cannot be empty"
        );
      });

      it("should throw error for mismatched data dimensions", () => {
        const mismatchedTable: InterpolationTable = {
          xAxis: [0, 1000],
          yAxis: [0],
          data: [[100, 90]], // More columns than yAxis length
        };
        expect(() => bilinearInterpolate(mismatchedTable, 0, 0)).toThrow(
          "All data rows must have 1 columns to match yAxis"
        );
      });
    });
  });
});
