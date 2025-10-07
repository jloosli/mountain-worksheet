import { calculateManeuveringSpeeds, getManeuveringSpeed } from "../maneuveringCalculations";
import type { ManeuveringSpeeds } from "../types";

// Mock the aircraft data
jest.mock("../../data/aircraft.json", () => [
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
      ],
    },
  },
  {
    id: "C172N",
    name: "Cessna 172N",
    emptyWeight: 1600,
    maxGrossWeight: 2400,
    fuelCapacity: 56,
    fuelWeightPerGallon: 6,
    serviceCeiling: 14000,
    maneuvering: {
      weights: [1600, 2000, 2400],
      Va: [97, 108, 118],
    },
    stallSpeeds: {
      flaps: [0, 10, 20, 30],
      Vso: [48, 44, 40, 36],
    },
    climbPerformance: {
      pressureAltitudes: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000],
      climbSpeeds: [70, 69, 68, 67, 65, 64, 63, 62],
      temperatures: [-20, 0, 20, 40],
      data: [
        [800, 740, 680, 620],
        [720, 665, 610, 555],
        [645, 595, 545, 495],
        [575, 530, 485, 440],
        [510, 470, 430, 390],
        [450, 415, 380, 345],
        [395, 365, 335, 305],
        [345, 320, 295, 270],
      ],
    },
    shortFieldTakeoff: {
      weights: [1600, 2000, 2400],
      pressureAltitudes: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
      temperatures: [0, 10, 20, 30, 40],
      data: [
        {
          groundRoll: [
            [300, 320, 340, 360, 380],
            [325, 350, 375, 400, 425],
            [355, 385, 415, 445, 475],
            [390, 425, 460, 495, 530],
            [430, 470, 510, 550, 590],
            [475, 520, 565, 610, 655],
            [525, 575, 625, 675, 725],
            [580, 635, 690, 745, 800],
            [640, 700, 760, 820, 880],
          ],
          groundRoll50ft: [
            [600, 640, 680, 720, 760],
            [650, 700, 750, 800, 850],
            [710, 770, 830, 890, 950],
            [780, 850, 920, 990, 1060],
            [860, 940, 1020, 1100, 1180],
            [950, 1040, 1130, 1220, 1310],
            [1050, 1150, 1250, 1350, 1450],
            [1160, 1270, 1380, 1490, 1600],
            [1280, 1400, 1520, 1640, 1760],
          ],
        },
      ],
    },
  },
]);

