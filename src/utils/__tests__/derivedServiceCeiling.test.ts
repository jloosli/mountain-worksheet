import { computeClimbViewModel } from "../derived";
import { valueSubject } from "../notifications";
import type { WorksheetData } from "../types";

// A hypothetical aircraft whose climb rate is already below 300 fpm at sea
// level in hot air, so the service ceiling falls below the climb table.
jest.mock("@/data/aircraft.json", () => [
  {
    id: "LOWCLIMB",
    name: "Low climber",
    emptyWeight: 1500,
    maxGrossWeight: 2400,
    fuelCapacity: 40,
    fuelWeightPerGallon: 6,
    serviceCeiling: 8000,
    maneuvering: { weights: [1900, 2400], Va: [90, 100] },
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
      data: [{ groundRoll: [[800, 900], [1200, 1400]], groundRoll50ft: [[1500, 1700], [2200, 2500]] }],
    },
  },
]);

const state: WorksheetData = {
  pilot: "",
  date: "2026-01-01",
  time: "10:00",
  duration: null,
  acType: "LOWCLIMB",
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

describe("service ceiling extrapolation", () => {
  it("puts a Caution on a service ceiling below the climb table", () => {
    const vm = computeClimbViewModel(state);
    expect(vm.serviceCeiling[0]).toEqual(
      expect.objectContaining({ status: "computed", value: expect.any(Number) }),
    );
    expect(vm.notifications).toContainEqual({
      level: "caution",
      subject: valueSubject("climb.serviceCeiling.departure", "decision"),
      message:
        "Departure (KABC) service ceiling is extrapolated below the lowest altitude in the POH climb table at 40°C.",
    });
  });

  it("raises nothing for a ceiling inside the table", () => {
    const vm = computeClimbViewModel(state);
    expect(
      vm.notifications.filter((n) => n.subject.kind === "value" && n.subject.id.startsWith("climb.serviceCeiling.operating")),
    ).toEqual([]);
  });
});
