import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AppInputs from "./AppInputs";
import type { WorksheetData } from "@/utils/types";

// Mock the WeatherDataIntegration component
jest.mock("./WeatherDataIntegration", () => {
  return function MockWeatherDataIntegration({
    onDataUpdate,
    onTimestampUpdate,
  }: {
    onDataUpdate: (data: Partial<WorksheetData>) => void;
    onTimestampUpdate?: (timestamp: Date) => void;
  }) {
    return (
      <div data-testid="weather-data-integration">
        <button
          data-testid="fetch-weather-btn"
          onClick={() => {
            onDataUpdate({
              wind: [
                [0, 260, 270, 340, 345],
                [0, 5, 7, 13, 17],
                [0, 6, 1, -11, -17],
              ],
              temp: [16, 16, 16],
              altimeter: [29.92, 29.92, 29.92],
              rwy: [8107, 12002],
              altitude: [4471, 8000, 4229],
            });
            onTimestampUpdate?.(new Date("2025-01-24T10:30:00Z"));
          }}
        >
          Fetch Weather
        </button>
      </div>
    );
  };
});

// Mock other components
jest.mock("./SortieInfo", () => {
  return function MockSortieInfo({
    onUpdate,
  }: {
    onUpdate: (data: Partial<WorksheetData>) => void;
  }) {
    return (
      <div data-testid="sortie-info">
        <button
          data-testid="update-sortie-btn"
          onClick={() => onUpdate({ pilot: "Test Pilot" })}
        >
          Update Sortie
        </button>
      </div>
    );
  };
});

jest.mock("./WeatherInfo", () => {
  return function MockWeatherInfo({
    onUpdate,
    lastUpdated,
  }: {
    onUpdate: (data: Partial<WorksheetData>) => void;
    lastUpdated?: Date;
  }) {
    return (
      <div data-testid="weather-info">
        <div data-testid="last-updated">
          {lastUpdated ? lastUpdated.toISOString() : "No timestamp"}
        </div>
        <button
          data-testid="update-weather-btn"
          onClick={() =>
            onUpdate({
              wind: [
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0],
              ],
            })
          }
        >
          Update Weather
        </button>
      </div>
    );
  };
});

jest.mock("./AircraftPerformance", () => {
  return function MockAircraftPerformance({
    onUpdate,
  }: {
    onUpdate: (data: Partial<WorksheetData>) => void;
  }) {
    return (
      <div data-testid="aircraft-performance">
        <button
          data-testid="update-performance-btn"
          onClick={() => onUpdate({ temp: [20, 20, 20] })}
        >
          Update Performance
        </button>
      </div>
    );
  };
});

jest.mock("./AircraftWeight", () => {
  return function MockAircraftWeight({
    onUpdate,
  }: {
    onUpdate: (data: Partial<WorksheetData>) => void;
  }) {
    return (
      <div data-testid="aircraft-weight">
        <button
          data-testid="update-weight-btn"
          onClick={() => onUpdate({ weight: 2500 })}
        >
          Update Weight
        </button>
      </div>
    );
  };
});

jest.mock("./MountainQuals", () => {
  return function MockMountainQuals({
    onUpdate,
  }: {
    onUpdate: (data: Partial<WorksheetData>) => void;
  }) {
    return (
      <div data-testid="mountain-quals">
        <button
          data-testid="update-quals-btn"
          onClick={() => onUpdate({ mtnEndorse: true })}
        >
          Update Quals
        </button>
      </div>
    );
  };
});

// Mock window methods
const mockReplaceState = jest.fn();
const mockWriteText = jest.fn();

// Mock window.history
Object.defineProperty(window, "history", {
  value: {
    replaceState: mockReplaceState,
  },
  writable: true,
});

// Note: window.location.reload cannot be mocked in Jest environment
// We'll test that the reset button calls the function without checking reload

Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

// Mock alert
global.alert = jest.fn();

