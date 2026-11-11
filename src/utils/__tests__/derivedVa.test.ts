import { computeClimbViewModel } from "../derived";
import { valueSubject } from "../notifications";
import type { WorksheetData } from "../types";

// A hypothetical aircraft whose POH maneuvering-speed table has a blank entry.
jest.mock("@/data/aircraft.json", () => [
  {
    id: "NOVA",
    name: "Low climber",
    emptyWeight: 1500,
    maxGrossWeight: 2400,
    fuelCapacity: 40,
    fuelWeightPerGallon: 6,
    serviceCeiling: 8000,
    maneuvering: { weights: [1900, 2400], Va: [90, null] },
    stallSpeeds: { flaps: [0], Vso: [45] },
    climbPerformance: {
      pressureAltitudes: [0, 4000, 8000],
      climbSpeeds: [75, 74, 73],
      temperatures: [0, 40],
      data: [
        [600, 280],
        [450, 200],
        [300, 120],
      ],
    },
    shortFieldTakeoff: {
      weights: [2400],
      pressureAltitudes: [0, 8000],
      temperatures: [0, 40],
      data: [
        {
          groundRoll: [
            [800, 900],
            [1200, 1400],
          ],
          groundRoll50ft: [
            [1500, 1700],
            [2200, 2500],
          ],
        },
      ],
    },
  },
]);

const state: WorksheetData = {
  pilot: "",
  date: "2026-01-01",
  time: "10:00",
  duration: null,
  acType: "NOVA",
  tailN: "",
  airport: ["KABC", "KXYZ"],
  route: "",
  position: [null, null],
  wind: [[], [], []],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [40, 0, 0],
  altimeter: [29.92, 29.92, 29.92],
  altitude: [1000, 4000, 1000],
  rwy: [3000, 3000],
  weight: 2000,
  mtnEndorse: false,
  mtnCert: false,
};

describe("Va lookup failure", () => {
  it("shows Va as unavailable with a Warning instead of throwing", () => {
    const vm = computeClimbViewModel(state, []);
    expect(vm.va).toEqual({ status: "unavailable" });
    expect(vm.notifications).toContainEqual({
      level: "warning",
      subject: valueSubject("climb.va", "decision"),
      message:
        "Va could not be computed: the NOVA POH maneuvering-speed table has no data for 2,000 lbs.",
    });
  });
});
