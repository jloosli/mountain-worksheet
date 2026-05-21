import { render, screen, fireEvent } from "../test-utils/test-utils";
import AppContainer from "./AppContainer";

describe("AppContainer", () => {
  it("renders without crashing", () => {
    render(<AppContainer />);
    expect(screen.getByText("Mountain Flying Worksheet")).toBeInTheDocument();
  });

  it("renders the worksheet Stepper above the inputs", () => {
    render(<AppContainer />);
    expect(screen.getByRole("navigation", { name: /worksheet steps/i })).toBeInTheDocument();
  });

  it("wraps Calculations in the step-decision anchor", () => {
    const { container } = render(<AppContainer />);
    const anchor = container.querySelector("#step-decision");
    expect(anchor).not.toBeNull();
  });

  it("renders the slide-over triggers (instructions in header, checklist on action bar)", () => {
    render(<AppContainer />);
    expect(
      screen.getByRole("button", { name: /Open instructions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Checklist/i })
    ).toBeInTheDocument();
  });

  it("renders the sticky ActionBar region", () => {
    render(<AppContainer />);
    // ActionBar always renders a Fetch weather button (disabled in incomplete state)
    expect(
      screen.getByRole("button", { name: /Fetch weather/i })
    ).toBeInTheDocument();
  });
});

describe("AppContainer — print wiring", () => {
  it("renders the Print briefing button", () => {
    render(<AppContainer />);
    expect(
      screen.getByRole("button", { name: /Print briefing/i }),
    ).toBeInTheDocument();
  });

  it("calls window.print when Print briefing is clicked", () => {
    const spy = jest.spyOn(window, "print").mockImplementation(() => {});
    render(<AppContainer />);
    fireEvent.click(screen.getByRole("button", { name: /Print briefing/i }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders the PrintBriefing region in the tree", () => {
    render(<AppContainer />);
    expect(
      screen.getByRole("region", { name: /Print briefing/i }),
    ).toBeInTheDocument();
  });
});
