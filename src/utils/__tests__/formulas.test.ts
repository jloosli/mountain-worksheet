import {
  farenheitToCelcius,
  celciusToFarenheit,
  pressureAltitudeToDensityAltitude,
  altitudeToPressureAltitude,
  getRateOfClimb,
  calculateVra,
} from "../formulas";
import { type InterpolationTable } from "../interpolation";
import { type Aircraft } from "../types";

// Mock the interpolation module
jest.mock("../interpolation", () => ({
  bilinearInterpolate: jest.fn().mockReturnValue(500),
}));

describe("Temperature Conversion Functions", () => {
  describe("farenheitToCelcius", () => {
    test("converts 32°F to 0°C", () => {
      expect(farenheitToCelcius(32)).toBe(0);
    });

    test("converts 212°F to 100°C", () => {
      expect(farenheitToCelcius(212)).toBe(100);
    });

    test("converts -40°F to -40°C", () => {
      expect(farenheitToCelcius(-40)).toBe(-40);
    });

    test("converts 98.6°F to 37°C", () => {
      expect(farenheitToCelcius(98.6)).toBeCloseTo(37, 1);
    });
  });

  describe("celciusToFarenheit", () => {
    test("converts 0°C to 32°F", () => {
      expect(celciusToFarenheit(0)).toBe(32);
    });

    test("converts 100°C to 212°F", () => {
      expect(celciusToFarenheit(100)).toBe(212);
    });

    test("converts -40°C to -40°F", () => {
      expect(celciusToFarenheit(-40)).toBe(-40);
    });

    test("converts 37°C to 98.6°F", () => {
      expect(celciusToFarenheit(37)).toBeCloseTo(98.6, 1);
    });
  });
});

describe("Altitude Conversion Functions", () => {
  describe("altitudeToPressureAltitude", () => {
    test("converts altitude with standard pressure", () => {
      expect(altitudeToPressureAltitude(5000, 29.92)).toBe(5000);
    });

    test("converts altitude with high pressure", () => {
      expect(altitudeToPressureAltitude(5000, 30.92)).toBe(4000);
    });

    test("converts altitude with low pressure", () => {
      expect(altitudeToPressureAltitude(5000, 28.92)).toBe(6000);
    });

    test("handles sea level with varying pressure", () => {
      expect(altitudeToPressureAltitude(0, 30.92)).toBe(-1000);
      expect(altitudeToPressureAltitude(0, 28.92)).toBe(1000);
    });
  });

  describe("pressureAltitudeToDensityAltitude", () => {
    test("converts at standard temperature", () => {
      // At 5000ft PA, standard temp is 5°C (15 - 5*2)
      expect(pressureAltitudeToDensityAltitude(5000, 5)).toBe(5000);
    });

    test("converts at higher than standard temperature", () => {
      // At 5000ft PA, if temp is 15°C (10°C above standard)
      expect(pressureAltitudeToDensityAltitude(5000, 15)).toBe(6200);
    });

    test("converts at lower than standard temperature", () => {
      // At 5000ft PA, if temp is -5°C (10°C below standard)
      expect(pressureAltitudeToDensityAltitude(5000, -5)).toBe(3800);
    });

    test("handles sea level at various temperatures", () => {
      expect(pressureAltitudeToDensityAltitude(0, 15)).toBe(0);
      expect(pressureAltitudeToDensityAltitude(0, 25)).toBe(1200);
      expect(pressureAltitudeToDensityAltitude(0, 5)).toBe(-1200);
    });
  });
});

