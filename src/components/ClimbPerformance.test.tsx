import { render, screen } from "../test-utils/test-utils";
import ClimbPerformance from "./ClimbPerformance";
import { computeClimbViewModel } from "@/utils/derived";
import type { LimitState } from "@/utils/limitChecks";
import type { WorksheetData } from "@/utils/types";

// Mock the aircraft data
jest.mock("../data/aircraft.json", () => [
  {
    id: "C182T",
    name: "Cessna 182T",
    emptyWeight: 2300,
    maxGrossWeight: 3100,
    fuelCapacity: 88,
    fuelWeightPerGallon: 6,
    serviceCeiling: 14000,
    maneuvering: {
      weights: [2100, 2600, 3100],
      Va: [91, 101, 110],
    },
    stallSpeeds: {
      flaps: [0, 30],
      Vso: [51, 41],
    },
    climbPerformance: {
      pressureAltitudes: [0, 2000, 4000, 6000],
      climbSpeeds: [80, 79, 78, 77],
      temperatures: [-20, 0, 20],
      data: [
        [1055, 980, 905],
        [945, 875, 805],
        [840, 770, 705],
        [400, 350, 280], // drops below 300 fpm at 20°C; at -20°C still 400 fpm (exceeds table)
      ],
    },
    Vx: {
      speeds: [65, 68],
      altitudes: [0, 10000],
    },
    shortFieldTakeoff: {
      weights: [2300, 2700, 3100],
      pressureAltitudes: [0, 1000, 2000],
      temperatures: [0, 10, 20],
      data: [
        {
          groundRoll: [[365, 390, 420]],
          groundRoll50ft: [[705, 750, 800]],
        },
      ],
    },
  },
  {
    id: "INVALID",
    name: "Invalid Aircraft",
    emptyWeight: 2000,
    maxGrossWeight: 3000,
    fuelCapacity: 80,
    fuelWeightPerGallon: 6,
    serviceCeiling: 12000,
    maneuvering: {
      weights: [2000, 2500, 3000],
      Va: [85, 95, 105],
    },
    stallSpeeds: {
      flaps: [0, 30],
      Vso: [], // Empty Vso array to test error handling
    },
    climbPerformance: {
      pressureAltitudes: [0, 2000, 4000],
      climbSpeeds: [75, 74, 73],
      temperatures: [-20, 0, 20],
      data: [
        [900, 830, 760],
        [800, 730, 660],
        [700, 630, 560],
      ],
    },
    shortFieldTakeoff: {
      weights: [2000, 2500, 3000],
      pressureAltitudes: [0, 1000, 2000],
      temperatures: [0, 10, 20],
      data: [
        {
          groundRoll: [[300, 320, 340]],
          groundRoll50ft: [[600, 640, 680]],
        },
      ],
    },
  },
]);

type Triple = [number | null, number | null, number | null];

const baseState: WorksheetData = {
  pilot: "",
  date: "2026-01-01",
  time: "10:00",
  duration: null,
  acType: "C182T",
  tailN: "",
  airport: ["KABC", "KXYZ"],
  route: "",
  position: [null, null],
  wind: [[], [], []],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [15, 10, 5],
  altimeter: [29.92, 29.92, 29.92],
  altitude: [2000, 4000, 6000],
  rwy: [3000, 3000],
  weight: 2800,
  mtnEndorse: false,
  mtnCert: false,
};

function renderClimb(
  overrides: Partial<WorksheetData> = {},
  percentMGWState?: LimitState,
) {
  const state = { ...baseState, ...overrides };
  const ui = (s: WorksheetData) => (
    <ClimbPerformance
      aircraftModel={s.acType}
      climb={computeClimbViewModel(s)}
      OATs={s.temp}
      altimeters={s.altimeter}
      percentMGWState={percentMGWState}
    />
  );
  const result = render(ui(state));
  return {
    ...result,
    rerenderWith: (more: Partial<WorksheetData>) =>
      result.rerender(ui({ ...state, ...more })),
  };
}