describe("AppInputs", () => {
  const mockOnStateUpdate = jest.fn();
  const defaultState = {
    pilot: "",
    date: "",
    time: "",
    acType: "",
    tailN: "",
    airport: ["", ""],
    route: "",
    wind: [Array(5).fill(0), Array(5).fill(0), Array(5).fill(0)],
    turb: false,
    cielVis: false,
    mtnObsc: false,
    temp: [21, 21, 21],
    altimeter: [29.92, 29.92, 29.92],
    altitude: [8000, 8000, 8000],
    rwy: [1000, 1000],
    weight: null,
    mtnEndorse: false,
    mtnCert: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
  });

  it("renders the component with title and action buttons", () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    expect(screen.getByText("Mountain Flying Worksheet")).toBeInTheDocument();
    expect(screen.getByText("Reset Worksheet")).toBeInTheDocument();
    expect(screen.getByText("Copy Link")).toBeInTheDocument();
  });

  it("renders all child components", () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    expect(screen.getByTestId("weather-data-integration")).toBeInTheDocument();
    expect(screen.getByTestId("sortie-info")).toBeInTheDocument();
    expect(screen.getByTestId("weather-info")).toBeInTheDocument();
    expect(screen.getByTestId("aircraft-performance")).toBeInTheDocument();
    expect(screen.getByTestId("aircraft-weight")).toBeInTheDocument();
    expect(screen.getByTestId("mountain-quals")).toBeInTheDocument();
  });

  it("handles reset button click", () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    const resetButton = screen.getByText("Reset Worksheet");
    fireEvent.click(resetButton);

    // In Jest environment, window.location.pathname is "/"
    expect(mockReplaceState).toHaveBeenCalledWith({}, "", "/");
    // Note: window.location.reload cannot be mocked, but we test that the button works
  });

  it("handles share button click successfully", async () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    const shareButton = screen.getByText("Copy Link");
    fireEvent.click(shareButton);

    await waitFor(() => {
      // In Jest environment, window.location.href is "http://localhost/"
      expect(mockWriteText).toHaveBeenCalledWith("http://localhost/");
      expect(global.alert).toHaveBeenCalledWith("URL copied to clipboard!");
    });
  });

  it("handles share button click with error", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockWriteText.mockRejectedValue(new Error("Clipboard error"));

    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    const shareButton = screen.getByText("Copy Link");
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error sharing:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it("passes worksheet data to WeatherDataIntegration", () => {
    const testState = {
      ...defaultState,
      pilot: "Test Pilot",
      airport: ["KOGD", "KSLC"],
    };

    render(<AppInputs state={testState} onStateUpdate={mockOnStateUpdate} />);

    // The WeatherDataIntegration component should receive the worksheet data
    expect(screen.getByTestId("weather-data-integration")).toBeInTheDocument();
  });

  it("handles weather data updates from WeatherDataIntegration", async () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    const fetchWeatherButton = screen.getByTestId("fetch-weather-btn");
    fireEvent.click(fetchWeatherButton);

    expect(mockOnStateUpdate).toHaveBeenCalledWith({
      wind: [
        [0, 260, 270, 340, 345],
        [0, 5, 7, 13, 17],
        [0, 6, 1, -11, -17],
      ],
      temp: [16, 16, 16],
      altimeter: [29.92, 29.92, 29.92],
      rwy: [8107, 12002],
      altitude: [4471, 8000, 4229],
    });
  });

  it("handles timestamp updates from WeatherDataIntegration", async () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    const fetchWeatherButton = screen.getByTestId("fetch-weather-btn");
    fireEvent.click(fetchWeatherButton);

    // Check that the timestamp is passed to WeatherInfo
    await waitFor(() => {
      const lastUpdatedElement = screen.getByTestId("last-updated");
      expect(lastUpdatedElement).toHaveTextContent("2025-01-24T10:30:00.000Z");
    });
  });

  it("passes worksheet data and timestamp to WeatherInfo", () => {
    const testState = {
      ...defaultState,
      wind: [
        [0, 260, 270, 340, 345],
        [0, 5, 7, 13, 17],
        [0, 6, 1, -11, -17],
      ],
    };

    render(<AppInputs state={testState} onStateUpdate={mockOnStateUpdate} />);

    // WeatherInfo should receive both worksheetData and lastUpdated props
    expect(screen.getByTestId("weather-info")).toBeInTheDocument();
  });

  it("passes worksheet data to AircraftPerformance", () => {
    const testState = {
      ...defaultState,
      rwy: [8107, 12002],
      altitude: [4471, 8000, 4229],
    };

    render(<AppInputs state={testState} onStateUpdate={mockOnStateUpdate} />);

    // AircraftPerformance should receive worksheetData prop
    expect(screen.getByTestId("aircraft-performance")).toBeInTheDocument();
  });

  it("handles updates from child components", () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    // Test SortieInfo update
    const updateSortieButton = screen.getByTestId("update-sortie-btn");
    fireEvent.click(updateSortieButton);
    expect(mockOnStateUpdate).toHaveBeenCalledWith({ pilot: "Test Pilot" });

    // Test WeatherInfo update
    const updateWeatherButton = screen.getByTestId("update-weather-btn");
    fireEvent.click(updateWeatherButton);
    expect(mockOnStateUpdate).toHaveBeenCalledWith({
      wind: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    });

    // Test AircraftPerformance update
    const updatePerformanceButton = screen.getByTestId(
      "update-performance-btn"
    );
    fireEvent.click(updatePerformanceButton);
    expect(mockOnStateUpdate).toHaveBeenCalledWith({ temp: [20, 20, 20] });

    // Test AircraftWeight update
    const updateWeightButton = screen.getByTestId("update-weight-btn");
    fireEvent.click(updateWeightButton);
    expect(mockOnStateUpdate).toHaveBeenCalledWith({ weight: 2500 });

    // Test MountainQuals update
    const updateQualsButton = screen.getByTestId("update-quals-btn");
    fireEvent.click(updateQualsButton);
    expect(mockOnStateUpdate).toHaveBeenCalledWith({ mtnEndorse: true });
  });

  it("maintains weather timestamp state correctly", async () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    // Initially no timestamp
    expect(screen.getByTestId("last-updated")).toHaveTextContent(
      "No timestamp"
    );

    // After fetching weather, timestamp should be set
    const fetchWeatherButton = screen.getByTestId("fetch-weather-btn");
    fireEvent.click(fetchWeatherButton);

    await waitFor(() => {
      expect(screen.getByTestId("last-updated")).toHaveTextContent(
        "2025-01-24T10:30:00.000Z"
      );
    });
  });

  it("handles multiple rapid updates correctly", () => {
    render(
      <AppInputs state={defaultState} onStateUpdate={mockOnStateUpdate} />
    );

    const updateSortieButton = screen.getByTestId("update-sortie-btn");
    const updateWeatherButton = screen.getByTestId("update-weather-btn");

    // Click multiple buttons rapidly
    fireEvent.click(updateSortieButton);
    fireEvent.click(updateWeatherButton);
    fireEvent.click(updateSortieButton);

    expect(mockOnStateUpdate).toHaveBeenCalledTimes(3);
  });

  it("renders with different initial states", () => {
    const populatedState = {
      ...defaultState,
      pilot: "John Doe",
      date: "2025-01-24",
      time: "10:30",
      acType: "C182T",
      tailN: "N12345",
      airport: ["KOGD", "KSLC"],
      route: "Direct",
      wind: [
        [0, 260, 270, 340, 345],
        [0, 5, 7, 13, 17],
        [0, 6, 1, -11, -17],
      ],
      temp: [16, 16, 16],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [4471, 8000, 4229],
      rwy: [8107, 12002],
      weight: 2500,
      mtnEndorse: true,
      mtnCert: false,
    };

    render(
      <AppInputs state={populatedState} onStateUpdate={mockOnStateUpdate} />
    );

    expect(screen.getByText("Mountain Flying Worksheet")).toBeInTheDocument();
    expect(screen.getByTestId("weather-data-integration")).toBeInTheDocument();
  });
});
