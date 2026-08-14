/**
 * Unit tests for Weather Data Mapping and Validation
 */

import {
  mapAirportSpecificWeatherData,
  mapRunwayData,
  mapWeatherDataToWorksheet,
  isApiPopulatedData,
  mergeWeatherData,
  VALIDATION_RANGES,
  type WeatherMappingOptions,
} from "./weatherDataMapper";

import type {
  METARResponse,
  TAFResponse,
  AirportResponse,
} from "./aviationWeatherApi";
import type { WorksheetData } from "@/utils/types";

describe("Weather Data Mapper", () => {
  describe("mapRunwayData", () => {
    const mockAirportData: AirportResponse[] = [
      {
        icaoId: "KORD",
        iataId: "ORD",
        name: "Chicago O'Hare International Airport",
        city: "Chicago",
        state: "IL",
        country: "US",
        lat: 41.9786,
        lon: -87.9048,
        elev: 672,
        priority: 1,
        tz: "America/Chicago",
        metar: true,
        taaf: true,
        runway: [
          {
            id: "10L/28R",
            length: 10000,
            width: 150,
            surface: "C",
            alignment: 100,
            lighted: true,
            closed: false,
          },
          {
            id: "10R/28L",
            length: 12000,
            width: 150,
            surface: "C",
            alignment: 280,
            lighted: true,
            closed: false,
          },
          {
            id: "14L/32R",
            length: 8000,
            width: 150,
            surface: "C",
            alignment: 140,
            lighted: true,
            closed: false,
          },
        ],
      },
      {
        icaoId: "KLAX",
        iataId: "LAX",
        name: "Los Angeles International Airport",
        city: "Los Angeles",
        state: "CA",
        country: "US",
        lat: 33.9425,
        lon: -118.4081,
        elev: 125,
        priority: 1,
        tz: "America/Los_Angeles",
        metar: true,
        taaf: true,
        runway: [
          {
            id: "06L/24R",
            length: 12000,
            width: 150,
            surface: "C",
            alignment: 60,
            lighted: true,
            closed: false,
          },
          {
            id: "06R/24L",
            length: 11000,
            width: 150,
            surface: "C",
            alignment: 60,
            lighted: true,
            closed: false,
          },
        ],
      },
    ];

    it("should map runway data for departure and arrival airports", () => {
      const options: WeatherMappingOptions = {
        departureAirport: "KORD",
        arrivalAirport: "KLAX",
      };

      const result = mapRunwayData(mockAirportData, options);

      expect(result.rwy).toEqual([8000, 11000]); // Shortest runway for each airport
    });

    it("should handle missing airport data", () => {
      const options: WeatherMappingOptions = {
        departureAirport: "KORD",
        arrivalAirport: "KLAX",
      };

      const result = mapRunwayData([], options);

      expect(result.rwy).toEqual([null, null]);
    });

    it("should handle airports without runway data", () => {
      const airportDataWithoutRunways: AirportResponse[] = [
        {
          ...mockAirportData[0],
          runway: [],
        },
      ];

      const options: WeatherMappingOptions = {
        departureAirport: "KORD",
      };

      const result = mapRunwayData(airportDataWithoutRunways, options);

      expect(result.rwy).toEqual([null, null]);
    });

    it("should validate runway length data", () => {
      const airportDataWithInvalidRunways: AirportResponse[] = [
        {
          ...mockAirportData[0],
          runway: [
            {
              id: "10L/28R",
              length: 500, // Invalid runway length
              width: 150,
              surface: "C",
              alignment: 100,
              lighted: true,
              closed: false,
            },
          ],
        },
      ];

      const options: WeatherMappingOptions = {
        departureAirport: "KORD",
        validateData: true,
      };

      const result = mapRunwayData(airportDataWithInvalidRunways, options);

      expect(result.rwy).toEqual([null, null]); // Should be null due to validation
    });

    it("should filter out helipads (runways with null alignment)", () => {
      const airportDataWithHelipads: AirportResponse[] = [
        {
          icaoId: "KSLC",
          iataId: "SLC",
          name: "Salt Lake City International Airport",
          city: "Salt Lake City",
          state: "UT",
          country: "US",
          lat: 40.7884,
          lon: -111.9778,
          elev: 1289,
          priority: 1,
          tz: "America/Denver",
          metar: true,
          taaf: true,
          runway: [
            {
              id: "14/32",
              length: 4893,
              width: 150,
              surface: "A",
              alignment: 153,
              lighted: true,
              closed: false,
            },
            {
              id: "16L/34R",
              length: 12002,
              width: 150,
              surface: "A",
              alignment: 175,
              lighted: true,
              closed: false,
            },
            {
              id: "16R/34L",
              length: 12000,
              width: 150,
              surface: "C",
              alignment: 175,
              lighted: true,
              closed: false,
            },
            {
              id: "17/35",
              length: 9596,
              width: 150,
              surface: "A",
              alignment: 180,
              lighted: true,
              closed: false,
            },
            {
              id: "HB",
              length: 60,
              width: 60,
              surface: "A",
              alignment: null,
              lighted: true,
              closed: false,
            },
            {
              id: "HF",
              length: 60,
              width: 60,
              surface: "A",
              alignment: null,
              lighted: true,
              closed: false,
            },
          ],
        },
      ];

      const options: WeatherMappingOptions = {
        departureAirport: "KSLC",
      };

      const result = mapRunwayData(airportDataWithHelipads, options);

      // Should select 4893 (shortest non-helipad runway), not 60 (helipad)
      expect(result.rwy).toEqual([4893, null]);
    });

    it("should return null if only helipads are available", () => {
      const airportDataWithOnlyHelipads: AirportResponse[] = [
        {
          icaoId: "TEST",
          iataId: "TST",
          name: "Test Heliport",
          city: "Test City",
          state: "TS",
          country: "US",
          lat: 40.0,
          lon: -110.0,
          elev: 1000,
          priority: 1,
          tz: "America/Denver",
          metar: true,
          taaf: true,
          runway: [
            {
              id: "H1",
              length: 60,
              width: 60,
              surface: "A",
              alignment: null,
              lighted: true,
              closed: false,
            },
            {
              id: "H2",
              length: 80,
              width: 80,
              surface: "A",
              alignment: null,
              lighted: true,
              closed: false,
            },
          ],
        },
      ];

      const options: WeatherMappingOptions = {
        departureAirport: "TEST",
      };

      const result = mapRunwayData(airportDataWithOnlyHelipads, options);

      // Should return null if only helipads are available
      expect(result.rwy).toEqual([null, null]);
    });
  });

  describe("mapWeatherDataToWorksheet", () => {
    const mockApiData = {
      metar: [
        {
          icaoId: "KORD",
          obsTime: "2024-01-15T12:00:00Z",
          report: "METAR KORD 151200Z 27015KT 10SM FEW250 21/12 A2992",
          temp: 21,
          dewp: 12,
          wdir: 270,
          wspd: 15,
          visib: 10,
          altim: 1013.2, // hPa (≈ 29.92 inHg)
          qcField: 1,
          metarType: "METAR",
          rawOb: "KORD 151200Z 27015KT 10SM FEW250 21/12 A2992",
        },
      ],
      taf: [
        {
          icaoId: "KORD",
          issueTime: "2024-01-15T06:00:00Z",
          validTime: "2024-01-15T06:00:00Z",
          validTimeEnd: "2024-01-15T18:00:00Z",
          rawTAF: "TAF KORD 150600Z 1506/1518 27015KT P6SM FEW250",
          lat: 41.9786,
          lon: -87.9048,
          elev: 672,
          fcstType: "TAF",
        },
      ],
      airport: [
        {
          icaoId: "KORD",
          iataId: "ORD",
          name: "Chicago O'Hare International Airport",
          city: "Chicago",
          state: "IL",
          country: "US",
          lat: 41.9786,
          lon: -87.9048,
          elev: 672,
          priority: 1,
          tz: "America/Chicago",
          metar: true,
          taaf: true,
          runway: [
            {
              id: "10L/28R",
              length: 10000,
              width: 150,
              surface: "C",
              alignment: 100,
              lighted: true,
              closed: false,
            },
          ],
        },
      ],
    };

    it("should map all weather data successfully", () => {
      const options: WeatherMappingOptions = {
        departureAirport: "KORD",
        arrivalAirport: "KORD",
        // Match the METAR obsTime so the observation is "fresh"
        flightDate: "2024-01-15",
        flightTime: "12:00",
      };

      const result = mapWeatherDataToWorksheet(mockApiData, null, null, options);

      expect(result.success).toBe(true);
      expect(result.data.temp).toBeDefined();
      expect(result.data.altimeter).toBeDefined();
      expect(result.data.rwy).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it("should handle missing data gracefully", () => {
      const emptyApiData = {};

      const result = mapWeatherDataToWorksheet(emptyApiData, null, null);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain("No wind/temperature data available");
      expect(result.warnings).toContain(
        "No METAR/TAF data available for airport-specific temperature/pressure"
      );
      expect(result.warnings).toContain(
        "No airport data available for runway information"
      );
    });

    it("should validate data when validation is enabled", () => {
      const result = mapWeatherDataToWorksheet({}, null, null, {
        validateData: true,
      });

      expect(result.success).toBe(true);
      // No areaOfOps → wind warning is emitted
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle mapping errors", () => {
      // Test with malformed data that would cause errors
      const malformedApiData = {
        metar: null as unknown as [],
        taf: "bad" as unknown as [],
        airport: 42 as unknown as [],
      };

      const result = mapWeatherDataToWorksheet(malformedApiData, null, null);

      // Should handle gracefully
      expect(result.success).toBe(true);
    });

    it("should use METAR altimeter settings for departure and arrival airports", () => {
      const apiDataWithMultipleAirports = {
        metar: [
          {
            icaoId: "KORD",
            obsTime: "2024-01-15T12:00:00Z",
            report: "METAR KORD 151200Z 27015KT 10SM FEW250 21/12 A2989",
            temp: 21,
            dewp: 12,
            wdir: 270,
            wspd: 15,
            visib: 10,
            altim: 1012.4, // Departure altimeter in hPa (converts to ~29.89 inHg)
            qcField: 1,
            metarType: "METAR",
            rawOb: "KORD 151200Z 27015KT 10SM FEW250 21/12 A2989",
          },
          {
            icaoId: "KLAX",
            obsTime: "2024-01-15T12:00:00Z",
            report: "METAR KLAX 151200Z 21010KT 10SM FEW250 25/14 A2995",
            temp: 25,
            dewp: 14,
            wdir: 210,
            wspd: 10,
            visib: 10,
            altim: 1014.2, // Arrival altimeter in hPa (converts to ~29.95 inHg)
            qcField: 1,
            metarType: "METAR",
            rawOb: "KLAX 151200Z 21010KT 10SM FEW250 25/14 A2995",
          },
        ],
      };

      const options: WeatherMappingOptions = {
        departureAirport: "KORD",
        arrivalAirport: "KLAX",
        // flightDate/flightTime match the METAR obsTime so both METARs are "fresh"
        flightDate: "2024-01-15",
        flightTime: "12:00",
      };

      const result = mapWeatherDataToWorksheet(
        apiDataWithMultipleAirports,
        null,
        null,
        options
      );

      expect(result.success).toBe(true);
      expect(result.data.altimeter).toBeDefined();
      expect(result.data.altimeter![0]).toBeCloseTo(29.9, 2); // Departure (converted from 1012.4 hPa)
      expect(result.data.altimeter![1]).toBe(-1); // Operating (placeholder, won't overwrite when areaOfOps is null)
      expect(result.data.altimeter![2]).toBeCloseTo(29.95, 2); // Arrival (converted from 1014.2 hPa)
      expect(result.data.temp).toBeDefined();
      expect(result.data.temp![0]).toBe(21); // Departure
      expect(result.data.temp![2]).toBe(25); // Arrival
    });

    it("applies areaOfOps opTemp and opAltimeter to index 1", () => {
      const mockAreaOfOps = {
        position: [40.0, -111.0] as [number, number],
        positionSource: "midpoint" as const,
        windsAloft: {
          direction: [270, 280, 290, 300, 310],
          speed: [15, 20, 25, 30, 35],
          temp: [10, 5, 0, -5, -10],
        },
        opTemp: 8,
        opAltimeter: 30.05,
        warnings: ["test warning from areaOfOps"],
      };

      const result = mapWeatherDataToWorksheet({}, mockAreaOfOps, null);

      // Wind should be taken from areaOfOps
      expect(result.data.wind).toBeDefined();
      expect(result.data.wind![0]).toEqual([270, 280, 290, 300, 310]);
      expect(result.data.wind![1]).toEqual([15, 20, 25, 30, 35]);
      expect(result.data.wind![2]).toEqual([10, 5, 0, -5, -10]);
      // opTemp and opAltimeter go to index 1
      expect(result.data.temp![1]).toBe(8);
      expect(result.data.altimeter![1]).toBe(30.05);
      // Warnings from areaOfOps are propagated
      expect(result.warnings).toContain("test warning from areaOfOps");
    });

    it("skips out-of-range opTemp and opAltimeter when validateData is on", () => {
      const mockAreaOfOps = {
        position: [40.0, -111.0] as [number, number],
        positionSource: "midpoint" as const,
        windsAloft: {
          direction: [null, null, null, null, null],
          speed: [null, null, null, null, null],
          temp: [null, null, null, null, null],
        },
        opTemp: 200, // out of range (max 50)
        opAltimeter: 99, // out of range (max 31.0)
        warnings: [],
      };

      const result = mapWeatherDataToWorksheet({}, mockAreaOfOps, null, {
        validateData: true,
      });

      expect(result.data.temp).toBeUndefined();
      expect(result.data.altimeter).toBeUndefined();
      expect(
        result.warnings.some((w) => /Operating temperature.*out of valid range/.test(w))
      ).toBe(true);
      expect(
        result.warnings.some((w) => /Operating altimeter.*out of valid range/.test(w))
      ).toBe(true);
    });

    it("includes altitude labels in wind validation errors", () => {
      const mockAreaOfOps = {
        position: [40.0, -111.0] as [number, number],
        positionSource: "midpoint" as const,
        windsAloft: {
          direction: [999, 280, 290, 300, 310], // 999 invalid at 3000 ft
          speed: [15, 20, 25, 30, 35],
          temp: [10, 5, 0, -5, -10],
        },
        opTemp: null,
        opAltimeter: null,
        warnings: [],
      };
      const result = mapWeatherDataToWorksheet({}, mockAreaOfOps, null, {
        validateData: true,
      });
      expect(
        result.errors.some((e) => /Invalid wind direction at 3000 ft/.test(e))
      ).toBe(true);
    });
  });

  describe("isApiPopulatedData", () => {
    it("should detect API-populated wind data", () => {
      const data: Partial<WorksheetData> = {
        wind: [
          [270, 0, 0, 0, 0],
          [25, 0, 0, 0, 0],
          [15, 0, 0, 0, 0],
        ],
      };

      const result = isApiPopulatedData(data);

      expect(result.wind).toBe(true);
      expect(result.temperature).toBe(false);
      expect(result.pressure).toBe(false);
      expect(result.runway).toBe(false);
    });

    it("should detect API-populated temperature data", () => {
      const data: Partial<WorksheetData> = {
        temp: [18, 18, 18], // Different from default 21
      };

      const result = isApiPopulatedData(data);

      expect(result.wind).toBe(false);
      expect(result.temperature).toBe(true);
      expect(result.pressure).toBe(false);
      expect(result.runway).toBe(false);
    });

    it("should detect API-populated pressure data", () => {
      const data: Partial<WorksheetData> = {
        altimeter: [29.85, 29.85, 29.85], // Different from default 29.92
      };

      const result = isApiPopulatedData(data);

      expect(result.wind).toBe(false);
      expect(result.temperature).toBe(false);
      expect(result.pressure).toBe(true);
      expect(result.runway).toBe(false);
    });

    it("should detect API-populated runway data", () => {
      const data: Partial<WorksheetData> = {
        rwy: [10000, null],
      };

      const result = isApiPopulatedData(data);

      expect(result.wind).toBe(false);
      expect(result.temperature).toBe(false);
      expect(result.pressure).toBe(false);
      expect(result.runway).toBe(true);
    });

    it("should detect null values as not API-populated", () => {
      const data: Partial<WorksheetData> = {
        wind: [
          [null, null, null, null, null],
          [null, null, null, null, null],
          [null, null, null, null, null],
        ],
        temp: [null, null, null],
        altimeter: [null, null, null],
        rwy: [null, null],
      };

      const result = isApiPopulatedData(data);

      expect(result.wind).toBe(false);
      expect(result.temperature).toBe(false);
      expect(result.pressure).toBe(false);
      expect(result.runway).toBe(false);
    });
  });

  describe("mergeWeatherData", () => {
    it("should merge API data with existing data", () => {
      const existingData: Partial<WorksheetData> = {
        wind: [
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
        ],
        temp: [21, 21, 21],
        altimeter: [29.92, 29.92, 29.92],
        rwy: [null, null],
      };

      const apiData: Partial<WorksheetData> = {
        wind: [
          [270, 0, 0, 0, 0],
          [25, 0, 0, 0, 0],
          [15, 0, 0, 0, 0],
        ],
        temp: [18, 18, 18],
        altimeter: [29.85, 29.85, 29.85],
        rwy: [10000, null],
      };

      const result = mergeWeatherData(existingData, apiData);

      expect(result.wind![0][0]).toBe(270); // API data should be merged
      expect(result.temp![0]).toBe(18); // API data should be merged
      expect(result.altimeter![0]).toBe(29.85); // API data should be merged
      expect(result.rwy![0]).toBe(10000); // API data should be merged
    });

    it("should preserve user-modified data when preserveUserData is true", () => {
      const existingData: Partial<WorksheetData> = {
        wind: [
          [180, 0, 0, 0, 0],
          [20, 0, 0, 0, 0],
          [10, 0, 0, 0, 0],
        ], // User modified
        temp: [25, 25, 25], // User modified
        altimeter: [30.0, 30.0, 30.0], // User modified
        rwy: [5000, null], // User modified
      };

      const apiData: Partial<WorksheetData> = {
        wind: [
          [270, 0, 0, 0, 0],
          [25, 0, 0, 0, 0],
          [15, 0, 0, 0, 0],
        ],
        temp: [18, 18, 18],
        altimeter: [29.85, 29.85, 29.85],
        rwy: [10000, null],
      };

      const result = mergeWeatherData(existingData, apiData, true);

      expect(result.wind![0][0]).toBe(270); // API data should overwrite user data
      expect(result.temp![0]).toBe(18); // API data should overwrite user data
      expect(result.altimeter![0]).toBe(29.85); // API data should overwrite user data
      expect(result.rwy![0]).toBe(10000); // API data should overwrite user data
    });

    it("writes operating temp[1] and altimeter[1] when API provides them", () => {
      const existing = {
        temp: [10, 12, 14] as [number | null, number | null, number | null],
        altimeter: [29.92, 29.92, 29.92] as [
          number | null,
          number | null,
          number | null
        ],
      };
      const apiData = {
        temp: [20, 22, 24] as [number | null, number | null, number | null],
        altimeter: [30.0, 30.05, 30.1] as [
          number | null,
          number | null,
          number | null
        ],
      };
      const merged = mergeWeatherData(existing, apiData, true);
      expect(merged.temp).toEqual([20, 22, 24]);
      expect(merged.altimeter).toEqual([30.0, 30.05, 30.1]);
    });

    it("should overwrite user data when preserveUserData is false", () => {
      const existingData: Partial<WorksheetData> = {
        wind: [
          [180, 0, 0, 0, 0],
          [20, 0, 0, 0, 0],
          [10, 0, 0, 0, 0],
        ],
        temp: [25, 25, 25],
        altimeter: [30.0, 30.0, 30.0],
        rwy: [5000, null],
      };

      const apiData: Partial<WorksheetData> = {
        wind: [
          [270, 0, 0, 0, 0],
          [25, 0, 0, 0, 0],
          [15, 0, 0, 0, 0],
        ],
        temp: [18, 18, 18],
        altimeter: [29.85, 29.85, 29.85],
        rwy: [10000, null],
      };

      const result = mergeWeatherData(existingData, apiData, false);

      expect(result.wind![0][0]).toBe(270); // API data should overwrite
      expect(result.temp![0]).toBe(18); // API data should overwrite
      expect(result.altimeter![0]).toBe(29.85); // API data should overwrite
      expect(result.rwy![0]).toBe(10000); // API data should overwrite
    });

    it("overwrites turb/cielVis/mtnObsc to false when API explicitly says false", () => {
      const existing = { turb: true, cielVis: true, mtnObsc: true };
      const apiData = { turb: false, cielVis: false, mtnObsc: false };
      const merged = mergeWeatherData(existing, apiData, true);
      expect(merged.turb).toBe(false);
      expect(merged.cielVis).toBe(false);
      expect(merged.mtnObsc).toBe(false);
    });

    it("leaves turb/cielVis/mtnObsc untouched when API value is null", () => {
      const existing = { turb: true, cielVis: false, mtnObsc: true };
      const apiData = { turb: null, cielVis: null, mtnObsc: null } as Partial<
        Record<"turb" | "cielVis" | "mtnObsc", boolean | null>
      >;
      const merged = mergeWeatherData(
        existing,
        apiData as Partial<typeof existing>,
        true
      );
      expect(merged.turb).toBe(true);
      expect(merged.cielVis).toBe(false);
      expect(merged.mtnObsc).toBe(true);
    });
  });

  describe("dep/arr time-aware weather", () => {
    it("uses different TAF periods for departure and arrival", () => {
      // obsTime is >90 min before dep (13:00Z vs 15:00Z dep) so METARs are stale
      // and selectAirportWeather will fall through to TAF periods
      const metar = [
        {
          icaoId: "KPVU",
          obsTime: "2026-05-12T13:00:00Z",
          temp: 16,
          altim: 1015,
          rawOb: "",
          report: "",
          dewp: 0,
          wdir: 0,
          wspd: 0,
          visib: 10,
          qcField: 0,
          metarType: "METAR",
        },
        {
          icaoId: "KSGU",
          obsTime: "2026-05-12T13:00:00Z",
          temp: 22,
          altim: 1015,
          rawOb: "",
          report: "",
          dewp: 0,
          wdir: 0,
          wspd: 0,
          visib: 10,
          qcField: 0,
          metarType: "METAR",
        },
      ];
      const fcsts15to18 = {
        timeFrom: Math.floor(Date.parse("2026-05-12T15:00:00Z") / 1000),
        timeTo: Math.floor(Date.parse("2026-05-12T18:00:00Z") / 1000),
        temp: 18,
        altim: 30.0,
      };
      const fcsts18to21 = {
        timeFrom: Math.floor(Date.parse("2026-05-12T18:00:00Z") / 1000),
        timeTo: Math.floor(Date.parse("2026-05-12T21:00:00Z") / 1000),
        temp: 25,
        altim: 30.05,
      };
      const taf = [
        {
          icaoId: "KPVU",
          validTime: "2026-05-12T15:00:00Z",
          validTimeEnd: "2026-05-12T21:00:00Z",
          rawTAF: "",
          issueTime: "",
          lat: 0,
          lon: 0,
          elev: 0,
          fcstType: "TAF",
          fcsts: [fcsts15to18, fcsts18to21],
        },
        {
          icaoId: "KSGU",
          validTime: "2026-05-12T15:00:00Z",
          validTimeEnd: "2026-05-12T21:00:00Z",
          rawTAF: "",
          issueTime: "",
          lat: 0,
          lon: 0,
          elev: 0,
          fcstType: "TAF",
          fcsts: [fcsts15to18, fcsts18to21],
        },
      ];

      const result = mapAirportSpecificWeatherData(
        metar as unknown as METARResponse[],
        taf as unknown as TAFResponse[],
        {
          flightDate: "2026-05-12",
          flightTime: "15:00", // dep
          durationHours: 3, // arr at 18:00
          departureAirport: "KPVU",
          arrivalAirport: "KSGU",
        }
      );

      // dep at 15:00 → TAF period 15-18 → temp 18
      expect(result.data.temp?.[0]).toBe(18);
      // arr at 18:00 → TAF period 18-21 → temp 25
      expect(result.data.temp?.[2]).toBe(25);
    });
  });

  describe("Constants", () => {
    it("should have correct validation ranges", () => {
      expect(VALIDATION_RANGES.windDirection).toEqual({ min: 0, max: 359 });
      expect(VALIDATION_RANGES.windSpeed).toEqual({ min: 0, max: 150 });
      expect(VALIDATION_RANGES.temperature).toEqual({ min: -50, max: 50 });
      expect(VALIDATION_RANGES.altimeter).toEqual({ min: 28.0, max: 31.0 });
      expect(VALIDATION_RANGES.runwayLength).toEqual({ min: 1000, max: 20000 });
    });
  });

  describe("Edge Cases", () => {
    it("should handle null and undefined values gracefully", () => {
      const result = mapWeatherDataToWorksheet({}, null, null, {
        validateData: true,
      });

      expect(result.success).toBe(true);
      // Should handle gracefully without crashing
    });

    it("should handle malformed date/time strings gracefully via mapAirportSpecificWeatherData", () => {
      const options: WeatherMappingOptions = {
        flightDate: "invalid-date",
        flightTime: "invalid-time",
        departureAirport: "KORD",
      };

      // Should not crash; data is empty because there is no METAR/TAF input
      const { data, warnings } = mapAirportSpecificWeatherData([], [], options);

      expect(data.temp).toBeUndefined();
      expect(data.altimeter).toBeUndefined();
      // Warnings may be emitted (e.g. "no data available") but no crash
      expect(Array.isArray(warnings)).toBe(true);
    });

    it("should handle empty arrays in API responses", () => {
      const emptyApiData = {
        metar: [],
        taf: [],
        airport: [],
      };

      const result = mapWeatherDataToWorksheet(emptyApiData, null, null);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("mergeWeatherData immutability (issue #98 regression)", () => {
    it("does not mutate the existing temp array when merging in API temp values", () => {
      const existing = {
        temp: [25, 12, 26] as [number | null, number | null, number | null],
      };
      const originalTempRef = existing.temp;
      const merged = mergeWeatherData(existing, {
        temp: [22, 9, 24] as [number | null, number | null, number | null],
      });
      expect(merged.temp).not.toBe(originalTempRef);
      expect(existing.temp).toEqual([25, 12, 26]); // unchanged
      expect(merged.temp).toEqual([22, 9, 24]);
    });

    it("does not mutate the existing altimeter array when merging", () => {
      const existing = {
        altimeter: [30.12, 29.85, 30.11] as [
          number | null,
          number | null,
          number | null,
        ],
      };
      const originalRef = existing.altimeter;
      const merged = mergeWeatherData(existing, {
        altimeter: [30.0, 29.9, 30.0] as [
          number | null,
          number | null,
          number | null,
        ],
      });
      expect(merged.altimeter).not.toBe(originalRef);
      expect(existing.altimeter).toEqual([30.12, 29.85, 30.11]);
    });

    it("does not mutate the existing altitude array; honors -1 sentinel for operating slot", () => {
      const existing = {
        altitude: [4472, 10000, 4321] as [
          number | null,
          number | null,
          number | null,
        ],
      };
      const originalRef = existing.altitude;
      const merged = mergeWeatherData(existing, {
        altitude: [5000, -1, 5000] as [
          number | null,
          number | null,
          number | null,
        ],
      });
      expect(merged.altitude).not.toBe(originalRef);
      // departure + arrival updated, operating preserved because -1 means "don't update"
      expect(merged.altitude).toEqual([5000, 10000, 5000]);
      expect(existing.altitude).toEqual([4472, 10000, 4321]);
    });
  });
});
