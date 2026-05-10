import { render, screen, waitFor } from "../test-utils/test-utils";
import Calculations from "./Calculations";
import type { WorksheetData } from "../utils/types";

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
      pressureAltitudes: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000],
      climbSpeeds: [80, 79, 78, 77, 75, 74, 73, 72],
      temperatures: [-20, 0, 20, 40],
      data: [
        [1055, 980, 905, 835],
        [945, 875, 805, 735],
        [840, 770, 705, 635],
        [735, 670, 605, 535],
        [625, 560, 495, 430],
        [520, 455, 390, 330],
        [410, 350, 285, 225],
        [310, 250, 190, 130],
      ],
    },
    shortFieldTakeoff: {
      weights: [2300, 2700, 3100],
      pressureAltitudes: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
      temperatures: [0, 10, 20, 30, 40],
      data: [
        {
          groundRoll: [
            [365, 390, 420, 450, 480],
            [395, 425, 455, 490, 520],
            [430, 460, 495, 530, 565],
            [470, 505, 540, 580, 620],
            [510, 550, 590, 630, 675],
            [555, 600, 640, 690, 735],
            [610, 655, 700, 755, 805],
            [665, 715, 770, 825, 885],
            [730, 785, 845, 905, 970],
          ],
          groundRoll50ft: [
            [705, 750, 800, 850, 905],
            [765, 815, 870, 925, 985],
            [830, 885, 940, 1005, 1070],
            [900, 960, 1025, 1090, 1165],
            [980, 1045, 1115, 1190, 1270],
            [1065, 1140, 1220, 1305, 1390],
            [1165, 1250, 1335, 1430, 1530],
            [1275, 1370, 1470, 1570, 1685],
            [1405, 1510, 1620, 1735, 1865],
          ],
        },
        {
          groundRoll: [
            [520, 560, 600, 645, 690],
            [565, 610, 655, 700, 750],
            [615, 665, 710, 765, 820],
            [675, 725, 775, 835, 895],
            [735, 790, 850, 910, 975],
            [805, 865, 930, 1000, 1070],
            [880, 950, 1020, 1095, 1175],
            [965, 1040, 1120, 1200, 1290],
            [1060, 1145, 1230, 1320, 1420],
          ],
          groundRoll50ft: [
            [995, 1065, 1135, 1215, 1295],
            [1080, 1155, 1235, 1320, 1410],
            [1180, 1260, 1350, 1445, 1545],
            [1285, 1380, 1480, 1585, 1695],
            [1410, 1510, 1625, 1740, 1870],
            [1550, 1665, 1790, 1920, 2065],
            [1705, 1840, 1980, 2135, 2300],
            [1890, 2040, 2205, 2380, 2575],
            [2100, 2275, 2465, 2675, 2910],
          ],
        },
        {
          groundRoll: [
            [715, 765, 825, 885, 945],
            [775, 835, 900, 965, 1030],
            [850, 915, 980, 1055, 1130],
            [925, 995, 1070, 1150, 1235],
            [1015, 1090, 1175, 1260, 1355],
            [1110, 1195, 1290, 1385, 1485],
            [1220, 1315, 1415, 1520, 1635],
            [1340, 1445, 1560, 1675, null],
            [1480, 1595, 1720, null, null],
          ],
          groundRoll50ft: [
            [1365, 1460, 1570, 1680, 1800],
            [1490, 1600, 1720, 1845, 1980],
            [1635, 1760, 1890, 2035, 2190],
            [1800, 1940, 2090, 2255, 2435],
            [1990, 2150, 2325, 2515, 2720],
            [2210, 2395, 2595, 2820, 3070],
            [2470, 2690, 2930, 3200, 3510],
            [2785, 3045, 3345, 3685, null],
            [3175, 3500, 3880, null, null],
          ],
        },
      ],
    },
    shortFieldLanding: {
      weights: [2950],
      pressureAltitudes: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
      temperatures: [0, 10, 20, 30, 40],
      data: [
        {
          groundRoll: [
            [560, 580, 600, 620, 640],
            [580, 600, 620, 645, 665],
            [600, 625, 645, 670, 690],
            [625, 645, 670, 695, 715],
            [650, 670, 695, 720, 740],
            [670, 695, 720, 745, 770],
            [700, 725, 750, 775, 800],
            [725, 750, 780, 805, 830],
            [755, 780, 810, 835, 865],
          ],
          groundRoll50ft: [
            [1300, 1335, 1365, 1400, 1435],
            [1335, 1365, 1400, 1440, 1475],
            [1370, 1405, 1440, 1480, 1515],
            [1410, 1445, 1485, 1525, 1560],
            [1450, 1485, 1525, 1565, 1600],
            [1485, 1525, 1565, 1610, 1650],
            [1530, 1575, 1615, 1660, 1700],
            [1575, 1615, 1665, 1710, 1750],
            [1625, 1655, 1715, 1760, 1805],
          ],
        },
      ],
    },
  },
]);

