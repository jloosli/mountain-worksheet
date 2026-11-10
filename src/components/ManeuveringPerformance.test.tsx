import { render, screen } from "../test-utils/test-utils";
import ManeuveringPerformance from "./ManeuveringPerformance";
import type { ManeuveringSpeeds } from "../utils/types";
import {
  MANEUVERING_SUBJECT,
  climbSubject,
  computeCanyonTurnEntryRanges,
  type ComputedValue,
} from "../utils/derived";
import { fieldSubject } from "../utils/notifications";

describe("ManeuveringPerformance", () => {
  const mockManeuveringSpeeds: ManeuveringSpeeds = {
    flapSettings: [0, 30],
    speeds: [
      { flapSetting: 0, bankAngle: 0, speed: 51 },
      { flapSetting: 0, bankAngle: 45, speed: 61 },
      { flapSetting: 0, bankAngle: 60, speed: 71 },
      { flapSetting: 30, bankAngle: 0, speed: 41 },
      { flapSetting: 30, bankAngle: 45, speed: 49 },
      { flapSetting: 30, bankAngle: 60, speed: 57 },
    ],
  };

  it("renders without crashing when aircraft model is provided", () => {
    render(
      <ManeuveringPerformance
        aircraftModel="C182T"
        maneuveringSpeeds={mockManeuveringSpeeds}
      />
    );
    
    expect(screen.getByText("Minimum Maneuver/Canyon Turn Speed (kts) (C182T)")).toBeInTheDocument();
  });

  it("does not render when aircraft model is not provided", () => {
    const { container } = render(
      <ManeuveringPerformance
        aircraftModel=""
        maneuveringSpeeds={mockManeuveringSpeeds}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it("renders table with correct headers", () => {
    render(
      <ManeuveringPerformance
        aircraftModel="C182T"
        maneuveringSpeeds={mockManeuveringSpeeds}
      />
    );
    
    expect(screen.getByText("Bank Angles")).toBeInTheDocument();
    expect(screen.getAllByText("0°")).toHaveLength(2); // One in header, one in body
    expect(screen.getByText("45°")).toBeInTheDocument();
    expect(screen.getByText("60°")).toBeInTheDocument();
    expect(screen.getByText("Flaps")).toBeInTheDocument();
  });

  it("displays calculated speeds when maneuvering speeds are provided", () => {
    render(
      <ManeuveringPerformance
        aircraftModel="C182T"
        maneuveringSpeeds={mockManeuveringSpeeds}
      />
    );
    
    // Check for calculated speeds
    expect(screen.getByText("51")).toBeInTheDocument(); // 0° flaps, 0° bank
    expect(screen.getByText("61")).toBeInTheDocument(); // 0° flaps, 45° bank
    expect(screen.getByText("71")).toBeInTheDocument(); // 0° flaps, 60° bank
    expect(screen.getByText("41")).toBeInTheDocument(); // 30° flaps, 0° bank
    expect(screen.getByText("49")).toBeInTheDocument(); // 30° flaps, 45° bank
    expect(screen.getByText("57")).toBeInTheDocument(); // 30° flaps, 60° bank
  });

  it("displays TBD when maneuvering speeds are not provided", () => {
    render(
      <ManeuveringPerformance
        aircraftModel="C182T"
        maneuveringSpeeds={undefined}
      />
    );
    
    // Should show TBD for all cells
    const tbdElements = screen.getAllByText("TBD");
    expect(tbdElements).toHaveLength(6); // 2 flap settings × 3 bank angles
  });

  it("displays TBD when maneuvering speeds are null", () => {
    render(
      <ManeuveringPerformance
        aircraftModel="C182T"
        maneuveringSpeeds={null}
      />
    );
    
    // Should show TBD for all cells
    const tbdElements = screen.getAllByText("TBD");
    expect(tbdElements).toHaveLength(6); // 2 flap settings × 3 bank angles
  });

  it("renders correct flap settings from maneuvering speeds data", () => {
    render(
      <ManeuveringPerformance
        aircraftModel="C182T"
        maneuveringSpeeds={mockManeuveringSpeeds}
      />
    );
    
    expect(screen.getAllByText("0°")).toHaveLength(2); // One in header, one in body
    expect(screen.getByText("30°")).toBeInTheDocument();
  });

  it("handles different number of flap settings dynamically", () => {
    const customManeuveringSpeeds: ManeuveringSpeeds = {
      flapSettings: [0, 15, 30],
      speeds: [
        { flapSetting: 0, bankAngle: 0, speed: 51 },
        { flapSetting: 0, bankAngle: 45, speed: 61 },
        { flapSetting: 0, bankAngle: 60, speed: 71 },
        { flapSetting: 15, bankAngle: 0, speed: 46 },
        { flapSetting: 15, bankAngle: 45, speed: 55 },
        { flapSetting: 15, bankAngle: 60, speed: 64 },
        { flapSetting: 30, bankAngle: 0, speed: 41 },
        { flapSetting: 30, bankAngle: 45, speed: 49 },
        { flapSetting: 30, bankAngle: 60, speed: 57 },
      ],
    };

    render(
      <ManeuveringPerformance
        aircraftModel="C182T"
        maneuveringSpeeds={customManeuveringSpeeds}
      />
    );
    
    // Should show all three flap settings
    expect(screen.getAllByText("0°")).toHaveLength(2); // One in header, one in body
    expect(screen.getByText("15°")).toBeInTheDocument();
    expect(screen.getByText("30°")).toBeInTheDocument();
    
    // Should show calculated speeds for all combinations
    expect(screen.getByText("51")).toBeInTheDocument();
    expect(screen.getByText("46")).toBeInTheDocument();
    expect(screen.getByText("41")).toBeInTheDocument();
  });

  it("handles missing speed data gracefully", () => {
    const incompleteManeuveringSpeeds: ManeuveringSpeeds = {
      flapSettings: [0, 30],
      speeds: [
        { flapSetting: 0, bankAngle: 0, speed: 51 },
        { flapSetting: 0, bankAngle: 45, speed: 61 },
        // Missing other combinations
      ],
    };

    render(
      <ManeuveringPerformance
        aircraftModel="C182T"
        maneuveringSpeeds={incompleteManeuveringSpeeds}
      />
    );
    
    // Should show available speeds and TBD for missing ones
    expect(screen.getByText("51")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    
    const tbdElements = screen.getAllByText("TBD");
    expect(tbdElements.length).toBeGreaterThan(0);
  });

  it("shows why maneuvering speeds are unavailable", () => {
    render(
      <ManeuveringPerformance
        aircraftModel="C182T"
        maneuveringSpeeds={null}
        notifications={[
          {
            level: "warning",
            subject: MANEUVERING_SUBJECT,
            message: "Maneuvering speeds are not available: no stall speeds.",
          },
        ]}
      />
    );
    const warning = screen.getByText(/Maneuvering speeds are not available/);
    expect(warning.closest("li")).toHaveAttribute("data-level", "warning");
  });

  describe("canyon-turn entry airspeed (1.4 × Vso to Va)", () => {
    const va = (value: number): ComputedValue => ({
      status: "computed",
      value,
      dependsOn: [fieldSubject("weight")],
    });
    /** The last cell in the body row for a flap setting, e.g. "30°". */
    const entryCell = (flap: string) =>
      screen
        .getAllByText(flap)
        .find((el) => el.tagName === "TD")
        ?.closest("tr")?.lastElementChild;

    it("shows the range for each flap setting", () => {
      render(
        <ManeuveringPerformance
          aircraftModel="C182T"
          maneuveringSpeeds={mockManeuveringSpeeds}
          entryRanges={computeCanyonTurnEntryRanges(mockManeuveringSpeeds, va(101))}
        />
      );
      expect(screen.getByRole("columnheader", { name: /Canyon-turn entry/ })).toBeInTheDocument();
      expect(entryCell("0°")).toHaveTextContent("71–101");
      expect(entryCell("30°")).toHaveTextContent("57–101");
    });

    it("says there's no range instead of showing an inverted one", () => {
      render(
        <ManeuveringPerformance
          aircraftModel="C182T"
          maneuveringSpeeds={mockManeuveringSpeeds}
          entryRanges={computeCanyonTurnEntryRanges(mockManeuveringSpeeds, va(65))}
        />
      );
      expect(entryCell("0°")).toHaveTextContent("No range: Va (65) ≤ 1.4 × Vso (71)");
      expect(entryCell("0°")).not.toHaveTextContent("71–65");
      expect(entryCell("30°")).toHaveTextContent("57–65");
    });

    it("keeps the lower bound and says why Va is missing", () => {
      render(
        <ManeuveringPerformance
          aircraftModel="C182T"
          maneuveringSpeeds={mockManeuveringSpeeds}
          entryRanges={computeCanyonTurnEntryRanges(mockManeuveringSpeeds, {
            status: "withheld",
            reason: "needs weight",
          })}
        />
      );
      expect(entryCell("0°")).toHaveTextContent("From 71 (Va: needs weight)");
    });

    it("says Va is not available when it can't be computed", () => {
      render(
        <ManeuveringPerformance
          aircraftModel="C182T"
          maneuveringSpeeds={mockManeuveringSpeeds}
          entryRanges={computeCanyonTurnEntryRanges(mockManeuveringSpeeds, {
            status: "unavailable",
          })}
        />
      );
      expect(entryCell("0°")).toHaveTextContent("From 71 (Va not available)");
    });

    it("marks the range when Va or its weight carries a Caution", () => {
      render(
        <ManeuveringPerformance
          aircraftModel="C182T"
          maneuveringSpeeds={mockManeuveringSpeeds}
          entryRanges={computeCanyonTurnEntryRanges(mockManeuveringSpeeds, va(101))}
          inputNotifications={[
            {
              level: "caution",
              subject: climbSubject("va"),
              message: "Va is extrapolated beyond the POH maneuvering-speed table.",
            },
          ]}
        />
      );
      expect(entryCell("0°")?.querySelector('[data-marker="caution"]')).toBeInTheDocument();
    });
  });
});
