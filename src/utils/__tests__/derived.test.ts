import { computePressureColumns, computeTOLDViewModel } from "../derived";
import type { WorksheetData } from "../types";

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

describe("computeTOLDViewModel", () => {
  it("returns status 'invalid_inputs' and null results when acType is empty", () => {
    const vm = computeTOLDViewModel(
      { ...baseState(), acType: "" },
      [1000, 8000, 1000]
    );
    expect(vm.results).toBeNull();
    expect(vm.status).toBe("invalid_inputs");
    expect(vm.errors).toEqual([]);
  });

  it("returns status 'invalid_inputs' and null results when weight is null", () => {
    const vm = computeTOLDViewModel(
      { ...baseState(), weight: null },
      [1000, 8000, 1000]
    );
    expect(vm.results).toBeNull();
    expect(vm.status).toBe("invalid_inputs");
  });

  it("returns null results when neither departure nor arrival has PA+temp", () => {
    const vm = computeTOLDViewModel(baseState(), [null, null, null]);
    expect(vm.results).toBeNull();
    expect(vm.status).toBe("invalid_inputs");
  });

  it("returns success with a populated results shape when inputs are valid", () => {
    const vm = computeTOLDViewModel(baseState(), [1000, 8000, 1000]);
    expect(vm.status).toBe("success");
    expect(vm.results).not.toBeNull();
    expect(vm.results!.takeoffGroundRoll).toHaveProperty("departure");
    expect(vm.results!.takeoffGroundRoll).toHaveProperty("arrival");
    expect(vm.results!.takeoff50ftObstacle).toHaveProperty("departure");
    expect(vm.results!.landingGroundRoll).toHaveProperty("departure");
    expect(vm.results!.landing50ftObstacle).toHaveProperty("departure");
    expect(vm.results!.availableRunwayRemainingTakeoffGroundRoll).toHaveProperty("departure");
    expect(vm.results!.availableRunwayRemainingTakeoff50ft).toHaveProperty("departure");
  });

  it("does not expose retry/clear/isCalculating fields", () => {
    const vm = computeTOLDViewModel(baseState(), [1000, 8000, 1000]);
    expect(vm).not.toHaveProperty("isCalculating");
    expect(vm).not.toHaveProperty("retryCalculation");
    expect(vm).not.toHaveProperty("clearErrors");
  });

  it("populates errorSummary as null when there are no errors", () => {
    const vm = computeTOLDViewModel(baseState(), [1000, 8000, 1000]);
    expect(vm.errorSummary).toBeNull();
  });

  it("populates errorSummary when calculation surfaces errors", () => {
    // Weight below empty weight triggers validation error per validateAircraftWeight
    const vm = computeTOLDViewModel(
      { ...baseState(), weight: 100 },
      [1000, 8000, 1000]
    );
    expect(vm.errors.length).toBeGreaterThan(0);
    expect(vm.errorSummary).not.toBeNull();
    expect(vm.errorSummary!.count).toBe(vm.errors.length);
  });
});
