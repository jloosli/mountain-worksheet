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
    expect(screen.getByText(/This tool is for reference purposes only/i)).toBeInTheDocument();
  });

  it("keeps the worksheet's PIC/FRO disclaimer wording verbatim", () => {
    render(<InstructionsPanel />);
    expect(
      screen.getByText(
        /It is up to the PIC and FRO to responsibly evaluate risks prior to release or departure\. If risks cannot be reduced to an acceptable level, a no-go decision should be considered\./,
      ),
    ).toBeInTheDocument();
  });

  it("says exceeded worksheet limits are highlighted alongside Warnings", () => {
    render(<InstructionsPanel />);
    expect(
      screen.getByText(
        "Warnings and exceeded worksheet limits are highlighted, but the worksheet does not cover all the risks involved.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/highlighted in red\/yellow/i)).not.toBeInTheDocument();
  });
});
