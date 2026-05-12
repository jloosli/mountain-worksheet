import { render, screen } from "@testing-library/react";
import InstructionsPanel from "./InstructionsPanel";

describe("InstructionsPanel", () => {
  it("renders the three top-level section headings", () => {
    render(<InstructionsPanel />);
    expect(screen.getByText("Special Inputs")).toBeInTheDocument();
    expect(screen.getByText("Using the Tool")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("renders the position-format table with all 8 supported formats", () => {
    render(<InstructionsPanel />);
    // Each format row has its `entry` example in num-mono. Spot-check three.
    expect(screen.getByText("36.01N/75.50W")).toBeInTheDocument();
    expect(screen.getByText("KOGD/285/34")).toBeInTheDocument();
    expect(screen.getByText("OGD/285/34")).toBeInTheDocument();
  });

  it("emphasises the 'reference only' operational note", () => {
    render(<InstructionsPanel />);
    expect(
      screen.getByText(/This tool is for reference purposes only/i)
    ).toBeInTheDocument();
  });
});
