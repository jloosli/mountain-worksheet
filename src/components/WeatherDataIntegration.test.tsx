/**
 * Unit tests for Weather Data Integration Component
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeatherDataIntegration from "./WeatherDataIntegration";
import { isApiPopulatedData } from "@/utils/weatherDataMapper";
import type { WorksheetData } from "@/utils/types";

// Mock the API functions
jest.mock("@/utils/aviationWeatherApi");
jest.mock("@/utils/weatherDataMapper");
jest.mock("@/utils/openMeteoApi");
jest.mock("@/utils/areaOfOpsWeather");

// Mock functions are available but not used in simplified tests
const mockIsApiPopulatedData = isApiPopulatedData as jest.MockedFunction<
  typeof isApiPopulatedData
>;

describe("WeatherDataIntegration", () => {
  const defaultProps = {
    worksheetData: {
      airport: ["KORD", "KLAX"],
      date: "2024-01-15",
      time: "12:00",
      wind: [Array(5).fill(0), Array(5).fill(0), Array(5).fill(0)],
      temp: [21, 21, 21],
      altimeter: [29.92, 29.92, 29.92],
      rwy: [null, null],
    } as Partial<WorksheetData>,
    onDataUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockIsApiPopulatedData.mockReturnValue({
      wind: false,
      temperature: false,
      pressure: false,
      runway: false,
    });
  });

  it("should render weather data integration component", () => {
    render(<WeatherDataIntegration {...defaultProps} />);

    expect(screen.getByText("Aviation Weather Data")).toBeInTheDocument();
    expect(screen.getByText("Fetch Weather")).toBeInTheDocument();
    expect(screen.getByText("Manual Entry Required")).toBeInTheDocument();
  });

  it("should show data available status when API data is populated", () => {
    mockIsApiPopulatedData.mockReturnValue({
      wind: true,
      temperature: false,
      pressure: false,
      runway: false,
    });

    render(<WeatherDataIntegration {...defaultProps} />);

    expect(
      screen.getByText("Data populated from AviationWeather.gov")
    ).toBeInTheDocument();
    expect(screen.getByText("Data Available")).toBeInTheDocument();
  });

  it("should enable fetch button when required data is present", () => {
    render(<WeatherDataIntegration {...defaultProps} />);

    const fetchButton = screen.getByText("Fetch Weather");
    expect(fetchButton).not.toBeDisabled();
  });

  it("should disable fetch button when required data is missing", () => {
    const incompleteData = {
      ...defaultProps.worksheetData,
      airport: ["", ""] as [string, string], // Missing airports
    };

    render(
      <WeatherDataIntegration
        {...defaultProps}
        worksheetData={incompleteData}
      />
    );

    const fetchButton = screen.getByText("Fetch Weather");
    expect(fetchButton).toBeDisabled();
  });

  it("should disable fetch button when disabled prop is true", () => {
    render(<WeatherDataIntegration {...defaultProps} disabled={true} />);

    const fetchButton = screen.getByText("Fetch Weather");
    expect(fetchButton).toBeDisabled();
  });

  it("renders WeatherWarningsPanel with mapping warnings after successful fetch", async () => {
    const { mapWeatherDataToWorksheet, mergeWeatherData, isApiPopulatedData } =
      jest.requireMock("@/utils/weatherDataMapper");
    mapWeatherDataToWorksheet.mockReturnValue({
      success: true,
      data: { temp: [20, null, 22] },
      errors: [],
      warnings: [
        "KPVU: forecast unavailable for 2026-05-20T17:00Z; using nearest TAF period (Δt = 5.0 d)",
      ],
    });
    mergeWeatherData.mockImplementation((existing: object, api: object) => ({
      ...existing,
      ...api,
    }));
    isApiPopulatedData.mockReturnValue({
      wind: false,
      temperature: false,
      pressure: false,
      runway: false,
      altitude: false,
    });
    const { getWeatherDataBatch } = jest.requireMock(
      "@/utils/aviationWeatherApi"
    );
    getWeatherDataBatch.mockResolvedValue({
      metar: [],
      taf: [],
      airport: [],
    });

    render(<WeatherDataIntegration {...defaultProps} />);
    fireEvent.click(screen.getByText("Fetch Weather"));

    await waitFor(() => {
      expect(screen.getByText(/forecast unavailable/i)).toBeInTheDocument();
    });
  });
});
