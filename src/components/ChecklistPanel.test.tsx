// src/components/ChecklistPanel.test.tsx
import { render, screen, within } from "@testing-library/react";
import ChecklistPanel from "./ChecklistPanel";
import type { LimitCheck } from "@/utils/limitChecks";

const check = (overrides: Partial<LimitCheck>): LimitCheck => ({
  id: "weight",
  name: "Weight",
  limit: "under 90% of maximum gross weight",
  caveat: null,
  step: "sortie",
  state: "within",
  points: [],
  ...overrides,
});

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

  describe("Worksheet limits", () => {
    const checks = [
      check({ id: "weight", name: "Weight", state: "exceeded" }),
      check({ id: "winds", name: "Winds aloft", limit: "under 30 kt", step: "weather", state: "not-checked" }),
    ];

    it("lists every check with its state, ahead of the pilot-judgement items", () => {
      render(<ChecklistPanel checks={checks} />);
      const list = screen.getByRole("list", { name: "Worksheet limits" });
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent("Weight");
      expect(items[0]).toHaveTextContent("Exceeded");
      expect(items[1]).toHaveTextContent("Winds aloft");
      expect(items[1]).toHaveTextContent("Not checked");
      expect(
        list.compareDocumentPosition(screen.getByText("Basic Preflight")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("shows each check's worksheet limit", () => {
      render(<ChecklistPanel checks={checks} />);
      expect(screen.getByText(/under 90% of maximum gross weight/)).toBeInTheDocument();
    });

    it("shows no list when there are no checks", () => {
      render(<ChecklistPanel />);
      expect(screen.queryByRole("list", { name: "Worksheet limits" })).not.toBeInTheDocument();
    });
  });
});
