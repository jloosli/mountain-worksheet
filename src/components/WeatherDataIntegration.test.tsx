/**
 * Unit tests for Weather Data Integration Component
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeatherDataIntegration from "./WeatherDataIntegration";
import { isApiPopulatedData } from "@/utils/weatherDataMapper";
import { fetchWorksheetWeather } from "@/utils/weatherFetch";
import type { WeatherFetchResult } from "@/utils/notifications";
import type { WorksheetData } from "@/utils/types";

jest.mock("@/utils/weatherDataMapper");
jest.mock("@/utils/weatherFetch");

const mockFetch = fetchWorksheetWeather as jest.MockedFunction<
  typeof fetchWorksheetWeather
>;

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
    } as WorksheetData,
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
      altitude: false,
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
      altitude: false,
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
    } as WorksheetData;

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

  describe("fetching", () => {
    const fetchResult: WeatherFetchResult = {
      fetchedFor: { airport: ["KORD", "KLAX"], date: "2024-01-15", time: "12:00", duration: null, position: [null, null] },
      applied: { temp: [20, null, null] },
      notifications: [
        {
          level: "warning",
          subject: { kind: "field", field: "temp", index: 2 },
          message: "KLAX: no METAR or TAF",
        },
      ],
    };

    const renderHidden = (props: Partial<React.ComponentProps<typeof WeatherDataIntegration>> = {}) =>
      render(
        <WeatherDataIntegration
          {...defaultProps}
          hideBox
          renderButton={({ onClick }) => (
            <button type="button" onClick={onClick}>
              Fetch
            </button>
          )}
          {...props}
        />
      );

    it("applies a Partial fetch and hands its result up for notifications", async () => {
      mockFetch.mockResolvedValue({ data: { temp: [20, null, null] }, result: fetchResult });
      const onDataUpdate = jest.fn();
      const onFetchResult = jest.fn();
      const onTimestampUpdate = jest.fn();
      renderHidden({ onDataUpdate, onFetchResult, onTimestampUpdate });

      fireEvent.click(screen.getByText("Fetch"));

      await waitFor(() => expect(onFetchResult).toHaveBeenCalledWith(fetchResult));
      expect(mockFetch).toHaveBeenCalledWith(defaultProps.worksheetData);
      expect(onDataUpdate).toHaveBeenCalledWith({ temp: [20, null, null] });
      expect(onTimestampUpdate).toHaveBeenCalledWith(expect.any(Date));
    });

    it("shows no blocking modal and applies nothing on a total failure", async () => {
      const failed: WeatherFetchResult = {
        ...fetchResult,
        applied: {},
        notifications: [
          {
            level: "warning",
            subject: { kind: "step", step: "weather" },
            message: "Weather fetch failed (boom)",
          },
        ],
      };
      mockFetch.mockResolvedValue({ data: null, result: failed });
      const onDataUpdate = jest.fn();
      const onFetchResult = jest.fn();
      const onTimestampUpdate = jest.fn();
      renderHidden({ onDataUpdate, onFetchResult, onTimestampUpdate });

      fireEvent.click(screen.getByText("Fetch"));

      await waitFor(() => expect(onFetchResult).toHaveBeenCalledWith(failed));
      expect(onDataUpdate).not.toHaveBeenCalled();
      expect(onTimestampUpdate).not.toHaveBeenCalled();
      // Only the loading indicator was ever a dialog, and it closes.
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      );
      expect(screen.queryByText(/fetch failed/i)).not.toBeInTheDocument();
    });

    it("renders no warnings panel of its own: notifications are shown inline", async () => {
      mockFetch.mockResolvedValue({ data: {}, result: fetchResult });
      const onFetchResult = jest.fn();
      renderHidden({ onFetchResult });

      fireEvent.click(screen.getByText("Fetch"));

      await waitFor(() => expect(onFetchResult).toHaveBeenCalled());
      expect(screen.queryByText("Weather Data Warnings")).not.toBeInTheDocument();
      expect(screen.queryByText(/KLAX: no METAR or TAF/)).not.toBeInTheDocument();
    });

    it("disables fetch when an airport code is whitespace-only", () => {
      render(
        <WeatherDataIntegration
          {...defaultProps}
          worksheetData={{
            ...defaultProps.worksheetData,
            airport: ["KOGD", "   "],
          }}
        />
      );
      expect(screen.getByText("Fetch Weather")).toBeDisabled();
    });
  });
});