describe("Calculations", () => {
  const mockWorksheetData: WorksheetData = {
    pilot: "Test Pilot",
    date: "2024-01-01",
    time: "10:00",
    duration: null,
    acType: "C182T",
    route: "",
    position: [null, null],
    tailN: "N12345",
    wind: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
    turb: false,
    cielVis: false,
    mtnObsc: false,
    airport: ["KABC", "KXYZ"],
    temp: [21, 21, 21],
    altimeter: [29.92, 29.92, 29.92],
    altitude: [8000, 8000, 8000],
    rwy: [1000, 1000],
    weight: 2800,
    mtnEndorse: true,
    mtnCert: true,
  };

  it("renders without crashing", () => {
    render(<Calculations state={mockWorksheetData} />);
    expect(screen.getByText("Calculations")).toBeInTheDocument();
  });

  it("renders ManeuveringPerformance component when aircraft model is provided", async () => {
    render(<Calculations state={mockWorksheetData} />);
    
    await waitFor(() => {
      expect(screen.getByText("Minimum Maneuver/Canyon Turn Speed (kts) (C182T)")).toBeInTheDocument();
    });
  });

  it("calculates maneuvering speeds correctly for C182T", async () => {
    render(<Calculations state={mockWorksheetData} />);
    
    await waitFor(() => {
      // Check for calculated speeds based on C182T data: flaps [0,30], Vso [51,41]
      // 0° bank = Vso, 45° bank = 1.2×Vso, 60° bank = 1.4×Vso
      expect(screen.getByText("51")).toBeInTheDocument(); // 0° flaps, 0° bank
      expect(screen.getByText("61")).toBeInTheDocument(); // 0° flaps, 45° bank (51 * 1.2 = 61.2 ≈ 61)
      expect(screen.getByText("71")).toBeInTheDocument(); // 0° flaps, 60° bank (51 * 1.4 = 71.4 ≈ 71)
      expect(screen.getByText("41")).toBeInTheDocument(); // 30° flaps, 0° bank
      expect(screen.getByText("49")).toBeInTheDocument(); // 30° flaps, 45° bank (41 * 1.2 = 49.2 ≈ 49)
      expect(screen.getByText("57")).toBeInTheDocument(); // 30° flaps, 60° bank (41 * 1.4 = 57.4 ≈ 57)
    });
  });

  it("handles missing aircraft model gracefully", () => {
    const stateWithoutAircraft: WorksheetData = {
      ...mockWorksheetData,
      acType: "",
    };
    
    render(<Calculations state={stateWithoutAircraft} />);
    
    // Should not render ManeuveringPerformance component
    expect(screen.queryByText("Maneuver/Canyon Turn Speed")).not.toBeInTheDocument();
  });

  it("handles unknown aircraft model gracefully", () => {
    const stateWithUnknownAircraft: WorksheetData = {
      ...mockWorksheetData,
      acType: "UNKNOWN",
    };
    
    render(<Calculations state={stateWithUnknownAircraft} />);
    
    // Should render ManeuveringPerformance but with TBD values
    expect(screen.getByText("Minimum Maneuver/Canyon Turn Speed (kts) (UNKNOWN)")).toBeInTheDocument();
    
    // Should show TBD for all cells since aircraft not found
    const tbdElements = screen.getAllByText("TBD");
    expect(tbdElements.length).toBeGreaterThan(0);
  });

  it("recalculates maneuvering speeds when aircraft model changes", async () => {
    const { rerender } = render(<Calculations state={mockWorksheetData} />);

    // Initially should show C182T speeds
    await waitFor(() => {
      expect(screen.getByText("51")).toBeInTheDocument();
    });

    // Change aircraft model to unknown
    const updatedState: WorksheetData = {
      ...mockWorksheetData,
      acType: "UNKNOWN",
    };

    rerender(<Calculations state={updatedState} />);

    // Should now show TBD values
    await waitFor(() => {
      const tbdElements = screen.getAllByText("TBD");
      expect(tbdElements.length).toBeGreaterThan(0);
    });
  });

  it("shows TOLD distance values (not TBD) when temperature is 0°C", async () => {
    // Regression test for bug: !state.temp[0] was falsy when temp = 0
    const stateWithZeroTemp: WorksheetData = {
      ...mockWorksheetData,
      temp: [0, 0, 0], // 0°C is a valid temperature, but was treated as falsy
      altitude: [500, 5000, 500],
      altimeter: [29.92, 29.92, 29.92],
      rwy: [3000, 3000],
    };
    render(<Calculations state={stateWithZeroTemp} />);
    await waitFor(() => {
      // TOLD table should contain numeric distances, not only TBD
      const numericCells = screen.queryAllByText(/^\d{3,}(,\d{3})*$/);
      expect(numericCells.length).toBeGreaterThan(0);
    });
  });

  it("shows TOLD distance values when airports are at sea level (pressure altitude ~0 ft)", async () => {
    // Regression test for bug: PAs.every((pa) => pa === 0) skipped calculation
    const stateAtSeaLevel: WorksheetData = {
      ...mockWorksheetData,
      altitude: [100, 5000, 100], // Near sea level — PA will be close to 0
      altimeter: [29.92, 29.92, 29.92],
      temp: [20, 20, 20],
      rwy: [3000, 3000],
    };
    render(<Calculations state={stateAtSeaLevel} />);
    await waitFor(() => {
      const numericCells = screen.queryAllByText(/^\d{3,}(,\d{3})*$/);
      expect(numericCells.length).toBeGreaterThan(0);
    });
  });
});
