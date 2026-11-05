import {
  computeClimbViewModel,
  computePressureColumns,
  computeTOLDViewModel,
  derivePerformanceNotifications,
  findAircraft,
  maneuveringNotifications,
} from "../derived";
import type { WorksheetData } from "../types";
import { fieldSubject, valueSubject } from "../notifications";

describe("computePressureColumns", () => {
  it("returns nulls for all columns when inputs are missing", () => {
    const { PAs, DAs } = computePressureColumns(
      [null, null, null],
      [null, null, null],
      [null, null, null]
    );
    expect(PAs).toEqual([null, null, null]);
    expect(DAs).toEqual([null, null, null]);
  });

  it("returns nulls when only altitude is provided (missing altimeter or temp)", () => {
    const { PAs, DAs } = computePressureColumns(
      [5000, null, null],
      [null, null, null],
      [null, null, null]
    );
    expect(PAs[0]).toBeNull();
    expect(DAs[0]).toBeNull();
  });

  it("computes PA = altitude when altimeter is standard 29.92", () => {
    const { PAs } = computePressureColumns(
      [5000, null, null],
      [29.92, null, null],
      [15, null, null]
    );
    expect(PAs[0]).toBeCloseTo(5000, 5);
  });

  it("computes PA = altitude + 1000 when altimeter is 28.92", () => {
    const { PAs } = computePressureColumns(
      [5000, null, null],
      [28.92, null, null],
      [15, null, null]
    );
    expect(PAs[0]).toBeCloseTo(6000, 5);
  });

  it("computes DA = PA at ISA temperature (PA = 0, temp = 15°C)", () => {
    const { DAs } = computePressureColumns(
      [0, null, null],
      [29.92, null, null],
      [15, null, null]
    );
    expect(DAs[0]).toBeCloseTo(0, 5);
  });

  it("treats the -1 sentinel as missing for altimeter and temperature", () => {
    const { PAs, DAs } = computePressureColumns(
      [5000, 10000, 5000],
      [-1, 29.92, 29.92],
      [15, -1, 15]
    );
    expect(PAs[0]).toBeNull(); // altimeter -1 → missing
    expect(DAs[0]).toBeNull();
    expect(PAs[1]).toBeNull(); // temp -1 → missing (matches legacy Altitudes.tsx behavior)
    expect(DAs[1]).toBeNull();
    expect(PAs[2]).toBeCloseTo(5000, 5);
  });

  it("treats -1 as missing for altitude as well (explicit, uniform behavior)", () => {
    const { PAs, DAs } = computePressureColumns(
      [-1, 5000, 5000],
      [29.92, 29.92, 29.92],
      [15, 15, 15]
    );
    expect(PAs[0]).toBeNull();
    expect(DAs[0]).toBeNull();
    expect(PAs[2]).toBeCloseTo(5000, 5);
  });

  it("handles all three columns independently", () => {
    const { PAs, DAs } = computePressureColumns(
      [1000, 8000, 2000],
      [29.92, 29.92, 29.92],
      [15, 0, 10]
    );
    expect(PAs[0]).toBeCloseTo(1000, 5);
    expect(PAs[1]).toBeCloseTo(8000, 5);
    expect(PAs[2]).toBeCloseTo(2000, 5);
    expect(DAs[0]).not.toBeNull();
    expect(DAs[1]).not.toBeNull();
    expect(DAs[2]).not.toBeNull();
  });
});

