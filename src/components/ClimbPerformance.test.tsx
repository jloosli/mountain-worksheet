import { render, screen } from "../test-utils/test-utils";
import ClimbPerformance from "./ClimbPerformance";

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
      pressureAltitudes: [0, 2000, 4000],
      climbSpeeds: [80, 79, 78],
      temperatures: [-20, 0, 20],
      data: [
        [1055, 980, 905],
        [945, 875, 805],
        [840, 770, 705],
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

describe("ClimbPerformance Component", () => {
  const defaultProps = {
    aircraftModel: "C182T",
    weight: 2800,
    OATs: [15, 10, 5] as [number, number, number],
    PAs: [2000, 4000, 6000] as [number, number, number],
  };

  test("renders without crashing", () => {
    render(<ClimbPerformance {...defaultProps} />);
    expect(
      screen.getByText("Rates of Climb, V Speeds, Ceilings (C182T)")
    ).toBeInTheDocument();
  });

  test("displays Vra value correctly for valid aircraft", () => {
    render(<ClimbPerformance {...defaultProps} />);
    // Vra = 1.7 × 51 = 86.7, rounded to 87
    expect(screen.getByText("87")).toBeInTheDocument();
  });

  test("displays N/A for aircraft with missing Vso data", () => {
    render(<ClimbPerformance {...defaultProps} aircraftModel="INVALID" />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  test("displays N/A when no aircraft model is provided", () => {
    render(<ClimbPerformance {...defaultProps} aircraftModel={undefined} />);
    expect(
      screen.queryByText("Rates of Climb, V Speeds, Ceilings")
    ).not.toBeInTheDocument();
  });

  test("updates Vra value when aircraft model changes", () => {
    const { rerender } = render(<ClimbPerformance {...defaultProps} />);
    expect(screen.getByText("87")).toBeInTheDocument();

    rerender(<ClimbPerformance {...defaultProps} aircraftModel="INVALID" />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  test("Vra row appears after Va row in the table", () => {
    render(<ClimbPerformance {...defaultProps} />);

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
    render(<ClimbPerformance {...defaultProps} />);

    const vraRow = screen.getByText("Vra (Rough Air Speed)").closest("tr");
    const cells = vraRow?.querySelectorAll("td");

    expect(cells).toHaveLength(4); // Metric, Departure, Operating, Arrival
    expect(cells?.[1]).toHaveTextContent("87"); // Departure column
    expect(cells?.[2]).toHaveTextContent(""); // Operating column should be empty
    expect(cells?.[3]).toHaveTextContent(""); // Arrival column should be empty
  });

  test("Vra value has correct styling (right-aligned)", () => {
    render(<ClimbPerformance {...defaultProps} />);

    const vraRow = screen.getByText("Vra (Rough Air Speed)").closest("tr");
    const departureCell = vraRow?.querySelectorAll("td")[1];

    expect(departureCell).toHaveClass("text-right");
  });

  describe("Service Ceiling display", () => {
    const getServiceCeilingRow = () =>
      screen.getByText("Service Ceiling (300 ft/min ROC)").closest("tr");

    test("shows '-' for all columns when all OATs are null", () => {
      render(
        <ClimbPerformance
          {...defaultProps}
          OATs={[null, null, null] as unknown as [number, number, number]}
        />
      );
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1]).toHaveTextContent("-");
      expect(cells?.[2]).toHaveTextContent("-");
      expect(cells?.[3]).toHaveTextContent("-");
    });

    test("shows '-' only for operating column when operating OAT is null", () => {
      render(
        <ClimbPerformance
          {...defaultProps}
          OATs={[20, null, 20] as unknown as [number, number, number]}
        />
      );
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1].textContent).toMatch(/ft$/);
      expect(cells?.[2]).toHaveTextContent("-");
      expect(cells?.[3].textContent).toMatch(/ft$/);
    });

    test("shows computed ft values when all OATs are valid numbers", () => {
      render(<ClimbPerformance {...defaultProps} OATs={[20, 10, 5]} />);
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1].textContent).toMatch(/ft$/);
      expect(cells?.[2].textContent).toMatch(/ft$/);
      expect(cells?.[3].textContent).toMatch(/ft$/);
    });

    test("departure and arrival show the same ceiling for the same OAT", () => {
      render(<ClimbPerformance {...defaultProps} OATs={[20, null, 20] as unknown as [number, number, number]} />);
      const cells = getServiceCeilingRow()?.querySelectorAll("td");
      expect(cells?.[1].textContent).toBe(cells?.[3].textContent);
    });
  });
});
