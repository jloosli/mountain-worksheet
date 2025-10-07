import { render, screen } from "../test-utils/test-utils";
import ManeuveringPerformance from "./ManeuveringPerformance";
import type { ManeuveringSpeeds } from "../utils/types";

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
    
    expect(screen.getByText("Maneuver/Canyon Turn Speed (kts) (C182T)")).toBeInTheDocument();
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
});
