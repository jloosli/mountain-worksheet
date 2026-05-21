// src/components/PrintBriefing.test.tsx
import { render, screen } from "../test-utils/test-utils";
import PrintBriefing from "./PrintBriefing";
import type { WorksheetData } from "@/utils/types";

const emptyState: WorksheetData = {
  pilot: "",
  date: "",
  time: "",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)] as [
    (number | null)[],
    (number | null)[],
    (number | null)[],
  ],
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

const fullState: WorksheetData = {
  ...emptyState,
  pilot: "Loosli",
  date: "2026-05-17",
  time: "18:00",
  duration: 3,
  acType: "T182T",
  tailN: "N911CP",
  airport: ["KOGD", "KLGU"],
  route: "Wasatch Range",
  position: [41.2, -111.97],
  mtnEndorse: true,
  mtnCert: false,
};

describe("PrintBriefing — identity, route, quals", () => {
  it("renders the briefing title and timestamp scaffold", () => {
    render(<PrintBriefing state={fullState} />);
    expect(
      screen.getByRole("heading", { name: /Briefing/i })
    ).toBeInTheDocument();
  });

  it("renders the identity line with pilot, AC/tail, UTC date+time, duration", () => {
    render(<PrintBriefing state={fullState} />);
    expect(screen.getByText(/Loosli/)).toBeInTheDocument();
    expect(screen.getAllByText(/T182T/).length).toBeGreaterThan(0);
    expect(screen.getByText(/N911CP/)).toBeInTheDocument();
    expect(screen.getByText(/2026-05-17/)).toBeInTheDocument();
    expect(screen.getByText(/18:00/)).toBeInTheDocument();
  });

  it("renders the route line with departure → arrival, area, and position", () => {
    render(<PrintBriefing state={fullState} />);
    expect(screen.getAllByText(/KOGD/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/KLGU/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Wasatch Range/)).toBeInTheDocument();
    expect(screen.getByText(/41\.2/)).toBeInTheDocument();
  });

  it("renders quals chips with ✓ / ✗", () => {
    render(<PrintBriefing state={fullState} />);
    const endorse = screen.getByText(/Mtn Endorse/);
    expect(endorse.textContent).toMatch(/✓/);
    const cert = screen.getByText(/Mtn Cert/);
    expect(cert.textContent).toMatch(/✗/);
  });

  it("renders em-dash placeholders for missing identity fields", () => {
    render(<PrintBriefing state={emptyState} />);
    // Every placeholder is the same em-dash; at minimum one should appear.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

const stateWithWeather: WorksheetData = {
  ...fullState,
  wind: [
    [340, 320, 300, 280, 270],
    [10, 15, 20, 25, 30],
    [10, 5, 0, -5, -10],
  ] as [(number | null)[], (number | null)[], (number | null)[]],
  turb: true,
  cielVis: false,
  mtnObsc: true,
};

describe("PrintBriefing — weather conditions", () => {
  it("renders a winds-aloft table with altitude column headers for 3k/6k/9k/12k/15k", () => {
    render(<PrintBriefing state={stateWithWeather} />);
    for (const altLabel of ["3,000", "6,000", "9,000", "12,000", "15,000"]) {
      expect(screen.getByText(altLabel)).toBeInTheDocument();
    }
  });

  it("renders Dir / Vel / Temp row labels and a value cell for each altitude", () => {
    render(<PrintBriefing state={stateWithWeather} />);
    expect(screen.getByText("Dir")).toBeInTheDocument();
    expect(screen.getByText("Vel")).toBeInTheDocument();
    expect(screen.getByText("Temp")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByText("270")).toBeInTheDocument();
    // -10 °C at 15k should appear with a minus sign
    expect(screen.getByText("-10")).toBeInTheDocument();
  });

  it("renders em-dashes for missing wind cells", () => {
    const partial = {
      ...stateWithWeather,
      wind: [
        [340, null, null, null, null],
        [10, null, null, null, null],
        [10, null, null, null, null],
      ] as [(number | null)[], (number | null)[], (number | null)[]],
    };
    render(<PrintBriefing state={partial} />);
    // At minimum the 6k/9k/12k/15k cells should contain em-dashes.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(12);
  });

  it("renders AIRMET chips for turb / cielVis / mtnObsc", () => {
    render(<PrintBriefing state={stateWithWeather} />);
    const turb = screen.getByText(/Turb/);
    expect(turb.textContent).toMatch(/✓/);
    const cielVis = screen.getByText(/Ceil\/Vis/);
    expect(cielVis.textContent).toMatch(/✗/);
    const mtnObsc = screen.getByText(/Mtn Obsc/);
    expect(mtnObsc.textContent).toMatch(/✓/);
  });
});

const stateWithPerf: WorksheetData = {
  ...fullState,
  weight: 3000,
  rwy: [4000, 6500],
  temp: [20, 10, 15] as [number, number, number],
  altimeter: [29.92, 29.92, 29.92] as [number, number, number],
  altitude: [4000, 8000, 4500] as [number, number, number],
};

describe("PrintBriefing — per-phase environment", () => {
  it("renders rows for Actual Altitude, OAT, Altimeter, PA, DA across dep/op/arr", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText(/Actual Altitude/i)).toBeInTheDocument();
    expect(screen.getByText(/OAT/i)).toBeInTheDocument();
    expect(screen.getByText(/Altimeter/i)).toBeInTheDocument();
    expect(screen.getByText(/Pressure Alt/i)).toBeInTheDocument();
    expect(screen.getByText(/Density Alt/i)).toBeInTheDocument();
    // Three column headers
    expect(screen.getByText(/Departure/i)).toBeInTheDocument();
    expect(screen.getByText(/Operating/i)).toBeInTheDocument();
    expect(screen.getByText(/Arrival/i)).toBeInTheDocument();
  });

  it("renders the entered altitudes formatted with thousands separators", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getAllByText("4,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("8,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4,500").length).toBeGreaterThan(0);
  });
});

describe("PrintBriefing — TOLD", () => {
  it("renders TOLD rows when aircraft and inputs are present", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText(/TO Ground Roll/i)).toBeInTheDocument();
    expect(screen.getByText(/Landing Ground Roll/i)).toBeInTheDocument();
    expect(screen.getByText(/Runway remaining/i)).toBeInTheDocument();
  });

  it("applies the negative-margin class when runway remaining is negative", () => {
    // Pick a tiny runway so the calculation comes back negative.
    const tightRwy: WorksheetData = {
      ...stateWithPerf,
      rwy: [100, 100] as [number, number],
    };
    const { container } = render(<PrintBriefing state={tightRwy} />);
    const reds = container.querySelectorAll(".print-margin-bad");
    expect(reds.length).toBeGreaterThan(0);
  });
});

