import { render, screen, fireEvent } from "@testing-library/react";
import AppInputs from "./AppInputs";
import type { WorksheetData } from "@/utils/types";

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

jest.mock("./WeatherSection", () => {
  return function MockWeatherSection({
    onUpdate,
  }: {
    onUpdate: (data: Partial<WorksheetData>) => void;
  }) {
    return (
      <div data-testid="weather-section">
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

describe("AppInputs", () => {
  const mockOnStateUpdate = jest.fn();
  const defaultState: WorksheetData = {
    pilot: "",
    date: "",
    time: "",
    duration: null,
    acType: "",
    tailN: "",
    airport: ["", ""],
    route: "",
    position: [null, null],
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
  });

  it("renders all child components", () => {
    render(
      <AppInputs
        state={defaultState}
        onStateUpdate={mockOnStateUpdate}
        airportRunways={[null, null]}
      />
    );

    expect(screen.getByTestId("sortie-info")).toBeInTheDocument();
    expect(screen.getByTestId("weather-section")).toBeInTheDocument();
  });

  it("renders WeatherSection with non-default state", () => {
    const testState = {
      ...defaultState,
      wind: [
        [0, 260, 270, 340, 345],
        [0, 5, 7, 13, 17],
        [0, 6, 1, -11, -17],
      ],
    };

    render(
      <AppInputs
        state={testState}
        onStateUpdate={mockOnStateUpdate}
        airportRunways={[null, null]}
      />
    );

    expect(screen.getByTestId("weather-section")).toBeInTheDocument();
  });

  it("handles updates from child components", () => {
    render(
      <AppInputs
        state={defaultState}
        onStateUpdate={mockOnStateUpdate}
        airportRunways={[null, null]}
      />
    );

    // Test SortieInfo update
    const updateSortieButton = screen.getByTestId("update-sortie-btn");
    fireEvent.click(updateSortieButton);
    expect(mockOnStateUpdate).toHaveBeenCalledWith({ pilot: "Test Pilot" });

    // Test WeatherSection update
    const updateWeatherButton = screen.getByTestId("update-weather-btn");
    fireEvent.click(updateWeatherButton);
    expect(mockOnStateUpdate).toHaveBeenCalledWith({
      wind: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    });

    // Test WeatherSection performance update
    const updatePerformanceButton = screen.getByTestId(
      "update-performance-btn"
    );
    fireEvent.click(updatePerformanceButton);
    expect(mockOnStateUpdate).toHaveBeenCalledWith({ temp: [20, 20, 20] });

    // Test AircraftWeight update
    const updateWeightButton = screen.getByTestId("update-weight-btn");
    fireEvent.click(updateWeightButton);
    expect(mockOnStateUpdate).toHaveBeenCalledWith({ weight: 2500 });
  });

  it("handles multiple rapid updates correctly", () => {
    render(
      <AppInputs
        state={defaultState}
        onStateUpdate={mockOnStateUpdate}
        airportRunways={[null, null]}
      />
    );

    const updateSortieButton = screen.getByTestId("update-sortie-btn");
    const updateWeatherButton = screen.getByTestId("update-weather-btn");

    // Click multiple buttons rapidly
    fireEvent.click(updateSortieButton);
    fireEvent.click(updateWeatherButton);
    fireEvent.click(updateSortieButton);

    expect(mockOnStateUpdate).toHaveBeenCalledTimes(3);
  });

  it("wraps Sortie Details and Weather in semantic sections with stable anchor ids", () => {
    const { container } = render(
      <AppInputs
        state={defaultState}
        onStateUpdate={() => {}}
        airportRunways={[null, null]}
      />
    );
    expect(container.querySelector("#step-sortie")).not.toBeNull();
    expect(container.querySelector("#step-weather")).not.toBeNull();
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
      <AppInputs
        state={populatedState}
        onStateUpdate={mockOnStateUpdate}
        airportRunways={[null, null]}
      />
    );

    // Verify all child components are rendered
    expect(screen.getByTestId("sortie-info")).toBeInTheDocument();
    expect(screen.getByTestId("weather-section")).toBeInTheDocument();
  });
});
