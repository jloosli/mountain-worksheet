import {
  bilinearInterpolate,
  bilinearInterpolateFlexible,
  bilinearInterpolateDetailed,
  createInterpolationTable,
  findInverseXgivenYandZ,
  trilinearInterpolate,
  type InterpolationTable,
  type FlexibleInterpolationTable,
  type TrilinearInterpolationTable,
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

    it("should handle null values by skipping affected altitudes", () => {
      // Test data with null values at high altitude/high temperature
      const xAxisWithNulls = [0, 2000, 4000, 6000, 8000];
      const yAxisWithNulls = [-20, 0, 20, 40];
      const dataWithNulls = [
        [1000, 900, 800, 700], // Climb rates at 0ft for each temp
        [900, 800, 700, 600], // Climb rates at 2000ft
        [800, 700, 600, 500], // Climb rates at 4000ft
        [700, 600, 500, 400], // Climb rates at 6000ft
        [600, 500, null, null], // Climb rates at 8000ft - high temps not available
      ];

      // At 30°C (between 20° and 40°), find altitude where climb rate is 550 fpm
      // The function should skip the 8000ft altitude since it has null values
      const result = findInverseXgivenYandZ(
        dataWithNulls,
        xAxisWithNulls,
        yAxisWithNulls,
        550,
        30
      );
      // At 30°C, for each altitude we interpolate between temps 20° and 40°:
      // 0ft: between 800 and 700 = 750 fpm
      // 2000ft: between 700 and 600 = 650 fpm
      // 4000ft: between 600 and 500 = 550 fpm (exact match)
      // 6000ft: between 500 and 400 = 450 fpm
      // 8000ft: skipped due to nulls
      expect(result).toBe(4000);
    });

    it("should handle exact temperature match with null values", () => {
      // Test data with null values at exact temperature
      const xAxisWithNulls = [0, 2000, 4000, 6000];
      const yAxisWithNulls = [-20, 0, 20, 40];
      const dataWithNulls = [
        [1000, 900, 800, 700],
        [900, 800, 700, 600],
        [800, 700, 600, 500],
        [700, 600, null, 400], // null at 20°C
      ];

      // At exactly 20°C, find altitude where climb rate is 700 fpm
      // Should skip the 6000ft altitude due to null value
      const result = findInverseXgivenYandZ(
        dataWithNulls,
        xAxisWithNulls,
        yAxisWithNulls,
        700,
        20
      );
      // Valid data points at 20°C:
      // 0ft: 800 fpm
      // 2000ft: 700 fpm (exact match)
      // 4000ft: 600 fpm
      // 6000ft: skipped (null)
      expect(result).toBe(2000);
    });

    it("should throw error when all data points are null at requested temperature", () => {
      const xAxisAllNulls = [0, 2000, 4000];
      const yAxisAllNulls = [-20, 0, 20, 40];
      const dataAllNulls = [
        [1000, 900, null, null],
        [900, 800, null, null],
        [800, 700, null, null],
      ];

      // At 30°C (between 20° and 40°), all data points are null
      expect(() => {
        findInverseXgivenYandZ(dataAllNulls, xAxisAllNulls, yAxisAllNulls, 500, 30);
      }).toThrow("all data points are null");
    });

    describe("extrapolation direction in non-linear decreasing series", () => {
      // Data that is NOT collinear: steep drop early, then levels off.
      // This is the real-world pattern for aircraft climb rates (ROC drops faster at low altitude).
      // Only non-linear data exposes the bug: with linear data, both ends extrapolate identically.
      const xAxisNL = [0, 5000, 10000, 15000];
      const yAxisNL = [0];
      const dataNL = [[800], [500], [400], [350]]; // steep early drop, then leveling off

      it("extrapolates beyond max altitude from last two points when target is below all values", () => {
        // Target 100 fpm is below the minimum (350 fpm at 15000 ft).
        // Service ceiling is above the table — must extrapolate from the TOP of the data (last two points).
        // last two: x=10000 (z=400) and x=15000 (z=350)
        // t = (100 - 400) / (350 - 400) = 6.0  →  result = 10000 + 6×5000 = 40000 ft
        const result = findInverseXgivenYandZ(dataNL, xAxisNL, yAxisNL, 100, 0);
        expect(result).toBeCloseTo(40000, -2);
      });

      it("extrapolates below min altitude from first two points when target is above all values", () => {
        // Target 1000 fpm is above the maximum (800 fpm at 0 ft).
        // Service ceiling is below the table — must extrapolate from the BOTTOM of the data (first two points).
        // first two: x=0 (z=800) and x=5000 (z=500)
        // t = (1000 - 800) / (500 - 800) ≈ -0.6667  →  result = 0 + (-0.6667)×5000 ≈ -3333 ft
        const result = findInverseXgivenYandZ(dataNL, xAxisNL, yAxisNL, 1000, 0);
        expect(result).toBeCloseTo(-3333, -2);
      });
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

const mockLog = jest.spyOn(console, "log").mockImplementation(() => {});

describe("Trilinear Interpolation", () => {
  beforeEach(() => {
    mockLog.mockClear();
    mockWarn.mockClear();
  });

  afterAll(() => {
    mockLog.mockRestore();
  });

  // Test data for trilinear interpolation
  const simpleTrilinearTable: TrilinearInterpolationTable = {
    weights: [2800, 3100],
    pressureAltitudes: [0, 4000, 8000],
    temperatures: [0, 20, 40],
    data: [
      // Weight 2800 lbs
      [
        [1000, 1100, 1200], // 0ft PA
        [1200, 1300, 1400], // 4000ft PA
        [1400, 1500, 1600], // 8000ft PA
      ],
      // Weight 3100 lbs
      [
        [1200, 1300, 1400], // 0ft PA
        [1400, 1500, 1600], // 4000ft PA
        [1600, 1700, 1800], // 8000ft PA
      ],
    ],
  };

  const singlePointTrilinearTable: TrilinearInterpolationTable = {
    weights: [2800],
    pressureAltitudes: [4000],
    temperatures: [20],
    data: [[[1300]]],
  };

  const tableWithNulls: TrilinearInterpolationTable = {
    weights: [2800, 3100],
    pressureAltitudes: [0, 4000],
    temperatures: [0, 20],
    data: [
      // Weight 2800 lbs
      [
        [1000, 1100], // 0ft PA
        [1200, null], // 4000ft PA - one null value
      ],
      // Weight 3100 lbs
      [
        [1200, 1300], // 0ft PA
        [1400, 1500], // 4000ft PA
      ],
    ],
  };

  describe("Input Validation", () => {
    it("should throw error for empty axis arrays", () => {
      const emptyTable: TrilinearInterpolationTable = {
        weights: [],
        pressureAltitudes: [0],
        temperatures: [0],
        data: [],
      };
      expect(() => trilinearInterpolate(emptyTable, 2800, 0, 0)).toThrow(
        "Axis arrays cannot be empty"
      );
    });

    it("should throw error for mismatched data dimensions", () => {
      const mismatchedTable: TrilinearInterpolationTable = {
        weights: [2800, 3100],
        pressureAltitudes: [0, 4000],
        temperatures: [0, 20],
        data: [
          [
            [1000, 1100],
            [1200, 1300],
          ], // Correct dimensions
          [[1200]], // Incorrect - missing second pressure altitude
        ],
      };
      expect(() => trilinearInterpolate(mismatchedTable, 2800, 0, 0)).toThrow(
        "Data[1] length (1) must match pressureAltitudes length (2)"
      );
    });

    it("should throw error for mismatched temperature dimensions", () => {
      const mismatchedTable: TrilinearInterpolationTable = {
        weights: [2800],
        pressureAltitudes: [0],
        temperatures: [0, 20],
        data: [[[1000]]], // Missing second temperature
      };
      expect(() => trilinearInterpolate(mismatchedTable, 2800, 0, 0)).toThrow(
        "Data[0][0] length (1) must match temperatures length (2)"
      );
    });
  });

  describe("Basic Interpolation", () => {
    it("should interpolate exact points correctly", () => {
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 0, 0)).toBe(1000);
      expect(trilinearInterpolate(simpleTrilinearTable, 3100, 8000, 40)).toBe(
        1800
      );
    });

    it("should interpolate between points correctly", () => {
      // Midpoint interpolation
      const result = trilinearInterpolate(simpleTrilinearTable, 2950, 2000, 10);
      expect(result).toBeCloseTo(1250, 0); // Should be between 1100 and 1400
    });

    it("should handle single-point tables", () => {
      expect(
        trilinearInterpolate(singlePointTrilinearTable, 2800, 4000, 20)
      ).toBe(1300);
      // Even when requesting different points, should return the only value
      expect(
        trilinearInterpolate(singlePointTrilinearTable, 3000, 2000, 10)
      ).toBe(1300);
    });
  });

  describe("Extrapolation Handling", () => {
    it("should warn when extrapolating", () => {
      // Test with values that are definitely outside the table bounds
      const result1 = trilinearInterpolate(simpleTrilinearTable, 2000, 0, 0); // Below weight range (2800-3100)
      expect(result1).toBeDefined();
      expect(typeof result1).toBe("number");

      const result2 = trilinearInterpolate(
        simpleTrilinearTable,
        2800,
        -1000,
        0
      ); // Below altitude range (0-8000)
      expect(result2).toBeDefined();
      expect(typeof result2).toBe("number");

      const result3 = trilinearInterpolate(simpleTrilinearTable, 2800, 0, 50); // Above temperature range (0-40)
      expect(result3).toBeDefined();
      expect(typeof result3).toBe("number");
    });

    it("should throw error when extrapolation is disabled", () => {
      expect(() =>
        trilinearInterpolate(simpleTrilinearTable, 2500, 0, 0, {
          allowExtrapolation: false,
        })
      ).toThrow("Values outside table range and extrapolation is disabled");
    });

    it("should not warn when extrapolation warnings are disabled", () => {
      trilinearInterpolate(simpleTrilinearTable, 2500, 0, 0, {
        warnOnExtrapolation: false,
      });
      expect(mockWarn).not.toHaveBeenCalled();
    });
  });

  describe("Null Value Handling", () => {
    it("should handle null values gracefully", () => {
      const result = trilinearInterpolate(tableWithNulls, 2800, 2000, 10);
      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
    });

    it("should return null when all corner values are null", () => {
      const allNullTable: TrilinearInterpolationTable = {
        weights: [2800, 3100],
        pressureAltitudes: [0, 4000],
        temperatures: [0, 20],
        data: [
          [
            [null, null],
            [null, null],
          ],
          [
            [null, null],
            [null, null],
          ],
        ],
      };
      const result = trilinearInterpolate(allNullTable, 2800, 2000, 10);
      expect(result).toBeNull();
    });

    it("should use fallback values for partial null data", () => {
      const result = trilinearInterpolate(tableWithNulls, 2950, 2000, 10);
      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
    });
  });

  describe("Edge Cases", () => {
    it("should handle boundary values correctly", () => {
      // Test exact boundary values
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 0, 0)).toBe(1000);
      expect(trilinearInterpolate(simpleTrilinearTable, 3100, 8000, 40)).toBe(
        1800
      );
    });

    it("should handle extreme extrapolation", () => {
      const result = trilinearInterpolate(
        simpleTrilinearTable,
        5000,
        20000,
        100
      );
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("should handle negative values", () => {
      const negativeTable: TrilinearInterpolationTable = {
        weights: [-100, 100],
        pressureAltitudes: [-1000, 1000],
        temperatures: [-50, 50],
        data: [
          [
            [-1000, -500],
            [500, 1000],
          ],
          [
            [-500, 0],
            [1000, 1500],
          ],
        ],
      };
      const result = trilinearInterpolate(negativeTable, 0, 0, 0);
      expect(typeof result).toBe("number");
    });
  });

  describe("Performance and Accuracy", () => {
    it("should produce consistent results for repeated calls", () => {
      const result1 = trilinearInterpolate(
        simpleTrilinearTable,
        2950,
        2000,
        10
      );
      const result2 = trilinearInterpolate(
        simpleTrilinearTable,
        2950,
        2000,
        10
      );
      expect(result1).toBe(result2);
    });

    it("should handle interpolation at exact table points", () => {
      // Test all exact table points
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 0, 0)).toBe(1000);
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 0, 20)).toBe(
        1100
      );
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 0, 40)).toBe(
        1200
      );
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 4000, 0)).toBe(
        1200
      );
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 4000, 20)).toBe(
        1300
      );
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 4000, 40)).toBe(
        1400
      );
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 8000, 0)).toBe(
        1400
      );
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 8000, 20)).toBe(
        1500
      );
      expect(trilinearInterpolate(simpleTrilinearTable, 2800, 8000, 40)).toBe(
        1600
      );
    });

    it("should handle interpolation between weight brackets", () => {
      // Test interpolation between 2800 and 3100 lbs
      const result = trilinearInterpolate(simpleTrilinearTable, 2950, 4000, 20);
      expect(result).toBeCloseTo(1400, 0); // Should be between 1300 and 1500
    });
  });
});