describe("ClimbPerformance Component", () => {
  test("renders without crashing", () => {
    renderClimb();
    expect(
      screen.getByText("Rates of Climb, V Speeds, Ceilings (C182T)")
    ).toBeInTheDocument();
  });

  test("displays Vra value correctly for valid aircraft", () => {
    renderClimb();
    // Vra = 1.7 × 51 = 86.7, rounded to 87
    expect(screen.getByText("87")).toBeInTheDocument();
  });

  test("explains a missing Vra with a Warning instead of N/A", () => {
    renderClimb({ acType: "INVALID", weight: 2500 });
    const vraRow = screen.getByText("Vra (Rough Air Speed)").closest("tr");
    expect(vraRow?.querySelectorAll("td")[1]).toHaveTextContent("—");
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
    const warning = screen.getByText(
      "Vra is not available: the INVALID POH data has no clean stall speed."
    );
    expect(warning.closest("li")).toHaveAttribute("data-level", "warning");
  });

  test("renders nothing when no aircraft model is provided", () => {
    renderClimb({ acType: "" });
    expect(
      screen.queryByText(/Rates of Climb, V Speeds, Ceilings/)
    ).not.toBeInTheDocument();
  });

  test("updates Vra value when aircraft model changes", () => {
    const { rerenderWith } = renderClimb();
    expect(screen.getByText("87")).toBeInTheDocument();

    rerenderWith({ acType: "INVALID", weight: 2500 });
    expect(screen.queryByText("87")).not.toBeInTheDocument();
  });

  test("shows what a column is waiting for instead of '-'", () => {
    renderClimb({ temp: [15, null, 5] });
    const rocRow = screen.getByText("Rate of Climb (MGW)").closest("tr");
    expect(rocRow?.querySelectorAll("td")[2]).toHaveTextContent(
      "needs operating temperature"
    );
  });

  test("Vra row appears after Va row in the table", () => {
    renderClimb();

    const table = screen.getByRole("table");
    const rows = table.querySelectorAll("tbody tr");

    let vaRowIndex = -1;
    let vraRowIndex = -1;

    rows.forEach((row, index) => {
      const text = row.textContent || "";
      if (text.includes("Va at Actual Weight")) {
        vaRowIndex = index;
      }
      if (text.includes("Vra (Rough Air Speed)")) {
        vraRowIndex = index;
      }
    });

    expect(vaRowIndex).toBeGreaterThan(-1);
    expect(vraRowIndex).toBeGreaterThan(-1);
    expect(vraRowIndex).toBeGreaterThan(vaRowIndex);
  });

  test("Vra value is displayed only in departure column", () => {
    renderClimb();

    const vraRow = screen.getByText("Vra (Rough Air Speed)").closest("tr");
    const cells = vraRow?.querySelectorAll("td");

    expect(cells).toHaveLength(4); // Metric, Departure, Operating, Arrival
    expect(cells?.[1]).toHaveTextContent("87"); // Departure column
    expect(cells?.[2]).toHaveTextContent(""); // Operating column should be empty
    expect(cells?.[3]).toHaveTextContent(""); // Arrival column should be empty
  });

  test("Vra value has correct styling (right-aligned)", () => {
    renderClimb();

    const vraRow = screen.getByText("Vra (Rough Air Speed)").closest("tr");
    const departureCell = vraRow?.querySelectorAll("td")[1];

    expect(departureCell).toHaveClass("text-right");
  });

  describe("Service Ceiling display", () => {
    const getServiceCeilingRow = () =>
      screen.getByText(/Service Ceiling \(300 ft\/min ROC, MSL\)/).closest("tr");

    test("label reads 'Service Ceiling (300 ft/min ROC, MSL)'", () => {
      renderClimb();
      expect(screen.getByText("Service Ceiling (300 ft/min ROC, MSL)")).toBeInTheDocument();
    });

    test("shows what each column is waiting for when all OATs are null", () => {
      renderClimb({ temp: [null, null, null] });
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1]).toHaveTextContent("needs departure temperature");
      expect(cells?.[2]).toHaveTextContent("needs operating temperature");
      expect(cells?.[3]).toHaveTextContent("needs arrival temperature");
    });

    test("shows PA with '(PA)' suffix when altimeter is null", () => {
      renderClimb({ temp: [20, null, 20], altimeter: [null, null, null] });
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1].textContent).toMatch(/ft \(PA\)$/);
      expect(cells?.[3].textContent).toMatch(/ft \(PA\)$/);
    });

    test("shows MSL without '(PA)' suffix when altimeter is provided", () => {
      renderClimb({ temp: [20, null, 20], altimeter: [29.92, null, 29.92] });
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1].textContent).toMatch(/ft$/);
      expect(cells?.[1].textContent).not.toMatch(/\(PA\)/);
      expect(cells?.[3].textContent).toMatch(/ft$/);
      expect(cells?.[3].textContent).not.toMatch(/\(PA\)/);
    });

    test("MSL is 1000 ft higher than PA when altimeter is 30.92", () => {
      const { rerenderWith } = renderClimb({
        temp: [20, null, null],
        altimeter: [29.92, null, null],
      });
      const baseMSL = parseInt(
        getServiceCeilingRow()?.querySelectorAll("td")?.[1].textContent?.replace(/[^0-9]/g, "") ?? "0"
      );

      rerenderWith({ altimeter: [30.92, null, null] as Triple });
      const highMSL = parseInt(
        getServiceCeilingRow()?.querySelectorAll("td")?.[1].textContent?.replace(/[^0-9]/g, "") ?? "0"
      );

      expect(highMSL - baseMSL).toBe(1000);
    });

    test("cell has title attribute with Pressure Alt and Density Alt when value is computed", () => {
      renderClimb({ temp: [20, null, null], altimeter: [29.92, null, null] });
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      const title = cells?.[1].getAttribute("title") ?? "";
      expect(title).toMatch(/Pressure Alt:/);
      expect(title).toMatch(/Density Alt:/);
    });

    test("shows PA with '(PA)' suffix when altimeter is -1 sentinel", () => {
      renderClimb({ temp: [20, null, null], altimeter: [-1, null, null] });
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1].textContent).toMatch(/ft \(PA\)$/);
    });

    test("shows '> X ft' when 300 fpm ROC is never reached within the table", () => {
      // At -20°C the mock data tops out at 6,000 ft with 400 fpm — ceiling exceeds the table.
      // Display "> 6,000 ft" rather than an unreliable extrapolated altitude.
      renderClimb({ temp: [-20, -20, -20] });
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1].textContent).toBe("> 6,000 ft");
      expect(cells?.[2].textContent).toBe("> 6,000 ft");
      expect(cells?.[3].textContent).toBe("> 6,000 ft");
    });

    test("departure and arrival show the same MSL ceiling for the same OAT and altimeter", () => {
      renderClimb({ temp: [20, null, 20], altimeter: [29.92, null, 29.92] });
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1].textContent).toBe(cells?.[3].textContent);
    });
  });
});

