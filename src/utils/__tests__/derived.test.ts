import { computePressureColumns } from "../derived";

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