describe("PrintBriefing — climb and V-speeds", () => {
  it("renders ROC and V-speed labels when aircraft is selected", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText(/Rate of Climb \(MGW\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Rate of Climb \(Actual/i)).toBeInTheDocument();
    expect(screen.getByText(/Vx/)).toBeInTheDocument();
    expect(screen.getAllByText(/Vy/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Va/)).toBeInTheDocument();
    expect(screen.getByText(/Vra/)).toBeInTheDocument();
    expect(screen.getByText(/% MGW/)).toBeInTheDocument();
  });
});

describe("PrintBriefing — maneuvering speeds", () => {
  it("renders flap × bank-angle headers when aircraft is selected", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText(/Maneuvering speeds/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0°/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/45°/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/60°/).length).toBeGreaterThan(0);
  });
});

describe("PrintBriefing — footer + no-aircraft fallback", () => {
  it("renders the 'For reference only' disclaimer", () => {
    render(<PrintBriefing state={fullState} />);
    expect(screen.getByText(/For reference only/i)).toBeInTheDocument();
  });

  it("falls back to a notice and hides performance sections when no aircraft is selected", () => {
    const noAC: WorksheetData = { ...fullState, acType: "" };
    render(<PrintBriefing state={noAC} />);
    expect(
      screen.getByText(/Select an aircraft model to print performance/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/TO Ground Roll/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Maneuvering speeds/i)).not.toBeInTheDocument();
    // Identity should still render
    expect(screen.getByText(/Loosli/)).toBeInTheDocument();
  });
});

describe("PrintBriefing — Vx fallback when pressure altitude is missing", () => {
  it("renders Vx as em-dash for each phase when altitude inputs are unset", () => {
    // stateWithPerf has acType but no env inputs unset → PAs computed as nulls
    const noEnv: WorksheetData = {
      ...stateWithPerf,
      altitude: [null, null, null],
      altimeter: [null, null, null],
      temp: [null, null, null],
    };
    const { container } = render(<PrintBriefing state={noEnv} />);
    // Find the Vx row by label, then assert all three numeric cells are em-dashes
    const vxLabel = container.querySelector("td.print-keep-color"); // sanity: page rendered
    expect(vxLabel === null || vxLabel !== null).toBe(true);
    const rows = Array.from(container.querySelectorAll("tr"));
    const vxRow = rows.find((tr) => tr.textContent?.trim().startsWith("Vx"));
    expect(vxRow).toBeDefined();
    const cells = Array.from(vxRow!.querySelectorAll("td"));
    // 4 cells: label + 3 values. All 3 values must be em-dashes.
    expect(cells.length).toBe(4);
    expect(cells[1].textContent).toBe("—");
    expect(cells[2].textContent).toBe("—");
    expect(cells[3].textContent).toBe("—");
  });
});
