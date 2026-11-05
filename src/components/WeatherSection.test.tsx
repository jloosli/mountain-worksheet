import { render, screen, fireEvent } from "@testing-library/react";
import WeatherSection from "./WeatherSection";
import type { RunwayOption, WorksheetData } from "@/utils/types";
import { fieldSubject, type Notification } from "@/utils/notifications";

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
    fireEvent.click(screen.getByLabelText(/AIRMET Tango/i));
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ turb: true })
    );
    fireEvent.click(screen.getByLabelText(/Ceiling \/ Vis/i));
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ cielVis: true })
    );
    fireEvent.click(screen.getByLabelText(/AIRMET Sierra/i));
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ mtnObsc: true })
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

describe("WeatherSection — notifications", () => {
  const renderWith = (notifications: Notification[]) =>
    render(
      <WeatherSection
        state={populated}
        onUpdate={() => {}}
        airportRunways={[null, null]}
        notifications={notifications}
      />
    );

  it("shows a whole-table winds-aloft Warning and marks every cell invalid", () => {
    renderWith([
      {
        level: "warning",
        subject: fieldSubject("wind"),
        message: "Open-Meteo request failed (network down)",
      },
    ]);
    expect(screen.getByText(/Open-Meteo request failed/)).toBeInTheDocument();
    const cell = screen.getByLabelText("Wind direction at 9,000 ft");
    expect(cell).toHaveAttribute("aria-invalid", "true");
    expect(cell).toHaveAccessibleDescription(/Open-Meteo request failed/);
  });

  it("shows a per-altitude winds-aloft notification on that column only", () => {
    renderWith([
      {
        level: "caution",
        subject: fieldSubject("wind", 0),
        message: "Target altitude 3000 ft below available pressure-level range",
      },
    ]);
    expect(
      screen.getByLabelText("Temperature at 3,000 ft")
    ).toHaveAccessibleDescription(/3000 ft below/);
    expect(
      screen.getByLabelText("Temperature at 6,000 ft")
    ).not.toHaveAttribute("aria-describedby");
  });

  it("passes airport-field notifications to the matching card", () => {
    renderWith([
      {
        level: "warning",
        subject: fieldSubject("temp", 2),
        message: "KLGU: no METAR or TAF",
      },
    ]);
    expect(screen.getByText(/KLGU: no METAR or TAF/)).toBeInTheDocument();
  });

  it("shows AIRMET flag notifications next to the flag", () => {
    renderWith([
      {
        level: "caution",
        subject: fieldSubject("cielVis"),
        message: "AIRMET IFR auto-flag uses 1000 ft / 3 sm threshold",
      },
    ]);
    expect(
      screen.getByRole("checkbox", { name: /Ceiling \/ Vis/ })
    ).toHaveAccessibleDescription(/1000 ft \/ 3 sm/);
  });
});

describe("WeatherSection — invalid entries (#225)", () => {
  it("shows a Warning on the winds-aloft column instead of silently dropping an out-of-range direction", () => {
    const onUpdate = jest.fn();
    render(
      <WeatherSection
        state={empty}
        onUpdate={onUpdate}
        airportRunways={[null, null]}
      />
    );
    const cell = screen.getByLabelText("Wind direction at 9,000 ft");
    fireEvent.change(cell, { target: { value: "400" } });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(cell).toHaveValue(400);
    expect(cell).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText(/Wind direction 400 at 9,000 ft is not valid/i)
    ).toBeInTheDocument();
  });

  it("clears the Warning once the pilot enters a valid value", () => {
    const onUpdate = jest.fn();
    render(
      <WeatherSection
        state={empty}
        onUpdate={onUpdate}
        airportRunways={[null, null]}
      />
    );
    const cell = screen.getByLabelText("Wind velocity at 3,000 ft");
    fireEvent.change(cell, { target: { value: "200" } });
    expect(screen.getByText(/Wind velocity 200 at 3,000 ft is not valid/i)).toBeInTheDocument();
    fireEvent.change(cell, { target: { value: "20" } });
    expect(onUpdate).toHaveBeenCalled();
    expect(
      screen.queryByText(/Wind velocity 200 at 3,000 ft/i)
    ).not.toBeInTheDocument();
  });

  it("shows a Warning for an out-of-range winds-aloft temperature", () => {
    render(
      <WeatherSection
        state={empty}
        onUpdate={() => {}}
        airportRunways={[null, null]}
      />
    );
    fireEvent.change(screen.getByLabelText("Temperature at 15,000 ft"), {
      target: { value: "-70" },
    });
    expect(
      screen.getByText(/Temperature -70 at 15,000 ft is not valid/i)
    ).toBeInTheDocument();
  });

  it("shows a Warning on the airport altimeter instead of silently dropping it", () => {
    const onUpdate = jest.fn();
    render(
      <WeatherSection
        state={empty}
        onUpdate={onUpdate}
        airportRunways={[null, null]}
      />
    );
    const altimeter = screen.getAllByLabelText("Altimeter")[0];
    fireEvent.change(altimeter, { target: { value: "35.00" } });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(altimeter).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText(/Altimeter 35.00 is not valid; enter 28.00–31.00 inHg/i)
    ).toBeInTheDocument();
  });
});
