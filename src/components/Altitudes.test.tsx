import { render, screen } from "../test-utils/test-utils";
import Altitudes from "./Altitudes";

describe("Altitudes (pure display)", () => {
  it("renders '-' for all PA/DA cells when nulls are passed", () => {
    render(
      <Altitudes
        altitudes={[null, null, null]}
        PAs={[null, null, null]}
        DAs={[null, null, null]}
      />
    );
    const dashes = screen.getAllByText("-");
    // 3 altitudes + 3 PAs + 3 DAs = 9 dashes
    expect(dashes.length).toBe(9);
  });

  it("renders the PA values rounded and locale-formatted", () => {
    render(
      <Altitudes
        altitudes={[4472, 10000, 4321]}
        PAs={[4500, 10500, 4400]}
        DAs={[6000, 13000, 5800]}
      />
    );
    expect(screen.getByText("4,500")).toBeInTheDocument();
    expect(screen.getByText("10,500")).toBeInTheDocument();
    expect(screen.getByText("4,400")).toBeInTheDocument();
    expect(screen.getByText("6,000")).toBeInTheDocument();
    expect(screen.getByText("13,000")).toBeInTheDocument();
    expect(screen.getByText("5,800")).toBeInTheDocument();
  });

  it("reflects new props on rerender without await/timers", () => {
    const { rerender } = render(
      <Altitudes
        altitudes={[1000, 8000, 1000]}
        PAs={[1000, 8000, 1000]}
        DAs={[1500, 9500, 1500]}
      />
    );
    expect(screen.getByText("9,500")).toBeInTheDocument();

    rerender(
      <Altitudes
        altitudes={[1000, 8000, 1000]}
        PAs={[1000, 8000, 1000]}
        DAs={[1500, 11000, 1500]}
      />
    );
    expect(screen.getByText("11,000")).toBeInTheDocument();
    expect(screen.queryByText("9,500")).not.toBeInTheDocument();
  });
});
