/**
 * Unit tests for Aviation Weather API integration
 */

import {
  getMETAR,
  getTAF,
  getAirportInfo,
  getWindTemp,
  getWeatherDataBatch,
  debouncedRequest,
  APIError,
  type METARResponse,
  type TAFResponse,
  type AirportResponse,
  type WindTempResponse,
} from "./aviationWeatherApi";

// Mock fetch globally
global.fetch = jest.fn();

// Mock setTimeout for testing debouncing
jest.useFakeTimers();

describe("Aviation Weather API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe("getMETAR", () => {
    const mockMETARResponse: METARResponse[] = [
      {
        icaoId: "KORD",
        obsTime: "2024-01-15T12:00:00Z",
        report: "METAR KORD 151200Z 27015KT 10SM FEW250 21/12 A2992",
        temp: 21,
        dewp: 12,
        wdir: 270,
        wspd: 15,
        visib: 10,
        altim: 29.92,
        qcField: 1,
        metarType: "METAR",
        rawOb: "KORD 151200Z 27015KT 10SM FEW250 21/12 A2992",
      },
    ];

    it("should fetch METAR data successfully", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMETARResponse,
      });

      const result = await getMETAR(["KORD"], 1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/aviation-weather?endpoint=metar"),
        expect.objectContaining({
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "Mountain-Worksheet/1.0",
          },
        })
      );

      expect(result).toEqual(mockMETARResponse);
    });

    it("should handle multiple airports", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMETARResponse,
      });

      await getMETAR(["KORD", "KLAX", "KJFK"], 2);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=KORD%2CKLAX%2CKJFK"),
        expect.any(Object)
      );
    });

    it("should handle API errors", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Airport not found",
      });

      await expect(getMETAR(["INVALID"], 1, 0)).rejects.toThrow(
        "Not Found - Airport or data not available"
      );
    });
  });

  describe("getTAF", () => {
    const mockTAFResponse: TAFResponse[] = [
      {
        icaoId: "KORD",
        issueTime: "2024-01-15T06:00:00Z",
        validTime: "2024-01-15T06:00:00Z",
        rawTAF: "TAF KORD 150600Z 1506/1606 27015KT P6SM FEW250",
        lat: 41.9786,
        lon: -87.9048,
        elev: 672,
        fcstType: "TAF",
      },
    ];

    it("should fetch TAF data successfully", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTAFResponse,
      });

      const result = await getTAF(["KORD"], 24);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/aviation-weather?endpoint=taf"),
        expect.objectContaining({
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "Mountain-Worksheet/1.0",
          },
        })
      );

      expect(result).toEqual(mockTAFResponse);
    });

    it("should handle TAF API errors", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad request",
      });

      await expect(getTAF(["KORD"], 24, 0)).rejects.toThrow(
        "Bad Request - Invalid parameters"
      );
    });
  });

  describe("getAirportInfo", () => {
    const mockAirportResponse: AirportResponse[] = [
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
            surface: "CONCRETE",
            alignment: 100,
            lighted: true,
            closed: false,
          },
        ],
      },
    ];

    it("should fetch airport information successfully", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAirportResponse,
      });

      const result = await getAirportInfo(["KORD"]);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/aviation-weather?endpoint=airport"),
        expect.objectContaining({
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "Mountain-Worksheet/1.0",
          },
        })
      );

      expect(result).toEqual(mockAirportResponse);
    });
  });

  describe("getWindTemp", () => {
    const mockWindTempResponse: WindTempResponse[] = [
      {
        icaoId: "KORD",
        validTime: "2024-01-15T12:00:00Z",
        altitude: 3000,
        wdir: 270,
        wspd: 25,
        temp: 15,
        pressure: 26.92,
      },
    ];

    it("should fetch wind/temperature data successfully", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWindTempResponse,
      });

      const result = await getWindTemp(["KORD"], [3000, 6000, 9000]);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/aviation-weather?endpoint=windtemp"),
        expect.objectContaining({
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "Mountain-Worksheet/1.0",
          },
        })
      );

      expect(result).toEqual(mockWindTempResponse);
    });
  });

  describe("getWeatherDataBatch", () => {
    const mockBatchResponse = {
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
          altim: 29.92,
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
          rawTAF: "TAF KORD 150600Z 1506/1606 27015KT P6SM FEW250",
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
        },
      ],
      windTemp: [
        {
          icaoId: "KORD",
          validTime: "2024-01-15T12:00:00Z",
          altitude: 3000,
          wdir: 270,
          wspd: 25,
          temp: 15,
          pressure: 26.92,
        },
      ],
    };

    it("should fetch all weather data types in batch", async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse.metar,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse.taf,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse.airport,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse.windTemp,
        });

      const result = await getWeatherDataBatch(["KORD"]);

      expect(fetch).toHaveBeenCalledTimes(4);
      expect(result).toEqual(mockBatchResponse);
    });

    it("should handle partial failures in batch requests", async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse.metar,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse.airport,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse.windTemp,
        });

      const result = await getWeatherDataBatch(["KORD"], {
        includeMETAR: true,
        includeTAF: false,
        includeAirport: true,
        includeWindTemp: true,
      });

      expect(result.metar).toEqual(mockBatchResponse.metar);
      expect(result.taf).toBeUndefined();
      expect(result.airport).toEqual(mockBatchResponse.airport);
      expect(result.windTemp).toEqual(mockBatchResponse.windTemp);
    });

    it("should respect include options", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBatchResponse.metar,
      });

      const result = await getWeatherDataBatch(["KORD"], {
        includeMETAR: true,
        includeTAF: false,
        includeAirport: false,
        includeWindTemp: false,
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.metar).toEqual(mockBatchResponse.metar);
      expect(result.taf).toBeUndefined();
      expect(result.airport).toBeUndefined();
      expect(result.windTemp).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    it("should not retry on 400 errors", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad request",
      });

      await expect(getMETAR(["INVALID"], 1, 0)).rejects.toThrow(
        "Bad Request - Invalid parameters"
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry on 404 errors", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not found",
      });

      await expect(getMETAR(["INVALID"], 1, 0)).rejects.toThrow(
        "Not Found - Airport or data not available"
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should handle network errors", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad request",
      });

      await expect(getMETAR(["KORD"], 1, 0)).rejects.toThrow(
        "Bad Request - Invalid parameters"
      );
    });
  });

  describe("debouncedRequest", () => {
    it("should handle errors in debounced requests", async () => {
      const mockRequest = jest
        .fn()
        .mockRejectedValue(new Error("Request failed"));

      const promise = debouncedRequest(mockRequest, 1000);

      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow("Request failed");
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe("Rate Limiting", () => {
    it("should track request count", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      // Make multiple requests quickly
      await getMETAR(["KORD"], 1, 0);
      await getMETAR(["KLAX"], 1, 0);
      await getMETAR(["KJFK"], 1, 0);

      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("URL Construction", () => {
    it("should construct correct URLs with parameters", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await getMETAR(["KORD", "KLAX"], 2);

      const callUrl = (fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain("/api/aviation-weather?endpoint=metar");
      expect(callUrl).toContain("ids=KORD%2CKLAX");
      expect(callUrl).toContain("format=json");
      expect(callUrl).toContain("hours=2");
    });

    it("should handle special characters in airport codes", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await getMETAR(["KORD", "EGLL"], 1);

      const callUrl = (fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain("ids=KORD%2CEGLL");
    });
  });

  describe("APIError class", () => {
    it("should create APIError with correct properties", () => {
      const error = new APIError({
        code: 404,
        message: "Not found",
        details: "Airport not found",
      });

      expect(error.name).toBe("APIError");
      expect(error.code).toBe(404);
      expect(error.message).toBe("Not found");
      expect(error.details).toBe("Airport not found");
      expect(error instanceof Error).toBe(true);
    });
  });
});