const baseState = (): WorksheetData => ({
  pilot: "",
  date: "2026-01-01",
  time: "10:00",
  duration: null,
  acType: "C182T",
  tailN: "",
  airport: ["KABC", "KXYZ"],
  route: "",
  position: [null, null],
  wind: [
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [20, 10, 20],
  altimeter: [29.92, 29.92, 29.92],
  altitude: [1000, 8000, 1000],
  rwy: [3000, 3000],
  weight: 2700,
  mtnEndorse: false,
  mtnCert: false,
});

const PAS_OK: [number, number, number] = [1000, 8000, 1000];

describe("computeTOLDViewModel", () => {
  it("computes departure values while arrival waits for its temperature", () => {
    const state = { ...baseState(), temp: [20, 10, null] as WorksheetData["temp"] };
    const vm = computeTOLDViewModel(state, [1000, 8000, null]);

    expect(vm.departure.values.takeoffGroundRoll).toEqual({
      status: "computed",
      value: expect.any(Number),
    });
    expect(vm.departure.values.landingGroundRoll.status).toBe("computed");
    expect(vm.departure.values.runwayRemaining50ft.status).toBe("computed");
    for (const v of Object.values(vm.arrival.values)) {
      expect(v).toEqual({ status: "withheld", reason: "needs arrival temperature" });
    }
  });

  it("puts one Warning on weight above max gross and withholds only weight-dependent values", () => {
    // C182T max gross is 3,100 lbs
    const vm = computeTOLDViewModel({ ...baseState(), weight: 3200 }, PAS_OK);

    expect(vm.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("weight"),
        message: "Weight 3,200 lbs exceeds the C182T maximum gross weight (3,100 lbs).",
      },
    ]);
    for (const slot of ["departure", "arrival"] as const) {
      const v = vm[slot].values;
      expect(v.takeoffGroundRoll).toEqual({ status: "withheld", reason: "needs valid weight" });
      expect(v.takeoff50ftObstacle).toEqual({ status: "withheld", reason: "needs valid weight" });
      expect(v.runwayRemaining50ft).toEqual({ status: "withheld", reason: "needs valid weight" });
      // Landing distances don't depend on weight (single-weight POH table).
      expect(v.landingGroundRoll.status).toBe("computed");
      expect(v.landing50ftObstacle.status).toBe("computed");
    }
  });

  it("puts a Warning on weight below empty weight", () => {
    const vm = computeTOLDViewModel({ ...baseState(), weight: 2000 }, PAS_OK);
    expect(vm.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("weight"),
        message: "Weight 2,000 lbs is below the C182T empty weight (2,300 lbs).",
      },
    ]);
  });

  it("shows an Advisory when weight is at 96% of max gross", () => {
    const vm = computeTOLDViewModel({ ...baseState(), weight: 2976 }, PAS_OK);
    expect(vm.notifications).toEqual([
      {
        level: "advisory",
        subject: fieldSubject("weight"),
        message: "Weight 2,976 lbs is 96% of the C182T maximum gross weight (3,100 lbs).",
      },
    ]);
    expect(vm.departure.values.takeoffGroundRoll.status).toBe("computed");
  });

  it("raises nothing about weight below 95% of max gross", () => {
    const vm = computeTOLDViewModel({ ...baseState(), weight: 2900 }, PAS_OK);
    expect(vm.notifications).toEqual([]);
  });

  it("asks for weight without a notification when weight is blank", () => {
    const vm = computeTOLDViewModel({ ...baseState(), weight: null }, PAS_OK);
    expect(vm.notifications).toEqual([]);
    expect(vm.departure.values.takeoffGroundRoll).toEqual({
      status: "withheld",
      reason: "needs weight",
    });
    expect(vm.arrival.values.landingGroundRoll.status).toBe("computed");
  });

  it("puts a Caution on arrival landing distances extrapolated beyond the landing table", () => {
    // POH landing table covers 0–8,000 ft PA; KXYZ is at 9,000 ft.
    const vm = computeTOLDViewModel(
      { ...baseState(), altitude: [1000, 10000, 9000] },
      [1000, 10000, 9000],
    );

    expect(vm.arrival.notifications).toContainEqual({
      level: "caution",
      subject: valueSubject("told.arrival.landing", "decision"),
      message:
        "Arrival (KXYZ) landing distances are extrapolated beyond the POH table: pressure altitude 9,000 ft is outside 0–8,000 ft.",
    });
    expect(vm.arrival.values.landingGroundRoll.status).toBe("computed");
    expect(vm.departure.notifications).toEqual([]);
  });

  it("puts a Caution on takeoff distances extrapolated beyond the takeoff table", () => {
    const vm = computeTOLDViewModel(
      { ...baseState(), temp: [45, 10, 20] },
      [1000, 8000, 1000],
    );
    expect(vm.departure.notifications).toContainEqual({
      level: "caution",
      subject: valueSubject("told.departure.takeoff", "decision"),
      message:
        "Departure (KABC) takeoff distances are extrapolated beyond the POH table: temperature 45°C is outside 0–40°C.",
    });
  });

  it("names each airport and phase once, with no duplicate notifications", () => {
    // Both airports at 9,000 ft and 45°C: both tables extrapolate on two axes.
    const vm = computeTOLDViewModel(
      { ...baseState(), altitude: [9000, 10000, 9000], temp: [45, 10, 45], weight: 3000 },
      [9000, 10000, 9000],
    );
    const messages = vm.notifications.map((n) => n.message);
    expect(new Set(messages).size).toBe(messages.length);
    const keys = vm.notifications.map((n) => JSON.stringify(n.subject));
    expect(new Set(keys).size).toBe(keys.length);
    expect(vm.notifications.filter((n) => n.level === "caution").map((n) => n.message)).toEqual([
      "Departure (KABC) takeoff distances are extrapolated beyond the POH table: pressure altitude 9,000 ft is outside 0–8,000 ft; temperature 45°C is outside 0–40°C.",
      "Departure (KABC) landing distances are extrapolated beyond the POH table: pressure altitude 9,000 ft is outside 0–8,000 ft; temperature 45°C is outside 0–40°C.",
      "Arrival (KXYZ) takeoff distances are extrapolated beyond the POH table: pressure altitude 9,000 ft is outside 0–8,000 ft; temperature 45°C is outside 0–40°C.",
      "Arrival (KXYZ) landing distances are extrapolated beyond the POH table: pressure altitude 9,000 ft is outside 0–8,000 ft; temperature 45°C is outside 0–40°C.",
    ]);
  });

  it("puts a Warning on an arrival temperature beyond the hard limit and withholds only arrival values", () => {
    const vm = computeTOLDViewModel({ ...baseState(), temp: [20, 10, 65] }, PAS_OK);
    expect(vm.arrival.notifications).toContainEqual({
      level: "warning",
      subject: fieldSubject("temp", 2),
      message: "Arrival (KXYZ) temperature 65°C is outside the -50 to 60°C the worksheet accepts.",
    });
    expect(vm.arrival.values.landingGroundRoll).toEqual({
      status: "withheld",
      reason: "needs valid arrival temperature",
    });
    expect(vm.departure.values.takeoffGroundRoll.status).toBe("computed");
  });

  it("waits for a blank runway length without a notification", () => {
    const vm = computeTOLDViewModel({ ...baseState(), rwy: [3000, null] }, PAS_OK);
    expect(vm.notifications).toEqual([]);
    expect(vm.arrival.values.runwayRemaining50ft).toEqual({
      status: "withheld",
      reason: "needs arrival runway length",
    });
    expect(vm.arrival.values.landingGroundRoll.status).toBe("computed");
    expect(vm.departure.values.runwayRemaining50ft.status).toBe("computed");
  });

  it("puts a Warning on a runway length that isn't positive", () => {
    const vm = computeTOLDViewModel({ ...baseState(), rwy: [0, 3000] }, PAS_OK);
    expect(vm.departure.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("rwy", 0),
        message: "Departure (KABC) runway length must be greater than 0 ft.",
      },
    ]);
    expect(vm.departure.values.runwayRemainingGroundRoll).toEqual({
      status: "withheld",
      reason: "needs valid departure runway length",
    });
  });

  it("shows an Advisory when an airport's pressure altitude is above 15,000 ft", () => {
    const vm = computeTOLDViewModel(
      { ...baseState(), altitude: [1000, 10000, 15200] },
      [1000, 10000, 15200],
    );
    expect(vm.arrival.notifications).toContainEqual({
      level: "advisory",
      subject: valueSubject("told.arrival", "decision"),
      message: "Arrival (KXYZ) pressure altitude 15,200 ft is above 15,000 ft.",
    });
  });

  it("does not raise generic reminders for high, short or extreme-temperature fields", () => {
    const vm = computeTOLDViewModel(
      {
        ...baseState(),
        altitude: [7000, 10000, 7000],
        temp: [-25, 10, 38],
        rwy: [1800, 2500],
      },
      [11000, 10000, 12000],
    );
    const text = vm.notifications.map((n) => n.message).join("\n");
    expect(text).not.toMatch(/careful performance planning/);
    expect(text).not.toMatch(/Short runway operations/);
    expect(text).not.toMatch(/Extreme temperature/);
    expect(vm.notifications.every((n) => n.level === "caution")).toBe(true);
  });

  it("puts a Warning on an aircraft type with no performance data", () => {
    const vm = computeTOLDViewModel({ ...baseState(), acType: "XYZ1" }, PAS_OK);
    expect(vm.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("acType"),
        message: "Aircraft type XYZ1 has no POH performance data.",
      },
    ]);
    expect(vm.departure.values.landingGroundRoll).toEqual({
      status: "withheld",
      reason: "needs a supported aircraft type",
    });
  });

  it("computes values at 0°C and sea level (falsy but valid)", () => {
    const vm = computeTOLDViewModel(
      { ...baseState(), altitude: [0, 8000, 0], temp: [0, 10, 0] },
      [0, 8000, 0],
    );
    for (const slot of ["departure", "arrival"] as const) {
      for (const v of Object.values(vm[slot].values)) {
        expect(v.status).toBe("computed");
      }
    }
  });

  it("names everything an airport is waiting for", () => {
    const vm = computeTOLDViewModel(
      { ...baseState(), altitude: [null, 8000, 1000], altimeter: [null, 29.92, 29.92] },
      [null, 8000, 1000],
    );
    expect(vm.departure.values.takeoffGroundRoll).toEqual({
      status: "withheld",
      reason: "needs departure field elevation and altimeter",
    });
  });
});

