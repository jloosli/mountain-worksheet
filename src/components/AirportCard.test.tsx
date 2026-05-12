// src/components/AirportCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import AirportCard from "./AirportCard";
import type { RunwayOption } from "@/utils/types";

const noOp = () => {};

const baseProps = {
  temperature: null,
  altimeter: null,
  onTemperatureChange: noOp,
  onAltimeterChange: noOp,
  apiPopulated: { temperature: false, pressure: false, runway: false },
  useFahrenheit: false,
};

describe("AirportCard — departure variant", () => {
  it("renders the airport code in the header", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
      />
    );
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("KOGD")).toBeInTheDocument();
  });

  it("renders the field elevation when provided", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
      />
    );
    expect(screen.getByText(/4,473 ft/)).toBeInTheDocument();
  });

  it("renders the runway dropdown with id + length options, helipads excluded", () => {
    const runways: RunwayOption[] = [
      { id: "16/34", length: 5500, alignment: 160 },
      { id: "03/21", length: 8103, alignment: 30 },
      { id: "H1", length: 60, alignment: null }, // helipad
    ];
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
        runways={runways}
        selectedRunwayLength={5500}
        onRunwaySelect={noOp}
      />
    );
    const select = screen.getByRole("combobox", { name: /Runway/i });
    const options = Array.from(
      select.querySelectorAll("option")
    ) as HTMLOptionElement[];
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toMatch(/16\/34/);
    expect(options[0].textContent).toMatch(/5,500/);
    expect(options[1].textContent).toMatch(/03\/21/);
    expect(options[1].textContent).toMatch(/8,103/);
    expect(select).toHaveValue("5500");
  });

  it("renders 'Fetch weather to load runways' placeholder when runways is null", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
        runways={null}
        selectedRunwayLength={null}
        onRunwaySelect={noOp}
      />
    );
    expect(screen.queryByRole("combobox", { name: /Runway/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Fetch weather to load runways/i)).toBeInTheDocument();
  });

  it("calls onRunwaySelect with the chosen runway length", () => {
    const onRunwaySelect = jest.fn();
    const runways: RunwayOption[] = [
      { id: "16/34", length: 5500, alignment: 160 },
      { id: "03/21", length: 8103, alignment: 30 },
    ];
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
        runways={runways}
        selectedRunwayLength={5500}
        onRunwaySelect={onRunwaySelect}
      />
    );
    fireEvent.change(screen.getByRole("combobox", { name: /Runway/i }), {
      target: { value: "8103" },
    });
    expect(onRunwaySelect).toHaveBeenCalledWith(8103);
  });

  it("applies API-populated styling to the runway dropdown when apiPopulated.runway is true", () => {
    const runways: RunwayOption[] = [
      { id: "16/34", length: 5500, alignment: 160 },
    ];
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        runways={runways}
        selectedRunwayLength={5500}
        apiPopulated={{ temperature: false, pressure: false, runway: true }}
      />
    );
    expect(screen.getByRole("combobox", { name: /Runway/i })).toHaveClass("bg-blue-50");
  });

  it("renders placeholder when all runways are helipads", () => {
    const runways: RunwayOption[] = [{ id: "H1", length: 60, alignment: null }];
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        runways={runways}
        selectedRunwayLength={null}
      />
    );
    expect(screen.queryByRole("combobox", { name: /Runway/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Fetch weather to load runways/i)).toBeInTheDocument();
  });

  it("calls onTemperatureChange and onAltimeterChange on input", () => {
    const onTemperatureChange = jest.fn();
    const onAltimeterChange = jest.fn();
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        fieldElev={4473}
        temperature={20}
        altimeter={29.92}
        onTemperatureChange={onTemperatureChange}
        onAltimeterChange={onAltimeterChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/Temperature/i), {
      target: { value: "22" },
    });
    expect(onTemperatureChange).toHaveBeenCalledWith("22");
    fireEvent.change(screen.getByLabelText(/Altimeter/i), {
      target: { value: "30.01" },
    });
    expect(onAltimeterChange).toHaveBeenCalledWith("30.01");
  });
});

