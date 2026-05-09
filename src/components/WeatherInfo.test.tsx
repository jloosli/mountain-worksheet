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
        [null, null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
      ],
      turb: false,
      cielVis: false,
      mtnObsc: false,
    } as WorksheetData,
  };

  it("should render weather info component", () => {
    render(<WeatherInfo {...defaultProps} />);

    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("Wind Direction (Degrees)")).toBeInTheDocument();
    expect(screen.getByText("Wind Velocity (Knots)")).toBeInTheDocument();
    expect(screen.getByText("Temperature (°C)")).toBeInTheDocument();
  });

  it("abbreviated row labels carry md:hidden class so they hide on desktop", () => {
    render(<WeatherInfo {...defaultProps} />);

    expect(screen.getByText("Wnd Dir (°)")).toHaveClass("md:hidden");
    expect(screen.getByText("Wnd Vel (kt)")).toHaveClass("md:hidden");
    expect(screen.getByText("Temp (°C)")).toHaveClass("md:hidden");
  });

  it("full row labels carry hidden and md:inline classes so they show on desktop", () => {
    render(<WeatherInfo {...defaultProps} />);

    const fullWndDir = screen.getByText("Wind Direction (Degrees)");
    expect(fullWndDir).toHaveClass("hidden");
    expect(fullWndDir).toHaveClass("md:inline");

    const fullWndVel = screen.getByText("Wind Velocity (Knots)");
    expect(fullWndVel).toHaveClass("hidden");
    expect(fullWndVel).toHaveClass("md:inline");

    const fullTemp = screen.getByText("Temperature (°C)");
    expect(fullTemp).toHaveClass("hidden");
    expect(fullTemp).toHaveClass("md:inline");
  });

  it("abbreviated and full temperature labels reflect useFahrenheit prop", () => {
    render(<WeatherInfo {...defaultProps} useFahrenheit={true} />);

    const abbrTemp = screen.getByText("Temp (°F)");
    expect(abbrTemp).toHaveClass("md:hidden");

    const fullTemp = screen.getByText("Temperature (°F)");
    expect(fullTemp).toHaveClass("hidden");
    expect(fullTemp).toHaveClass("md:inline");
  });

  it("should show API-populated styling when worksheetData has API data", () => {
    const worksheetDataWithApi: WorksheetData = {
      ...defaultProps.initialData,
      wind: [
        [270, null, null, null, null],
        [25, null, null, null, null],
        [15, null, null, null, null],
      ],
      temp: [18, 18, 18],
      altimeter: [29.85, 29.85, 29.85],
    };

    render(
      <WeatherInfo {...defaultProps} initialData={worksheetDataWithApi} />
    );

    // Check that wind direction inputs have API-populated styling
    const windDirInputs = screen.getAllByDisplayValue("270");
    expect(windDirInputs[0]).toHaveClass("bg-blue-50");
  });

  it("should show manual entry styling when worksheetData has no API data", () => {
    const worksheetDataManual: WorksheetData = {
      ...defaultProps.initialData,
      wind: [
        [null, null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
      ],
    };

    render(
      <WeatherInfo {...defaultProps} initialData={worksheetDataManual} />
    );

    // Check that inputs have manual entry styling
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveClass("bg-white");
  });
});