describe("computeClimbViewModel", () => {
  it("computes each column independently and shows what a column is waiting for", () => {
    const state = { ...baseState(), temp: [20, null, 20] as WorksheetData["temp"] };
    const vm = computeClimbViewModel(state);
    expect(vm.rateOfClimb[0]).toEqual({ status: "computed", value: expect.any(Number) });
    expect(vm.rateOfClimb[1]).toEqual({ status: "withheld", reason: "needs operating temperature" });
    expect(vm.serviceCeiling[1]).toEqual({ status: "withheld", reason: "needs operating temperature" });
    // Vx and Vy depend on pressure altitude only, not temperature.
    expect(vm.vx[1].status).toBe("computed");
    expect(vm.vy[1].status).toBe("computed");
    expect(vm.notifications).toEqual([]);
  });

  it("withholds weight-dependent values while weight has a Warning", () => {
    const vm = computeClimbViewModel({ ...baseState(), weight: 3200 });
    const needs = { status: "withheld", reason: "needs valid weight" };
    expect(vm.va).toEqual(needs);
    expect(vm.percentMGW).toEqual(needs);
    expect(vm.rateOfClimbActual[0]).toEqual(needs);
    expect(vm.rateOfClimb[0].status).toBe("computed");
  });

  it("puts a Caution on a rate of climb extrapolated beyond the climb table", () => {
    // C182T climb table tops out at 14,000 ft PA.
    const vm = computeClimbViewModel({ ...baseState(), altitude: [1000, 15000, 1000] });
    expect(vm.notifications).toContainEqual({
      level: "caution",
      subject: valueSubject("climb.rateOfClimb.operating", "decision"),
      message:
        "Operating altitude rate of climb is extrapolated beyond the POH climb table: pressure altitude 15,000 ft is outside 0–14,000 ft.",
    });
    expect(vm.rateOfClimb[1].status).toBe("computed");
  });

  it("puts a Caution on Vx extrapolated beyond the Vx table", () => {
    // C182T Vx table covers 0–10,000 ft.
    const vm = computeClimbViewModel({ ...baseState(), altitude: [1000, 12000, 1000] });
    expect(vm.notifications).toContainEqual({
      level: "caution",
      subject: valueSubject("climb.vx.operating", "decision"),
      message:
        "Operating altitude Vx is extrapolated beyond the POH Vx table: pressure altitude 12,000 ft is outside 0–10,000 ft.",
    });
  });

  it("puts a Caution on Va extrapolated beyond the maneuvering table (single-axis)", () => {
    // C172S Va table covers 1,900–2,550 lbs; empty weight is 1,663 lbs.
    const vm = computeClimbViewModel({ ...baseState(), acType: "C172S", weight: 1800 });
    expect(vm.va.status).toBe("computed");
    expect(vm.notifications).toContainEqual({
      level: "caution",
      subject: valueSubject("climb.va", "decision"),
      message:
        "Va is extrapolated beyond the POH maneuvering-speed table: weight 1,800 lbs is outside 1,900–2,550 lbs.",
    });
  });

  it("explains a rate of climb the POH table has no data for", () => {
    // C172S climb table has no entry at 12,000 ft / 40°C.
    const vm = computeClimbViewModel({
      ...baseState(),
      acType: "C172S",
      weight: 2400,
      altitude: [1000, 11000, 1000],
      temp: [20, 30, 20],
    });
    expect(vm.rateOfClimb[1]).toEqual({ status: "unavailable" });
    expect(vm.notifications).toContainEqual({
      level: "warning",
      subject: valueSubject("climb.rateOfClimb.operating", "decision"),
      message:
        "Operating altitude rate of climb could not be computed: the C172S POH climb table has no data for these conditions.",
    });
  });

  it("explains, once, that Vx is unavailable for an aircraft without Vx data", () => {
    const vm = computeClimbViewModel({ ...baseState(), acType: "C172S", weight: 2400 });
    expect(vm.vx.map((v) => v.status)).toEqual(["unavailable", "unavailable", "unavailable"]);
    expect(vm.notifications).toEqual([
      {
        level: "warning",
        subject: valueSubject("climb.vx", "decision"),
        message: "Vx is not available: the C172S POH data has no Vx table.",
      },
    ]);
  });

  it("puts a Warning on an operating temperature beyond the hard limit", () => {
    const vm = computeClimbViewModel({ ...baseState(), temp: [20, -60, 20] });
    expect(vm.notifications).toContainEqual({
      level: "warning",
      subject: fieldSubject("temp", 1),
      message: "Operating altitude temperature -60°C is outside the -50 to 60°C the worksheet accepts.",
    });
    expect(vm.rateOfClimb[1]).toEqual({
      status: "withheld",
      reason: "needs valid operating temperature",
    });
  });
});

