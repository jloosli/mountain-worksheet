import {
  computeClimbViewModel,
  computePressureColumns,
  computeTOLDViewModel,
  derivePerformanceNotifications,
  findAircraft,
  maneuveringNotifications,
  pressureColumnValue,
  toldValueSubjects,
  vyForPressureAltitude,
} from "../derived";
import type { WorksheetData } from "../types";
import { fieldSubject, valueSubject, type Notification } from "../notifications";

describe("computePressureColumns", () => {
  it("returns nulls for all columns when inputs are missing", () => {
    const { PAs, DAs } = computePressureColumns(
      [null, null, null],
      [null, null, null],
      [null, null, null],
    );
    expect(PAs).toEqual([null, null, null]);
    expect(DAs).toEqual([null, null, null]);
  });

  it("returns nulls when only altitude is provided (missing altimeter or temp)", () => {
    const { PAs, DAs } = computePressureColumns(
      [5000, null, null],
      [null, null, null],
      [null, null, null],
    );
    expect(PAs[0]).toBeNull();
    expect(DAs[0]).toBeNull();
  });

  it("computes PA = altitude when altimeter is standard 29.92", () => {
    const { PAs } = computePressureColumns(
      [5000, null, null],
      [29.92, null, null],
      [15, null, null],
    );
    expect(PAs[0]).toBeCloseTo(5000, 5);
  });

  it("computes PA = altitude + 1000 when altimeter is 28.92", () => {
    const { PAs } = computePressureColumns(
      [5000, null, null],
      [28.92, null, null],
      [15, null, null],
    );
    expect(PAs[0]).toBeCloseTo(6000, 5);
  });

  it("computes DA = PA at ISA temperature (PA = 0, temp = 15°C)", () => {
    const { DAs } = computePressureColumns([0, null, null], [29.92, null, null], [15, null, null]);
    expect(DAs[0]).toBeCloseTo(0, 5);
  });

  it("treats the -1 sentinel as missing for altimeter, but -1 °C as a real temperature", () => {
    const { PAs, DAs } = computePressureColumns([5000, 0, 5000], [-1, 29.92, 29.92], [15, -1, 15]);
    expect(PAs[0]).toBeNull(); // altimeter -1 → missing
    expect(DAs[0]).toBeNull();
    // -1 °C is a common mountain temperature, not a missing value.
    expect(PAs[1]).toBeCloseTo(0, 5);
    expect(DAs[1]).toBeLessThan(0); // 16 °C below ISA at sea level
    expect(PAs[2]).toBeCloseTo(5000, 5);
  });

  it("treats -1 as missing for altitude as well (explicit, uniform behavior)", () => {
    const { PAs, DAs } = computePressureColumns(
      [-1, 5000, 5000],
      [29.92, 29.92, 29.92],
      [15, 15, 15],
    );
    expect(PAs[0]).toBeNull();
    expect(DAs[0]).toBeNull();
    expect(PAs[2]).toBeCloseTo(5000, 5);
  });

  it("handles all three columns independently", () => {
    const { PAs, DAs } = computePressureColumns(
      [1000, 8000, 2000],
      [29.92, 29.92, 29.92],
      [15, 0, 10],
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
    const vm = computeTOLDViewModel(state, [1000, 8000, null], []);

    expect(vm.departure.values.takeoffGroundRoll).toEqual(
      expect.objectContaining({ status: "computed", value: expect.any(Number) }),
    );
    expect(vm.departure.values.landingGroundRoll.status).toBe("computed");
    expect(vm.departure.values.runwayRemaining50ft.status).toBe("computed");
    for (const v of Object.values(vm.arrival.values)) {
      expect(v).toEqual({ status: "withheld", reason: "needs arrival temperature" });
    }
  });

  it("puts one Warning on weight above max gross and withholds only weight-dependent values", () => {
    // C182T max gross is 3,100 lbs
    const vm = computeTOLDViewModel({ ...baseState(), weight: 3200 }, PAS_OK, []);

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
    const vm = computeTOLDViewModel({ ...baseState(), weight: 2000 }, PAS_OK, []);
    expect(vm.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("weight"),
        message: "Weight 2,000 lbs is below the C182T empty weight (2,300 lbs).",
      },
    ]);
  });

  // The 90% guideline is the Weight Limit check, not a notification (#243).
  it("raises nothing about weight near but within max gross", () => {
    const vm = computeTOLDViewModel({ ...baseState(), weight: 2976 }, PAS_OK, []);
    expect(vm.notifications).toEqual([]);
    expect(vm.departure.values.takeoffGroundRoll.status).toBe("computed");
  });

  it("asks for weight without a notification when weight is blank", () => {
    const vm = computeTOLDViewModel({ ...baseState(), weight: null }, PAS_OK, []);
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
      [],
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
    const vm = computeTOLDViewModel({ ...baseState(), temp: [45, 10, 20] }, [1000, 8000, 1000], []);
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
      { ...baseState(), altitude: [9000, 10000, 9000], temp: [45, 10, 45], weight: 2600 },
      [9000, 10000, 9000],
      [],
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
    const vm = computeTOLDViewModel({ ...baseState(), temp: [20, 10, 65] }, PAS_OK, []);
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
    const vm = computeTOLDViewModel({ ...baseState(), rwy: [3000, null] }, PAS_OK, []);
    expect(vm.notifications).toEqual([]);
    expect(vm.arrival.values.runwayRemaining50ft).toEqual({
      status: "withheld",
      reason: "needs arrival runway length",
    });
    expect(vm.arrival.values.landingGroundRoll.status).toBe("computed");
    expect(vm.departure.values.runwayRemaining50ft.status).toBe("computed");
  });

  it("puts a Warning on a runway length that isn't positive", () => {
    const vm = computeTOLDViewModel({ ...baseState(), rwy: [0, 3000] }, PAS_OK, []);
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
      [],
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
      [],
    );
    const text = vm.notifications.map((n) => n.message).join("\n");
    expect(text).not.toMatch(/careful performance planning/);
    expect(text).not.toMatch(/Short runway operations/);
    expect(text).not.toMatch(/Extreme temperature/);
    expect(vm.notifications.every((n) => n.level === "caution")).toBe(true);
  });

  it("puts a Warning on an aircraft type with no performance data", () => {
    const vm = computeTOLDViewModel({ ...baseState(), acType: "XYZ1" }, PAS_OK, []);
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

  it("puts a Caution on takeoff distances that averaged blank POH table entries", () => {
    // C182T 3,100 lb takeoff table is blank at 7,000 ft/40°C, 8,000 ft/30°C and 8,000 ft/40°C.
    const vm = computeTOLDViewModel(
      { ...baseState(), weight: 2900, altitude: [7500, 10000, 1000], temp: [35, 10, 20] },
      [7500, 10000, 1000],
      [],
    );
    expect(vm.departure.notifications).toEqual([
      {
        level: "caution",
        subject: valueSubject("told.departure.takeoff", "decision"),
        message:
          "Departure (KABC) takeoff distances fill 3 blank POH table entries near these conditions with the average of the neighbouring entries.",
      },
    ]);
    expect(vm.departure.values.takeoffGroundRoll.status).toBe("computed");
    expect(vm.arrival.notifications).toEqual([]);
  });

  it("computes values at 0°C and sea level (falsy but valid)", () => {
    const vm = computeTOLDViewModel(
      { ...baseState(), altitude: [0, 8000, 0], temp: [0, 10, 0] },
      [0, 8000, 0],
      [],
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
      [],
    );
    expect(vm.departure.values.takeoffGroundRoll).toEqual({
      status: "withheld",
      reason: "needs departure field elevation and altimeter",
    });
  });
});

