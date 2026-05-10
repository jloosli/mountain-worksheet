import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeatherWarningsPanel from "./WeatherWarningsPanel";

describe("WeatherWarningsPanel", () => {
  it("renders nothing when warnings array is empty", () => {
    const { container } = render(<WeatherWarningsPanel warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when warnings is undefined", () => {
    const { container } = render(<WeatherWarningsPanel warnings={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each warning as a list item", () => {
    render(
      <WeatherWarningsPanel
        warnings={[
          "KPVU: forecast unavailable for 2026-05-20T17:00Z; using nearest TAF period (Δt = 5.0 d)",
          "Operating area position not entered; using midpoint of KPVU↔KSGU",
        ]}
      />
    );
    expect(screen.getByText(/forecast unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Operating area position/i)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("uses amber styling and an alert role", () => {
    render(<WeatherWarningsPanel warnings={["something"]} />);
    const region = screen.getByRole("alert");
    expect(region).toBeInTheDocument();
  });
});