describe("maneuveringNotifications", () => {
  const c182t = findAircraft("C182T")!;

  it("raises nothing for an aircraft with stall speeds for every flap setting", () => {
    expect(maneuveringNotifications(c182t)).toEqual([]);
  });

  it("puts a Warning on maneuvering speeds when stall speeds are missing", () => {
    const aircraft = { ...c182t, stallSpeeds: { flaps: [0, 30], Vso: [] } };
    expect(maneuveringNotifications(aircraft)).toEqual([
      {
        level: "warning",
        subject: valueSubject("maneuvering", "decision"),
        message:
          "Maneuvering speeds are not available: the C182T POH data has no stall speed for every flap setting.",
      },
    ]);
  });

  it("leaves an unknown aircraft to the aircraft-type Warning", () => {
    expect(maneuveringNotifications(undefined)).toEqual([]);
  });
});

describe("derivePerformanceNotifications", () => {
  it("returns TOLD and climb notifications together, each once", () => {
    const state = {
      ...baseState(),
      weight: 3200,
      temp: [20, -60, 20] as WorksheetData["temp"],
      altitude: [1000, 15000, 9000] as WorksheetData["altitude"],
    };
    const all = derivePerformanceNotifications(state);
    const weightWarnings = all.filter(
      (n) => n.subject.kind === "field" && n.subject.field === "weight",
    );
    expect(weightWarnings).toHaveLength(1);
    expect(all).toContainEqual(expect.objectContaining({ subject: fieldSubject("temp", 1) }));
    expect(all).toContainEqual(
      expect.objectContaining({ subject: valueSubject("told.arrival.landing", "decision") }),
    );
    const keys = all.map((n) => JSON.stringify(n));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is empty for a complete, in-range worksheet", () => {
    expect(derivePerformanceNotifications(baseState())).toEqual([]);
  });
});