describe("maneuveringCalculations", () => {
  describe("calculateManeuveringSpeeds", () => {
    it("returns null for empty aircraft model", () => {
      expect(calculateManeuveringSpeeds("")).toBeNull();
    });

    it("returns null for unknown aircraft model", () => {
      expect(calculateManeuveringSpeeds("UNKNOWN")).toBeNull();
    });

    it("calculates speeds correctly for C182T", () => {
      const result = calculateManeuveringSpeeds("C182T");
      
      expect(result).not.toBeNull();
      expect(result!.flapSettings).toEqual([0, 30]);
      expect(result!.speeds).toHaveLength(6); // 2 flap settings × 3 bank angles
      
      // Check specific calculations for C182T: flaps [0,30], Vso [51,41]
      // 0° bank = Vso, 45° bank = 1.2×Vso, 60° bank = 1.4×Vso
      expect(result!.speeds).toContainEqual({ flapSetting: 0, bankAngle: 0, speed: 51 });
      expect(result!.speeds).toContainEqual({ flapSetting: 0, bankAngle: 45, speed: 61 }); // 51 * 1.2 = 61.2 ≈ 61
      expect(result!.speeds).toContainEqual({ flapSetting: 0, bankAngle: 60, speed: 71 }); // 51 * 1.4 = 71.4 ≈ 71
      expect(result!.speeds).toContainEqual({ flapSetting: 30, bankAngle: 0, speed: 41 });
      expect(result!.speeds).toContainEqual({ flapSetting: 30, bankAngle: 45, speed: 49 }); // 41 * 1.2 = 49.2 ≈ 49
      expect(result!.speeds).toContainEqual({ flapSetting: 30, bankAngle: 60, speed: 57 }); // 41 * 1.4 = 57.4 ≈ 57
    });

    it("calculates speeds correctly for C172N with multiple flap settings", () => {
      const result = calculateManeuveringSpeeds("C172N");
      
      expect(result).not.toBeNull();
      expect(result!.flapSettings).toEqual([0, 10, 20, 30]);
      expect(result!.speeds).toHaveLength(12); // 4 flap settings × 3 bank angles
      
      // Check specific calculations for C172N: flaps [0,10,20,30], Vso [48,44,40,36]
      expect(result!.speeds).toContainEqual({ flapSetting: 0, bankAngle: 0, speed: 48 });
      expect(result!.speeds).toContainEqual({ flapSetting: 0, bankAngle: 45, speed: 58 }); // 48 * 1.2 = 57.6 ≈ 58
      expect(result!.speeds).toContainEqual({ flapSetting: 0, bankAngle: 60, speed: 67 }); // 48 * 1.4 = 67.2 ≈ 67
      expect(result!.speeds).toContainEqual({ flapSetting: 30, bankAngle: 0, speed: 36 });
      expect(result!.speeds).toContainEqual({ flapSetting: 30, bankAngle: 45, speed: 43 }); // 36 * 1.2 = 43.2 ≈ 43
      expect(result!.speeds).toContainEqual({ flapSetting: 30, bankAngle: 60, speed: 50 }); // 36 * 1.4 = 50.4 ≈ 50
    });

    it("handles aircraft without stall speeds data", () => {
      // Mock aircraft without stall speeds
      jest.doMock("../../data/aircraft.json", () => [
        {
          id: "NO_STALL_DATA",
          name: "Aircraft Without Stall Data",
          emptyWeight: 1000,
          maxGrossWeight: 1500,
          fuelCapacity: 30,
          fuelWeightPerGallon: 6,
          serviceCeiling: 10000,
          maneuvering: { weights: [1000], Va: [80] },
          // No stallSpeeds property
          climbPerformance: {
            pressureAltitudes: [0],
            climbSpeeds: [70],
            temperatures: [0],
            data: [[500]],
          },
          shortFieldTakeoff: {
            weights: [1000],
            pressureAltitudes: [0],
            temperatures: [0],
            data: [{ groundRoll: [[200]], groundRoll50ft: [[400]] }],
          },
        },
      ]);

      expect(calculateManeuveringSpeeds("NO_STALL_DATA")).toBeNull();
    });
  });

  describe("getManeuveringSpeed", () => {
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

    it("returns null for null maneuvering speeds", () => {
      expect(getManeuveringSpeed(null, 0, 0)).toBeNull();
    });

    it("returns correct speed for valid flap setting and bank angle", () => {
      expect(getManeuveringSpeed(mockManeuveringSpeeds, 0, 0)).toBe(51);
      expect(getManeuveringSpeed(mockManeuveringSpeeds, 0, 45)).toBe(61);
      expect(getManeuveringSpeed(mockManeuveringSpeeds, 0, 60)).toBe(71);
      expect(getManeuveringSpeed(mockManeuveringSpeeds, 30, 0)).toBe(41);
      expect(getManeuveringSpeed(mockManeuveringSpeeds, 30, 45)).toBe(49);
      expect(getManeuveringSpeed(mockManeuveringSpeeds, 30, 60)).toBe(57);
    });

    it("returns null for invalid flap setting", () => {
      expect(getManeuveringSpeed(mockManeuveringSpeeds, 15, 0)).toBeNull();
    });

    it("returns null for invalid bank angle", () => {
      expect(getManeuveringSpeed(mockManeuveringSpeeds, 0, 30)).toBeNull();
    });

    it("returns null for combination that doesn't exist", () => {
      expect(getManeuveringSpeed(mockManeuveringSpeeds, 15, 30)).toBeNull();
    });
  });
});
