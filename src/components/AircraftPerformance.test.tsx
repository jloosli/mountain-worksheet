import { render, screen, fireEvent } from "@testing-library/react";
import AircraftPerformance from "./AircraftPerformance";

// Mock the isApiPopulatedData function
jest.mock("@/utils/weatherDataMapper", () => ({
  isApiPopulatedData: jest.fn(),
}));

import { isApiPopulatedData } from "@/utils/weatherDataMapper";

const mockIsApiPopulatedData = isApiPopulatedData as jest.MockedFunction<
  typeof isApiPopulatedData
>;

describe("AircraftPerformance", () => {
  const mockOnUpdate = jest.fn();
  const defaultInitialData = {
    airport: ["KOGD", "KSLC"],
    temp: [21, 21, 21],
    altimeter: [29.92, 29.92, 29.92],
    altitude: [8000, 8000, 8000],
    rwy: [1000, 1000],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsApiPopulatedData.mockReturnValue({
      wind: false,
      temperature: false,
      pressure: false,
      runway: false,
      altitude: false,
    });
  });

  it("renders the component with title and table", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Aircraft Performance" })
    ).toBeInTheDocument();
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("Operating")).toBeInTheDocument();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
  });

  it("displays airport information correctly", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText("KOGD")).toBeInTheDocument();
    expect(screen.getByText("KSLC")).toBeInTheDocument();
  });

  it("displays default values for all input fields", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    // Check temperature inputs
    const tempInputs = screen.getAllByDisplayValue("21");
    expect(tempInputs).toHaveLength(3);

    // Check altimeter inputs
    const altimeterInputs = screen.getAllByDisplayValue("29.92");
    expect(altimeterInputs).toHaveLength(3);

    // Operating altitude is now read-only text; only departure and arrival are inputs
    const altitudeInputs = screen.getAllByDisplayValue("8000");
    expect(altitudeInputs).toHaveLength(2);
    // Operating altitude shown as text
    expect(screen.getByText("8000")).toBeInTheDocument();

    // Check runway inputs
    const runwayInputs = screen.getAllByDisplayValue("1000");
    expect(runwayInputs).toHaveLength(2);
  });

  it("handles runway input changes", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    const departureRunwayInput = screen.getAllByDisplayValue("1000")[0];
    const arrivalRunwayInput = screen.getAllByDisplayValue("1000")[1];

    // Test departure runway change
    fireEvent.change(departureRunwayInput, { target: { value: "8107" } });
    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [21, 21, 21],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [8000, 8000, 8000],
      rwy: [8107, 1000],
    });

    // Test arrival runway change
    fireEvent.change(arrivalRunwayInput, { target: { value: "12002" } });
    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [21, 21, 21],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [8000, 8000, 8000],
      rwy: [1000, 12002],
    });
  });

  it("handles temperature input changes", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    const tempInputs = screen.getAllByDisplayValue("21");

    // Test departure temperature change
    fireEvent.change(tempInputs[0], { target: { value: "16" } });
    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [16, 21, 21],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [8000, 8000, 8000],
      rwy: [1000, 1000],
    });

    // Test operating temperature change
    fireEvent.change(tempInputs[1], { target: { value: "18" } });
    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [21, 18, 21],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [8000, 8000, 8000],
      rwy: [1000, 1000],
    });

    // Test arrival temperature change
    fireEvent.change(tempInputs[2], { target: { value: "20" } });
    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [21, 21, 20],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [8000, 8000, 8000],
      rwy: [1000, 1000],
    });
  });

  it("handles altimeter input changes", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    const altimeterInputs = screen.getAllByDisplayValue("29.92");

    // Test departure altimeter change
    fireEvent.change(altimeterInputs[0], { target: { value: "30.15" } });
    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [21, 21, 21],
      altimeter: [30.15, 29.92, 29.92],
      altitude: [8000, 8000, 8000],
      rwy: [1000, 1000],
    });
  });

  it("handles altitude input changes", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    // Operating altitude is now read-only; only departure and arrival are inputs
    const altitudeInputs = screen.getAllByDisplayValue("8000");
    expect(altitudeInputs).toHaveLength(2);

    // Test departure altitude change
    fireEvent.change(altitudeInputs[0], { target: { value: "4471" } });
    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [21, 21, 21],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [4471, 8000, 8000],
      rwy: [1000, 1000],
    });

    // Test arrival altitude change
    fireEvent.change(altitudeInputs[1], { target: { value: "4229" } });
    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [21, 21, 21],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [8000, 8000, 4229],
      rwy: [1000, 1000],
    });
  });

  it("updates local data when initialData changes", () => {
    const { rerender } = render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    const newInitialData = {
      ...defaultInitialData,
      temp: [16, 18, 20],
      rwy: [8107, 12002],
    };

    rerender(
      <AircraftPerformance
        initialData={newInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    // Check that the new values are displayed
    expect(screen.getByDisplayValue("16")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("8107")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12002")).toBeInTheDocument();
  });

  it("updates local data when worksheetData changes", () => {
    const worksheetData = {
      temp: [16, 18, 20],
      rwy: [8107, 12002],
      altitude: [4471, 8000, 4229],
    };

    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
        worksheetData={worksheetData}
      />
    );

    // Check that worksheetData values are displayed
    expect(screen.getByDisplayValue("16")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("8107")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12002")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4471")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4229")).toBeInTheDocument();
  });

  it("applies API styling to runway fields when runway data is API-populated", () => {
    mockIsApiPopulatedData.mockReturnValue({
      wind: false,
      temperature: false,
      pressure: false,
      runway: true,
      altitude: false,
    });

    const worksheetData = {
      rwy: [8107, 12002],
    };

    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
        worksheetData={worksheetData}
      />
    );

    const runwayInputs = screen.getAllByDisplayValue("8107");
    runwayInputs.forEach((input) => {
      expect(input).toHaveClass("bg-blue-50", "border-blue-300");
    });
  });

  it("applies API styling to temperature fields when temperature data is API-populated", () => {
    mockIsApiPopulatedData.mockReturnValue({
      wind: false,
      temperature: true,
      pressure: false,
      runway: false,
      altitude: false,
    });

    const worksheetData = {
      temp: [16, 18, 20],
    };

    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
        worksheetData={worksheetData}
      />
    );

    const tempInputs = screen.getAllByDisplayValue("16");
    tempInputs.forEach((input) => {
      expect(input).toHaveClass("bg-blue-50", "border-blue-300");
    });
  });

  it("applies API styling to altitude fields when altitude data is API-populated", () => {
    mockIsApiPopulatedData.mockReturnValue({
      wind: false,
      temperature: false,
      pressure: false,
      runway: false,
      altitude: true,
    });

    const worksheetData = {
      altitude: [4471, 8000, 4229],
    };

    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
        worksheetData={worksheetData}
      />
    );

    // Check that departure altitude (4471) has API styling
    const departureAltitudeInput = screen.getByDisplayValue("4471");
    expect(departureAltitudeInput).toHaveClass("bg-blue-50", "border-blue-300");

    // Check that arrival altitude (4229) has API styling
    const arrivalAltitudeInput = screen.getByDisplayValue("4229");
    expect(arrivalAltitudeInput).toHaveClass("bg-blue-50", "border-blue-300");

    // Operating altitude is now read-only text (moved to SortieInfo)
    expect(screen.getByText("8000")).toBeInTheDocument();
  });

  it("applies manual styling to fields when data is not API-populated", () => {
    mockIsApiPopulatedData.mockReturnValue({
      wind: false,
      temperature: false,
      pressure: false,
      runway: false,
      altitude: false,
    });

    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    const runwayInputs = screen.getAllByDisplayValue("1000");
    runwayInputs.forEach((input) => {
      expect(input).toHaveClass("bg-white", "border-gray-300");
    });

    const tempInputs = screen.getAllByDisplayValue("21");
    tempInputs.forEach((input) => {
      expect(input).toHaveClass("bg-white", "border-gray-300");
    });
  });

  it("handles empty input values gracefully", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    const runwayInput = screen.getAllByDisplayValue("1000")[0];
    fireEvent.change(runwayInput, { target: { value: "" } });

    // Should handle empty string gracefully (converts to null)
    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [21, 21, 21],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [8000, 8000, 8000],
      rwy: [null, 1000],
    });
  });

  it("handles negative input values", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    const tempInput = screen.getAllByDisplayValue("21")[0];
    fireEvent.change(tempInput, { target: { value: "-10" } });

    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [-10, 21, 21],
      altimeter: [29.92, 29.92, 29.92],
      altitude: [8000, 8000, 8000],
      rwy: [1000, 1000],
    });
  });

  it("handles decimal input values", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    const altimeterInput = screen.getAllByDisplayValue("29.92")[0];
    fireEvent.change(altimeterInput, { target: { value: "30.15" } });

    expect(mockOnUpdate).toHaveBeenCalledWith({
      airport: ["KOGD", "KSLC"],
      temp: [21, 21, 21],
      altimeter: [30.15, 29.92, 29.92],
      altitude: [8000, 8000, 8000],
      rwy: [1000, 1000],
    });
  });

  it("prioritizes worksheetData over initialData when both are provided", () => {
    const worksheetData = {
      temp: [16, 18, 20],
      rwy: [8107, 12002],
    };

    const initialData = {
      ...defaultInitialData,
      temp: [25, 25, 25],
      rwy: [5000, 5000],
    };

    render(
      <AircraftPerformance
        initialData={initialData}
        onUpdate={mockOnUpdate}
        worksheetData={worksheetData}
      />
    );

    // Should display worksheetData values, not initialData values
    expect(screen.getByDisplayValue("16")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("8107")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12002")).toBeInTheDocument();

    // Should not display initialData values
    expect(screen.queryByDisplayValue("25")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("5000")).not.toBeInTheDocument();
  });

  it("falls back to initialData when worksheetData is not provided", () => {
    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
      />
    );

    // Should display initialData values
    expect(screen.getAllByDisplayValue("21")).toHaveLength(3);
    expect(screen.getAllByDisplayValue("1000")).toHaveLength(2);
    // Operating altitude is read-only text; departure and arrival remain as inputs
    expect(screen.getAllByDisplayValue("8000")).toHaveLength(2);
    expect(screen.getByText("8000")).toBeInTheDocument();
  });

  it("handles partial worksheetData updates", () => {
    const worksheetData = {
      rwy: [8107, 12002],
      // temp and altitude not provided
    };

    render(
      <AircraftPerformance
        initialData={defaultInitialData}
        onUpdate={mockOnUpdate}
        worksheetData={worksheetData}
      />
    );

    // Should display worksheetData for runway
    expect(screen.getByDisplayValue("8107")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12002")).toBeInTheDocument();

    // Should display initialData for temp and altitude
    expect(screen.getAllByDisplayValue("21")).toHaveLength(3);
    // Operating altitude is read-only text; departure and arrival remain as inputs
    expect(screen.getAllByDisplayValue("8000")).toHaveLength(2);
    expect(screen.getByText("8000")).toBeInTheDocument();
  });
});
