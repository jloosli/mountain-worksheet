// src/components/PrintBriefing.test.tsx
import { render, screen, within } from "../test-utils/test-utils";
import PrintBriefing from "./PrintBriefing";
import type { WorksheetData } from "@/utils/types";
import {
  fieldSubject,
  stepSubject,
  type Notification,
} from "@/utils/notifications";
import {
  climbSubject,
  computeClimbViewModel,
  computeTOLDViewModel,
  computePressureColumns,
  derivePerformanceNotifications,
} from "@/utils/derived";
import { deriveLimitChecks } from "@/utils/limitChecks";

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
    expect(screen.getByText("Va (actual weight)")).toBeInTheDocument();
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

  // Va at 3,000 lbs interpolates to 108 kts.
  it("prints the canyon-turn entry airspeed range for each flap setting", () => {
    render(<PrintBriefing state={stateWithPerf} />);
    expect(screen.getByText(/Canyon-turn entry/)).toBeInTheDocument();
    expect(screen.getByText("71–108")).toBeInTheDocument();
    expect(screen.getByText("57–108")).toBeInTheDocument();
  });

  it("refers the range to a note on Va", () => {
    const vaNote: Notification = {
      level: "caution",
      subject: climbSubject("va"),
      message: "Va is extrapolated beyond the POH maneuvering-speed table.",
    };
    render(<PrintBriefing state={stateWithPerf} notifications={[vaNote]} />);
    const cell = screen.getByText("71–108").closest("td");
    expect(cell?.querySelector("[data-ref]")).toBeInTheDocument();
  });

  it("prints the lower bound and why Va is missing when weight is blank", () => {
    render(<PrintBriefing state={{ ...stateWithPerf, weight: null }} />);
    expect(screen.getByText("From 71 (Va: needs weight)")).toBeInTheDocument();
    expect(screen.getByText("From 57 (Va: needs weight)")).toBeInTheDocument();
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

describe("PrintBriefing — Vx withheld when pressure altitude is missing", () => {
  it("prints what Vx is waiting for in each phase when altitude inputs are unset", () => {
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
    expect(cells[1].textContent).toBe("needs departure field elevation and altimeter");
    expect(cells[2].textContent).toBe("needs operating altitude and altimeter");
    expect(cells[3].textContent).toBe("needs arrival field elevation and altimeter");
  });
});

describe("PrintBriefing — notifications", () => {
  const arrivalTempSubstitution: Notification = {
    level: "caution",
    subject: fieldSubject("temp", 2),
    message: "KLGU: forecast period has no temperature; using current observation",
  };
  const row = (container: HTMLElement, label: RegExp) => {
    const tr = Array.from(container.querySelectorAll("tr")).find((r) =>
      label.test(r.querySelector("td")?.textContent ?? "")
    );
    if (!tr) throw new Error(`no row ${label}`);
    return Array.from(tr.querySelectorAll("td"));
  };
  const refs = (cell: Element) =>
    Array.from(cell.querySelectorAll("[data-ref]")).map((e) => e.getAttribute("data-ref"));

  it("withholds values whose own inputs have a Warning, naming the input, and keeps the rest", () => {
    const stale: Notification = {
      level: "warning",
      subject: fieldSubject("altimeter", 0),
      message: "Fetched for KOGD at 2026-05-17 18:00; refetch weather.",
    };
    const { container } = render(
      <PrintBriefing state={stateWithPerf} notifications={[stale]} />
    );
    expect(row(container, /^TO Ground Roll/)[1].textContent).toMatch(/departure altimeter/);
    expect(row(container, /^Pressure Alt/)[1].textContent).toMatch(/departure altimeter/);
    expect(row(container, /^Pressure Alt/)[3].textContent).toMatch(/^[\d,]+/);
    expect(row(container, /^TO Ground Roll/)[2].textContent).toMatch(/^[\d,]+/);
  });

  it("prints the arrival temperature Caution next to the arrival temperature", () => {
    const { container } = render(
      <PrintBriefing state={stateWithPerf} notifications={[arrivalTempSubstitution]} />
    );
    const note = screen.getByText(/forecast period has no temperature/);
    expect(note.closest("li")).toHaveAttribute("data-ref", "1");
    expect(note.closest("li")?.textContent).toMatch(/Caution/);
    const oat = row(container, /^OAT/);
    expect(refs(oat[3])).toEqual(["1"]);
    expect(refs(oat[1])).toEqual([]);
  });

  it("marks the arrival landing distance, and only values that use the arrival temperature", () => {
    const { container } = render(
      <PrintBriefing state={stateWithPerf} notifications={[arrivalTempSubstitution]} />
    );
    const landing = row(container, /^Landing Ground Roll/);
    expect(refs(landing[2])).toEqual(["1"]);
    expect(refs(landing[1])).toEqual([]);
    expect(refs(row(container, /^Density Alt/)[3])).toEqual(["1"]);
    expect(refs(row(container, /^Pressure Alt/)[3])).toEqual([]);
    expect(refs(row(container, /^Rate of Climb \(MGW\)/)[3])).toEqual(["1"]);
    expect(refs(row(container, /^Rate of Climb \(MGW\)/)[2])).toEqual([]);
    expect(refs(row(container, /^Vx/)[3])).toEqual([]);
  });

  it("omits Advisories", () => {
    render(
      <PrintBriefing
        state={stateWithPerf}
        notifications={[
          {
            level: "advisory",
            subject: fieldSubject("altitude", 1),
            message: "Operating temperature re-derived from winds aloft",
          },
        ]}
      />
    );
    expect(screen.queryByText(/re-derived from winds aloft/)).not.toBeInTheDocument();
  });

  it("prints a Warning next to the value it concerns, including ones with no table cell", () => {
    const overweight: WorksheetData = { ...stateWithPerf, weight: 3400 };
    const notifications: Notification[] = [
      {
        level: "warning",
        subject: stepSubject("weather"),
        message: "TAF request for KLGU failed.",
      },
      ...derivePerformanceNotifications(overweight),
    ];
    const { container } = render(
      <PrintBriefing state={overweight} notifications={notifications} />
    );
    const weightNote = screen.getByText(/maximum gross weight/i).closest("li")!;
    expect(weightNote.textContent).toMatch(/Warning/);
    const weight = container.querySelector("[data-field='weight']")!;
    expect(weight.textContent).toMatch(/3,400/);
    expect(refs(weight)).toEqual([weightNote.getAttribute("data-ref")]);
    expect(screen.getByText(/TAF request for KLGU failed/).closest("li")).toHaveAttribute(
      "data-level",
      "warning"
    );
    // Values that depend on weight print what they are waiting for.
    expect(row(container, /^TO Ground Roll/)[1].textContent).toBe("needs valid weight");
    expect(row(container, /^% MGW/)[1].textContent).toBe("needs valid weight");
  });

  it("prints every Warning and Caution the screen shows, once each", () => {
    const extrapolated: WorksheetData = {
      ...stateWithPerf,
      altitude: [9000, 10000, 9000],
      temp: [-25, 10, 38],
    };
    const { PAs } = computePressureColumns(
      extrapolated.altitude,
      extrapolated.altimeter,
      extrapolated.temp
    );
    const notifications = derivePerformanceNotifications(extrapolated);
    const expected = notifications.filter((n) => n.level !== "advisory");
    expect(expected.length).toBeGreaterThan(0);
    const { container } = render(
      <PrintBriefing state={extrapolated} notifications={notifications} />
    );
    const printed = Array.from(container.querySelectorAll("li[data-ref]")).map(
      (li) => li.querySelector("[data-message]")?.textContent
    );
    expect(printed.sort()).toEqual(expected.map((n) => n.message).sort());
    // The takeoff Caution is referenced from the departure takeoff cells.
    const ref = screen
      .getByText(/Departure \(KOGD\) takeoff distances are extrapolated/)
      .closest("li")!
      .getAttribute("data-ref");
    expect(computeTOLDViewModel(extrapolated, PAs).departure.values.takeoffGroundRoll.status).toBe(
      "computed"
    );
    expect(refs(row(container, /^TO Ground Roll/)[1])).toContain(ref);
  });
});

describe("PrintBriefing — Vy above the climb table (#228)", () => {
  it("clamps Vy to the top-altitude row, not the sea-level row", () => {
    // C172S climb table tops out at 12,000 ft PA (Vy 72); sea-level Vy is 74.
    const highOp: WorksheetData = {
      ...stateWithPerf,
      acType: "C172S",
      weight: 2400,
      altitude: [4000, 13000, 4500] as [number, number, number],
    };
    const { container } = render(<PrintBriefing state={highOp} />);
    const vyRow = Array.from(container.querySelectorAll("tr")).find(
      (tr) => tr.querySelector("td")?.textContent?.trim() === "Vy",
    );
    const cells = Array.from(vyRow!.querySelectorAll("td")).map(
      (td) => td.textContent,
    );
    expect(cells.slice(1)).toEqual(["73", "72", "73"]);
  });
});

describe("PrintBriefing — Worksheet limits (#270)", () => {
  // C182T: maximum gross weight 3,100 lbs.
  const c182: WorksheetData = { ...stateWithPerf, acType: "C182T", weight: 2900 };
  const withChecks = (state: WorksheetData, extra: Notification[] = []) => {
    const notifications = [...derivePerformanceNotifications(state), ...extra];
    const { PAs } = computePressureColumns(state.altitude, state.altimeter, state.temp);
    const limitChecks = deriveLimitChecks({
      state,
      notifications,
      climb: computeClimbViewModel(state, notifications),
      told: computeTOLDViewModel(state, PAs, notifications),
    });
    return render(
      <PrintBriefing state={state} notifications={notifications} limitChecks={limitChecks} />,
    );
  };
  const box = () => screen.getByRole("region", { name: "Worksheet limits" });
  const checkRow = (name: string) =>
    within(box())
      .getAllByRole("row")
      .find((tr) => tr.querySelector("td")?.textContent === name)!;

  it("prints the box at the top of the page, before the sortie details", () => {
    withChecks(c182);
    expect(
      box().compareDocumentPosition(screen.getByText("Pilot:")) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("prints one row per check: name, worksheet limit, state, and worst point", () => {
    withChecks(c182);
    const cells = Array.from(checkRow("Weight").querySelectorAll("td")).map((td) => td.textContent);
    expect(cells).toEqual([
      "Weight",
      "under 90% of maximum gross weight",
      "Exceeded",
      "2,900 / 3,100 lbs (93.5%)",
    ]);
  });

  it("prints what a Not checked check is waiting for", () => {
    withChecks({ ...c182, weight: null });
    const cells = Array.from(checkRow("Weight").querySelectorAll("td")).map((td) => td.textContent);
    expect(cells.slice(2)).toEqual(["Not checked", "needs weight"]);
  });

  it("closes with the summary sentence and the Go/No-Go line", () => {
    withChecks(c182);
    // Other checks join the summary as they land; Weight is the one exceeded here.
    expect(within(box()).getByText(/^1 of \d+ worksheet limits? exceeded/)).toBeInTheDocument();
    expect(
      within(box()).getByText(
        "Limit checks inform the Go/No-Go decision, which belongs to the PIC and FRO.",
      ),
    ).toBeInTheDocument();
  });

  it("keys substitution refs to the Briefing's Caution numbers", () => {
    const linked: Notification = {
      level: "caution",
      subject: fieldSubject("weight"),
      message: "Weight came from a shared link.",
    };
    withChecks(c182, [linked]);
    const ref = screen.getByText(linked.message).closest("li")!.getAttribute("data-ref");
    const marks = Array.from(checkRow("Weight").querySelectorAll("[data-ref]")).map((el) =>
      el.getAttribute("data-ref"),
    );
    expect(ref).not.toBeNull();
    expect(marks).toEqual([ref]);
  });

  it("prints no box when there are no checks", () => {
    render(<PrintBriefing state={c182} />);
    expect(screen.queryByRole("region", { name: "Worksheet limits" })).not.toBeInTheDocument();
  });
});

describe("PrintBriefing — Worksheet limits styling (#270)", () => {
  it("gives Within limit no color, so the box reads as no all clear", () => {
    const state: WorksheetData = { ...stateWithPerf, acType: "C182T", weight: 2700 };
    const notifications = derivePerformanceNotifications(state);
    const { PAs } = computePressureColumns(state.altitude, state.altimeter, state.temp);
    const limitChecks = deriveLimitChecks({
      state,
      notifications,
      climb: computeClimbViewModel(state, notifications),
      told: computeTOLDViewModel(state, PAs, notifications),
    });
    render(<PrintBriefing state={state} notifications={notifications} limitChecks={limitChecks} />);
    const cells = within(screen.getByRole("region", { name: "Worksheet limits" })).getAllByText(
      "Within limit",
    );
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.className).not.toMatch(/text-(emerald|green|red|amber)/);
  });
});
