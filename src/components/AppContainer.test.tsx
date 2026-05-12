import { render, screen } from "../test-utils/test-utils";
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

  it("renders InstructionsAndNotes below MountainFlyingChecklist", () => {
    const { container } = render(<AppContainer />);
    const all = Array.from(container.querySelectorAll("details > summary"));
    const labels = all.map((s) => s.textContent ?? "");
    const checklistIdx = labels.findIndex((t) => t.includes("Mountain Flying Checklist"));
    const instructionsIdx = labels.findIndex((t) => t.includes("Instructions and Notes"));
    expect(checklistIdx).toBeGreaterThan(-1);
    expect(instructionsIdx).toBeGreaterThan(-1);
    expect(instructionsIdx).toBeGreaterThan(checklistIdx);
  });

  it("renders the sticky ActionBar region", () => {
    render(<AppContainer />);
    // ActionBar always renders a Fetch weather button (disabled in incomplete state)
    expect(
      screen.getByRole("button", { name: /Fetch weather/i })
    ).toBeInTheDocument();
  });
});
