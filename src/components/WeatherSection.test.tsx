import { render, screen, fireEvent } from "@testing-library/react";
import WeatherSection from "./WeatherSection";
import type { RunwayOption, WorksheetData } from "@/utils/types";

const empty: WorksheetData = {
  pilot: "",
  date: "",
  time: "",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  wind: [
    Array(5).fill(null) as (number | null)[],
    Array(5).fill(null) as (number | null)[],
    Array(5).fill(null) as (number | null)[],
  ] as [(number | null)[], (number | null)[], (number | null)[]],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [null, null, null],
  altimeter: [null, null, null],
  altitude: [null, null, null],
  rwy: [null, null],
  weight: null,
  mtnEndorse: false,
  mtnCert: false,
};

const populated: WorksheetData = {
  ...empty,
  airport: ["KOGD", "KLGU"],
  temp: [20, 5, 18],
  altimeter: [29.92, 29.92, 29.92],
  altitude: [4473, 11500, 4457],
  rwy: [5500, 5861],
};

describe("WeatherSection — sub-headings", () => {
  it("renders the three sub-headings", () => {
    render(
      <WeatherSection
        state={empty}
        onUpdate={() => {}}
        airportRunways={[null, null]}
      />
    );
    expect(screen.getByText("Aloft")).toBeInTheDocument();
    expect(screen.getByText("At airports")).toBeInTheDocument();
    expect(screen.getByText("Advisories")).toBeInTheDocument();
  });

  it("renders three airport cards under 'At airports'", () => {
    render(
      <WeatherSection
        state={populated}
        onUpdate={() => {}}
        airportRunways={[null, null]}
      />
    );
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("Operating")).toBeInTheDocument();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("KOGD")).toBeInTheDocument();
    expect(screen.getByText("KLGU")).toBeInTheDocument();
  });
});

describe("WeatherSection — runway dropdown wiring", () => {
  it("renders runway options from airportRunways and updates rwy on change", () => {
    const onUpdate = jest.fn();
    const depRunways: RunwayOption[] = [
      { id: "16/34", length: 5500, alignment: 160 },
      { id: "03/21", length: 8103, alignment: 30 },
    ];
    render(
      <WeatherSection
        state={populated}
        onUpdate={onUpdate}
        airportRunways={[depRunways, null]}
      />
    );
    const select = screen.getAllByRole("combobox", { name: /Runway/i })[0];
    fireEvent.change(select, { target: { value: "8103" } });
    expect(onUpdate).toHaveBeenCalledWith({ rwy: [8103, 5861] });
  });
});

describe("WeatherSection — advisories", () => {
  it("renders three advisory checkboxes and toggles on click", () => {
    const onUpdate = jest.fn();
    render(
      <WeatherSection
        state={populated}
        onUpdate={onUpdate}
        airportRunways={[null, null]}
      />
    );
    const turbCheckbox = screen.getByLabelText(/AIRMET Tango/i);
    fireEvent.click(turbCheckbox);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ turb: true })
    );
  });
});

describe("WeatherSection — winds aloft", () => {
  it("renders the 5-column aloft table with the right altitude headers", () => {
    render(
      <WeatherSection
        state={empty}
        onUpdate={() => {}}
        airportRunways={[null, null]}
      />
    );
    expect(screen.getByText(/3,000/)).toBeInTheDocument();
    expect(screen.getByText(/6,000/)).toBeInTheDocument();
    expect(screen.getByText(/9,000/)).toBeInTheDocument();
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
    expect(screen.getByText(/15,000/)).toBeInTheDocument();
  });

  it("calls onUpdate with the new wind array when a cell changes", () => {
    const onUpdate = jest.fn();
    render(
      <WeatherSection
        state={empty}
        onUpdate={onUpdate}
        airportRunways={[null, null]}
      />
    );
    // First wind-direction input — the 3,000 ft column.
    const dirInputs = screen.getAllByLabelText(/Wind direction at/i);
    fireEvent.change(dirInputs[0], { target: { value: "270" } });
    expect(onUpdate).toHaveBeenCalled();
    const call = onUpdate.mock.calls[0][0];
    expect(call.wind[0][0]).toBe(270);
  });
});
