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
