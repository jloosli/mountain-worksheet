// src/components/ChecklistPanel.test.tsx
import { render, screen } from "@testing-library/react";
import ChecklistPanel from "./ChecklistPanel";

describe("ChecklistPanel", () => {
  it("renders all seven section headings", () => {
    render(<ChecklistPanel />);
    expect(screen.getByText("Basic Preflight")).toBeInTheDocument();
    expect(screen.getByText("Weather Preflight")).toBeInTheDocument();
    expect(screen.getByText("Weight and Balance Preflight")).toBeInTheDocument();
    expect(screen.getByText("Aircraft Performance Preflight")).toBeInTheDocument();
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("Enroute")).toBeInTheDocument();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
  });

  it("renders specific items under their sections", () => {
    render(<ChecklistPanel />);
    expect(
      screen.getByText(/Define runway abort point/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verify 300 feet\/minute Rate of Climb possible/i)
    ).toBeInTheDocument();
  });
});
