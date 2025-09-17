import {
  farenheitToCelcius,
  celciusToFarenheit,
  pressureAltitudeToDensityAltitude,
  altitudeToPressureAltitude,
  getRateOfClimb,
} from "../formulas";
import { type InterpolationTable } from "../interpolation";

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
    const options = { extrapolate: true };
    getRateOfClimb(mockTable, 3000, 15, options);
    expect(bilinearInterpolate).toHaveBeenCalledWith(
      mockTable,
      3000,
      15,
      options
    );
  });
});
