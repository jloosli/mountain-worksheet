/**
 * Unit tests for WeatherInfo Component
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeatherInfo from "./WeatherInfo";
import type { WorksheetData } from "@/utils/types";

describe("WeatherInfo", () => {
  const defaultProps = {
    onUpdate: jest.fn(),
    initialData: {
      wind: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      turb: false,
      cielVis: false,
      mtnObsc: false,
    },
  };

  it("should render weather info component", () => {
    render(<WeatherInfo {...defaultProps} />);

    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("Wind Direction (Degrees)")).toBeInTheDocument();
    expect(screen.getByText("Wind Velocity (Knots)")).toBeInTheDocument();
    expect(screen.getByText("Temperature (°C)")).toBeInTheDocument();
  });

  it("should show API-populated styling when worksheetData has API data", () => {
    const worksheetDataWithApi: Partial<WorksheetData> = {
      wind: [
        [270, 0, 0, 0, 0],
        [25, 0, 0, 0, 0],
        [15, 0, 0, 0, 0],
      ],
      temp: [18, 18, 18],
      altimeter: [29.85, 29.85, 29.85],
    };

    render(
      <WeatherInfo {...defaultProps} worksheetData={worksheetDataWithApi} />
    );

    // Check that wind direction inputs have API-populated styling
    const windDirInputs = screen.getAllByDisplayValue("270");
    expect(windDirInputs[0]).toHaveClass("bg-blue-50");
  });

  it("should show manual entry styling when worksheetData has no API data", () => {
    const worksheetDataManual: Partial<WorksheetData> = {
      wind: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    };

    render(
      <WeatherInfo {...defaultProps} worksheetData={worksheetDataManual} />
    );

    // Check that inputs have manual entry styling
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveClass("bg-white");
  });
});