describe("AirportCard — operating variant", () => {
  it("renders the operating header and altitude link to step-sortie", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="operating"
        operatingAltitude={11500}
      />
    );
    expect(screen.getByText("Operating")).toBeInTheDocument();
    const altitudeLink = screen.getByRole("link", { name: /11,500 ft/i });
    expect(altitudeLink).toHaveAttribute("href", "#step-sortie");
  });

  it("does not render runway dropdown or field elev for operating variant", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="operating"
        operatingAltitude={11500}
      />
    );
    expect(screen.queryByRole("combobox", { name: /Runway/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Field elev/i)).not.toBeInTheDocument();
  });

  it("applies API-populated styling to operating temp + altimeter when fetched", () => {
    // Operating values come from open-meteo's area-of-ops weather, so they
    // ARE API-fetched (despite the old AircraftPerformance excluding them).
    render(
      <AirportCard
        {...baseProps}
        variant="operating"
        operatingAltitude={11500}
        temperature={5}
        altimeter={29.92}
        apiPopulated={{ temperature: true, pressure: true, runway: false }}
      />
    );
    expect(screen.getByLabelText(/Temperature/i)).toHaveClass("bg-blue-50");
    expect(screen.getByLabelText(/Altimeter/i)).toHaveClass("bg-blue-50");
  });
});

describe("AirportCard — arrival variant", () => {
  it("renders the arrival header with the airport code", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="arrival"
        airportCode="KLGU"
        fieldElev={4457}
      />
    );
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("KLGU")).toBeInTheDocument();
    expect(screen.getByText(/4,457 ft/)).toBeInTheDocument();
  });

  it("renders the runway dropdown for arrival, helipads excluded", () => {
    const runways: RunwayOption[] = [
      { id: "17/35", length: 5861, alignment: 170 },
      { id: "H1", length: 60, alignment: null },
    ];
    render(
      <AirportCard
        {...baseProps}
        variant="arrival"
        airportCode="KLGU"
        fieldElev={4457}
        runways={runways}
        selectedRunwayLength={5861}
        onRunwaySelect={noOp}
      />
    );
    const select = screen.getByRole("combobox", { name: /Runway/i });
    const options = Array.from(select.querySelectorAll("option"));
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toMatch(/17\/35/);
  });
});

describe("AirportCard — useFahrenheit", () => {
  it("displays the stored Celsius value converted to Fahrenheit", () => {
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        temperature={20} // 20 °C = 68 °F
        useFahrenheit={true}
      />
    );
    const tempInput = screen.getByLabelText(/Temperature/i) as HTMLInputElement;
    expect(tempInput.value).toBe("68");
  });
});

describe("AirportCard — local string buffer", () => {
  it("preserves intermediate altimeter typing when parent rejects out-of-range input", () => {
    // Parent rejects values outside [28.00, 31.00] by no-op'ing its update.
    // The local buffer should keep what the user typed visible regardless.
    const onAltimeterChange = jest.fn();
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        altimeter={29.92}
        onAltimeterChange={onAltimeterChange}
      />
    );
    const altInput = screen.getByLabelText(/Altimeter/i) as HTMLInputElement;
    expect(altInput.value).toBe("29.92");

    fireEvent.change(altInput, { target: { value: "3" } });
    expect(onAltimeterChange).toHaveBeenCalledWith("3");
    // Parent returned early — props.altimeter is still 29.92 — but the
    // local buffer holds "3" so the user sees their keystroke.
    expect(altInput.value).toBe("3");
  });

  it("syncs the temperature display when the prop changes externally", () => {
    const { rerender } = render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        temperature={null}
      />
    );
    expect((screen.getByLabelText(/Temperature/i) as HTMLInputElement).value).toBe("");
    rerender(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        temperature={20}
      />
    );
    expect((screen.getByLabelText(/Temperature/i) as HTMLInputElement).value).toBe("20");
  });
});

describe("AirportCard — runway auto-default", () => {
  it("auto-selects the shortest non-helipad runway when selectedRunwayLength is null", () => {
    const onRunwaySelect = jest.fn();
    const runways: RunwayOption[] = [
      { id: "03/21", length: 8103, alignment: 30 },
      { id: "16/34", length: 5500, alignment: 160 },
      { id: "H1", length: 60, alignment: null },
    ];
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        runways={runways}
        selectedRunwayLength={null}
        onRunwaySelect={onRunwaySelect}
      />
    );
    expect(onRunwaySelect).toHaveBeenCalledWith(5500);
  });

  it("does not auto-select when selectedRunwayLength already matches a runway", () => {
    const onRunwaySelect = jest.fn();
    const runways: RunwayOption[] = [
      { id: "16/34", length: 5500, alignment: 160 },
      { id: "03/21", length: 8103, alignment: 30 },
    ];
    render(
      <AirportCard
        {...baseProps}
        variant="departure"
        airportCode="KOGD"
        runways={runways}
        selectedRunwayLength={8103}
        onRunwaySelect={onRunwaySelect}
      />
    );
    expect(onRunwaySelect).not.toHaveBeenCalled();
  });
});
