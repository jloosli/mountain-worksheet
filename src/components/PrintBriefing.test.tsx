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
    expect(screen.getByText(/T182T/)).toBeInTheDocument();
    expect(screen.getByText(/N911CP/)).toBeInTheDocument();
    expect(screen.getByText(/2026-05-17/)).toBeInTheDocument();
    expect(screen.getByText(/18:00/)).toBeInTheDocument();
  });

  it("renders the route line with departure → arrival, area, and position", () => {
    render(<PrintBriefing state={fullState} />);
    expect(screen.getByText(/KOGD/)).toBeInTheDocument();
    expect(screen.getByText(/KLGU/)).toBeInTheDocument();
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
  it("renders a winds-aloft table with rows for 3k/6k/9k/12k/15k", () => {
    render(<PrintBriefing state={stateWithWeather} />);
    for (const altLabel of ["3,000", "6,000", "9,000", "12,000", "15,000"]) {
      expect(screen.getByText(altLabel)).toBeInTheDocument();
    }
  });

  it("renders wind direction, velocity, and temperature for each altitude", () => {
    render(<PrintBriefing state={stateWithWeather} />);
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