describe("Rate of Climb Function", () => {
  // Import the mocked function
  const { bilinearInterpolate } = jest.requireMock("../interpolation");
  const mockTable: InterpolationTable = {
    xAxis: [0, 2000, 4000],
    yAxis: [0, 10, 20],
    data: [
      [800, 700, 600],
      [750, 650, 550],
      [700, 600, 500],
    ],
  };

  beforeEach(() => {
    // Clear mock before each test
    jest.clearAllMocks();
    bilinearInterpolate.mockImplementation(() => 500);
  });

  test("calls bilinearInterpolate with correct parameters", () => {
    const pressureAlt = 3000;
    const temp = 15;
    const result = getRateOfClimb(mockTable, pressureAlt, temp);

    expect(bilinearInterpolate).toHaveBeenCalledWith(
      mockTable,
      pressureAlt,
      temp,
      {}
    );
    expect(result).toBe(500);
  });

  test("rounds the interpolation result", () => {
    bilinearInterpolate.mockReturnValue(500.6);
    const result = getRateOfClimb(mockTable, 3000, 15);
    expect(result).toBe(501);
  });

  test("handles custom options", () => {
    const options = { allowExtrapolation: true };
    getRateOfClimb(mockTable, 3000, 15, options);
    expect(bilinearInterpolate).toHaveBeenCalledWith(
      mockTable,
      3000,
      15,
      options
    );
  });
});

describe("Vra Calculation Function", () => {
  const mockAircraft: Aircraft = {
    id: "C182T",
    name: "Cessna 182T",
    emptyWeight: 2300,
    maxGrossWeight: 3100,
    fuelCapacity: 88,
    fuelWeightPerGallon: 6,
    serviceCeiling: 14000,
    maneuvering: {
      weights: [2100, 2600, 3100],
      Va: [91, 101, 110],
    },
    stallSpeeds: {
      flaps: [0, 30],
      Vso: [51, 41],
    },
    climbPerformance: {
      pressureAltitudes: [0, 2000, 4000],
      climbSpeeds: [80, 79, 78],
      temperatures: [-20, 0, 20],
      data: [
        [1055, 980, 905],
        [945, 875, 805],
        [840, 770, 705],
      ],
    },
    shortFieldTakeoff: {
      weights: [2300, 2700, 3100],
      pressureAltitudes: [0, 1000, 2000],
      temperatures: [0, 10, 20],
      data: [
        {
          groundRoll: [[365, 390, 420]],
          groundRoll50ft: [[705, 750, 800]],
        },
      ],
    },
  };

  test("calculates Vra correctly for valid aircraft data", () => {
    const result = calculateVra(mockAircraft);
    // Vra = 1.7 × Vso[0] = 1.7 × 51 = 86.7, rounded to 87
    expect(result).toBe(87);
  });

  test("returns null for null aircraft", () => {
    const result = calculateVra(null);
    expect(result).toBeNull();
  });

  test("returns null for aircraft with missing stallSpeeds", () => {
    const aircraftWithoutStallSpeeds = { ...mockAircraft, stallSpeeds: undefined as any };
    const result = calculateVra(aircraftWithoutStallSpeeds);
    expect(result).toBeNull();
  });

  test("returns null for aircraft with missing Vso array", () => {
    const aircraftWithoutVso = { ...mockAircraft, stallSpeeds: { flaps: [0, 30], Vso: undefined as any } };
    const result = calculateVra(aircraftWithoutVso);
    expect(result).toBeNull();
  });

  test("returns null for aircraft with empty Vso array", () => {
    const aircraftWithEmptyVso = { ...mockAircraft, stallSpeeds: { flaps: [0, 30], Vso: [] } };
    const result = calculateVra(aircraftWithEmptyVso);
    expect(result).toBeNull();
  });

  test("returns null for aircraft with invalid Vso values", () => {
    const aircraftWithInvalidVso = { ...mockAircraft, stallSpeeds: { flaps: [0, 30], Vso: [0, 41] } };
    const result = calculateVra(aircraftWithInvalidVso);
    expect(result).toBeNull();
  });

  test("returns null for aircraft with negative Vso values", () => {
    const aircraftWithNegativeVso = { ...mockAircraft, stallSpeeds: { flaps: [0, 30], Vso: [-10, 41] } };
    const result = calculateVra(aircraftWithNegativeVso);
    expect(result).toBeNull();
  });

  test("rounds result to nearest whole number", () => {
    const aircraftWithDecimalVso = { ...mockAircraft, stallSpeeds: { flaps: [0, 30], Vso: [50.5, 41] } };
    const result = calculateVra(aircraftWithDecimalVso);
    // Vra = 1.7 × 50.5 = 85.85, rounded to 86
    expect(result).toBe(86);
  });
});