describe("ClimbPerformance — Percent of MGW cell", () => {
  const percentCell = () =>
    screen.getByText("Percent of MGW").closest("tr")!.querySelectorAll("td")[1];

  test("has the Exceeded style when the Weight check's point is Exceeded", () => {
    renderClimb({ weight: 2790 }, "exceeded");
    expect(percentCell()).toHaveTextContent("90%");
    expect(percentCell().className).toMatch(/text-red/);
    expect(percentCell().className).not.toMatch(/yellow/);
  });

  test("has no style when the Weight check's point is Within limit", () => {
    renderClimb({ weight: 2787 }, "within");
    expect(percentCell().className).not.toMatch(/text-red|yellow/);
  });

  test("has no yellow style anywhere between 90% and 100%", () => {
    renderClimb({ weight: 3000 }, "exceeded");
    expect(percentCell().className).toMatch(/text-red/);
    expect(percentCell().className).not.toMatch(/yellow/);
  });

  test("shows the percentage text it is given instead of the rounded value", () => {
    render(
      <ClimbPerformance
        aircraftModel="C182T"
        climb={computeClimbViewModel({ ...baseState, weight: 2787 })}
        percentMGWText="89.9%"
        percentMGWState="within"
      />,
    );
    expect(percentCell()).toHaveTextContent(/^89\.9%$/);
  });

  test("above maximum gross shows the over-max-gross Warning's withheld marker", () => {
    renderClimb({ weight: 3255 }, "exceeded");
    expect(percentCell()).toHaveTextContent("needs valid weight");
  });
});