describe("computeClimbViewModel", () => {
  it("clamps Vy above the climb table to the top row, with a Caution (#228)", () => {
    // C172S climb table tops out at 12,000 ft PA (Vy 72); sea-level Vy is 74.
    const state = {
      ...baseState(),
      acType: "C172S",
      weight: 2400,
      altimeter: [29.92, 29.92, 29.92] as WorksheetData["altimeter"],
      altitude: [4000, 13000, 4500] as WorksheetData["altitude"],
    };
    const vm = computeClimbViewModel(state, []);
    expect(vm.vy[1]).toEqual(expect.objectContaining({ status: "computed", value: 72 }));
    expect(vm.notifications).toContainEqual(
      expect.objectContaining({
        level: "caution",
        subject: expect.objectContaining({ id: "climb.vy.operating" }),
      }),
    );
  });

  it("computes each column independently and shows what a column is waiting for", () => {
    const state = { ...baseState(), temp: [20, null, 20] as WorksheetData["temp"] };
    const vm = computeClimbViewModel(state, []);
    expect(vm.rateOfClimb[0]).toEqual(
      expect.objectContaining({ status: "computed", value: expect.any(Number) }),
    );
    expect(vm.rateOfClimb[1]).toEqual({
      status: "withheld",
      reason: "needs operating temperature",
    });
    expect(vm.serviceCeiling[1]).toEqual({
      status: "withheld",
      reason: "needs operating temperature",
    });
    // Vx and Vy depend on pressure altitude only, not temperature.
    expect(vm.vx[1].status).toBe("computed");
    expect(vm.vy[1].status).toBe("computed");
    expect(vm.notifications).toEqual([]);
  });

  it("withholds weight-dependent values while weight has a Warning", () => {
    const vm = computeClimbViewModel({ ...baseState(), weight: 3200 }, []);
    const needs = { status: "withheld", reason: "needs valid weight" };
    expect(vm.va).toEqual(needs);
    expect(vm.percentMGW).toEqual(needs);
    expect(vm.rateOfClimbActual[0]).toEqual(needs);
    expect(vm.rateOfClimb[0].status).toBe("computed");
  });

  it("puts a Caution on a rate of climb extrapolated beyond the climb table", () => {
    // C182T climb table tops out at 14,000 ft PA.
    const vm = computeClimbViewModel({ ...baseState(), altitude: [1000, 15000, 1000] }, []);
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
    const vm = computeClimbViewModel({ ...baseState(), altitude: [1000, 12000, 1000] }, []);
    expect(vm.notifications).toContainEqual({
      level: "caution",
      subject: valueSubject("climb.vx.operating", "decision"),
      message:
        "Operating altitude Vx is extrapolated beyond the POH Vx table: pressure altitude 12,000 ft is outside 0–10,000 ft.",
    });
  });

  it("puts a Caution on a Vy whose pressure altitude is above the climb table", () => {
    // C182T climb-speed table tops out at 14,000 ft PA.
    const vm = computeClimbViewModel({ ...baseState(), altitude: [1000, 15000, 1000] }, []);
    expect(vm.vy[1].status).toBe("computed");
    expect(vm.notifications).toContainEqual({
      level: "caution",
      subject: valueSubject("climb.vy.operating", "decision"),
      message:
        "Operating altitude Vy is a POH climb-table entry, not a value for this altitude: pressure altitude 15,000 ft is outside 0–14,000 ft.",
    });
  });

  it("raises no Vy Caution within the climb table", () => {
    const vm = computeClimbViewModel({ ...baseState(), altitude: [1000, 14000, 1000] }, []);
    expect(
      vm.notifications.filter(
        (n) => n.subject.kind === "value" && n.subject.id.startsWith("climb.vy"),
      ),
    ).toEqual([]);
  });

  it("puts a Caution on Va extrapolated beyond the maneuvering table (single-axis)", () => {
    // C172S Va table covers 1,900–2,550 lbs; empty weight is 1,663 lbs.
    const vm = computeClimbViewModel({ ...baseState(), acType: "C172S", weight: 1800 }, []);
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
    const vm = computeClimbViewModel(
      {
        ...baseState(),
        acType: "C172S",
        weight: 2400,
        altitude: [1000, 11000, 1000],
        temp: [20, 30, 20],
      },
      [],
    );
    expect(vm.rateOfClimb[1]).toEqual({ status: "unavailable" });
    expect(vm.notifications).toContainEqual({
      level: "warning",
      subject: valueSubject("climb.rateOfClimb.operating", "decision"),
      message:
        "Operating altitude rate of climb could not be computed: the C172S POH climb table has no data for these conditions.",
    });
  });

  it("explains, once, that Vx is unavailable for an aircraft without Vx data", () => {
    // Every aircraft now has Vx data, so take the C172S's away for this test.
    const c172 = findAircraft("C172S")!;
    const vx = c172.Vx;
    delete c172.Vx;
    try {
      const vm = computeClimbViewModel({ ...baseState(), acType: "C172S", weight: 2400 }, []);
      expect(vm.vx.map((v) => v.status)).toEqual(["unavailable", "unavailable", "unavailable"]);
      expect(vm.notifications).toEqual([
        {
          level: "warning",
          subject: valueSubject("climb.vx", "decision"),
          message: "Vx is not available: the C172S POH data has no Vx table.",
        },
      ]);
    } finally {
      c172.Vx = vx;
    }
  });

  it("computes the C172S Vx from its POH speeds", () => {
    const vm = computeClimbViewModel({ ...baseState(), acType: "C172S", weight: 2400 }, []);
    expect(vm.vx.map((v) => v.status)).toEqual(["computed", "computed", "computed"]);
    expect(vm.notifications.some((n) => /Vx is not available/.test(n.message))).toBe(false);
  });

  it("puts a Warning on an operating temperature beyond the hard limit", () => {
    const vm = computeClimbViewModel({ ...baseState(), temp: [20, -60, 20] }, []);
    expect(vm.notifications).toContainEqual({
      level: "warning",
      subject: fieldSubject("temp", 1),
      message:
        "Operating altitude temperature -60°C is outside the -50 to 60°C the worksheet accepts.",
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

describe("dependsOn (value → input Subjects)", () => {
  const f = fieldSubject;

  it("lists each TOLD value's own inputs", () => {
    const vm = computeTOLDViewModel(baseState(), PAS_OK, []);
    const deps = (
      v: ReturnType<typeof computeTOLDViewModel>["departure"]["values"]["takeoffGroundRoll"],
    ) => (v.status === "computed" ? v.dependsOn : null);

    expect(deps(vm.departure.values.takeoffGroundRoll)).toEqual([
      f("acType"),
      f("weight"),
      f("altitude", 0),
      f("altimeter", 0),
      f("temp", 0),
    ]);
    // Landing distances don't use weight.
    expect(deps(vm.arrival.values.landing50ftObstacle)).toEqual([
      f("acType"),
      f("altitude", 2),
      f("altimeter", 2),
      f("temp", 2),
    ]);
    expect(deps(vm.arrival.values.runwayRemaining50ft)).toEqual([
      f("acType"),
      f("weight"),
      f("altitude", 2),
      f("altimeter", 2),
      f("temp", 2),
      f("rwy", 1),
    ]);
  });

  it("lists each climb value's own inputs", () => {
    const vm = computeClimbViewModel(baseState(), []);
    const deps = (v: { status: string; dependsOn?: unknown }) => v.dependsOn ?? null;

    expect(deps(vm.vx[1])).toEqual([f("acType"), f("altitude", 1), f("altimeter", 1)]);
    expect(deps(vm.rateOfClimbActual[2])).toEqual([
      f("acType"),
      f("weight"),
      f("altitude", 2),
      f("altimeter", 2),
      f("temp", 2),
    ]);
    expect(deps(vm.va)).toEqual([f("acType"), f("weight")]);
    expect(deps(vm.vra)).toEqual([f("acType")]);
    expect(deps(vm.serviceCeiling[0])).toEqual([f("acType"), f("altimeter", 0), f("temp", 0)]);
  });
});

describe("toldValueSubjects", () => {
  const told = (id: string) => valueSubject(id, "decision");

  it("ties a takeoff distance to its airport and the takeoff phase", () => {
    expect(toldValueSubjects("departure", "takeoff50ftObstacle")).toEqual([
      told("told.departure"),
      told("told.departure.takeoff"),
    ]);
  });

  it("ties a landing distance to its airport and the landing phase", () => {
    expect(toldValueSubjects("arrival", "landingGroundRoll")).toEqual([
      told("told.arrival"),
      told("told.arrival.landing"),
    ]);
  });

  it("ties runway remaining to both phases and the airport's runway", () => {
    expect(toldValueSubjects("arrival", "runwayRemaining50ft")).toEqual([
      told("told.arrival"),
      told("told.arrival.takeoff"),
      told("told.arrival.landing"),
      fieldSubject("rwy", 1),
    ]);
  });
});

describe("vyForPressureAltitude", () => {
  // C172-style table: 0..14000 ft, Vy 80 at sea level down to 72 at 14000.
  const climb = {
    pressureAltitudes: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000],
    climbSpeeds: [80, 79, 78, 77, 75, 74, 73, 72],
  };

  it("clamps to the top-altitude Vy when PA is above the table (#228)", () => {
    expect(vyForPressureAltitude(climb, 15500)).toBe(72);
  });

  it("uses the next row up for a PA between table rows", () => {
    expect(vyForPressureAltitude(climb, 5000)).toBe(77);
  });

  it("uses the exact row for a PA on a table altitude", () => {
    expect(vyForPressureAltitude(climb, 4000)).toBe(78);
  });

  it("returns the top row at exactly the top table altitude", () => {
    expect(vyForPressureAltitude(climb, 14000)).toBe(72);
  });

  it("returns the sea-level row for a PA below the table", () => {
    expect(vyForPressureAltitude(climb, -500)).toBe(80);
  });

  it("returns null when PA is unknown", () => {
    expect(vyForPressureAltitude(climb, null)).toBeNull();
  });
});

describe("withholding values whose own inputs have a Warning (#222)", () => {
  const warningOn = (field: Parameters<typeof fieldSubject>[0], index?: number): Notification => ({
    level: "warning",
    subject: fieldSubject(field, index),
    message: "Fetched for KABC at 2026-01-01 10:00; refetch weather.",
  });

  it("withholds only the TOLD values that use the Warned input, naming it", () => {
    const vm = computeTOLDViewModel(baseState(), PAS_OK, [warningOn("altimeter", 0)]);
    for (const value of Object.values(vm.departure.values)) {
      expect(value).toEqual({
        status: "withheld",
        reason: expect.stringMatching(/departure altimeter/),
      });
    }
    expect(vm.arrival.values.takeoffGroundRoll.status).toBe("computed");
  });

  it("ignores Cautions and Advisories on inputs", () => {
    const caution = { ...warningOn("altimeter", 0), level: "caution" as const };
    const vm = computeTOLDViewModel(baseState(), PAS_OK, [caution]);
    expect(vm.departure.values.takeoffGroundRoll.status).toBe("computed");
  });

  it("withholds weight-dependent values when weight is Warned, but not landing distances", () => {
    const vm = computeTOLDViewModel(baseState(), PAS_OK, [warningOn("weight")]);
    expect(vm.departure.values.takeoffGroundRoll).toEqual({
      status: "withheld",
      reason: expect.stringMatching(/weight/),
    });
    expect(vm.departure.values.landingGroundRoll.status).toBe("computed");
  });

  it("withholds climb values that use a Warned operating temperature, keeping those that don't", () => {
    const vm = computeClimbViewModel(baseState(), [warningOn("temp", 1)]);
    expect(vm.rateOfClimb[1]).toEqual({
      status: "withheld",
      reason: expect.stringMatching(/operating temperature/),
    });
    expect(vm.serviceCeiling[1].status).toBe("withheld");
    expect(vm.vx[1].status).toBe("computed");
    expect(vm.rateOfClimb[0].status).toBe("computed");
  });

  it("withholds a pressure or density altitude whose input is Warned", () => {
    const { PAs, DAs } = computePressureColumns(
      baseState().altitude,
      baseState().altimeter,
      baseState().temp,
    );
    const warned = [warningOn("temp", 2)];
    expect(pressureColumnValue(PAs, 2, "pressureAltitude", warned).status).toBe("computed");
    expect(pressureColumnValue(DAs, 2, "densityAltitude", warned)).toEqual({
      status: "withheld",
      reason: expect.stringMatching(/arrival temperature/),
    });
  });
});
