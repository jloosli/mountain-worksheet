import {
  findInverseXgivenYandZ,
  inverseLookupExtrapolation,
  trilinearInterpolate,
  trilinearTableGaps,
  type TrilinearInterpolationTable,
} from "../interpolation";

describe("trilinearTableGaps", () => {
  const table: TrilinearInterpolationTable = {
    weights: [2000, 2400],
    pressureAltitudes: [0, 2000],
    temperatures: [0, 20],
    data: [
      [
        [100, 110],
        [120, 130],
      ],
      [
        [140, 150],
        [160, null],
      ],
    ],
  };

  it("counts the null corners that trilinearInterpolate filled with the average", () => {
    expect(trilinearTableGaps(table, 2200, 1000, 10)).toBe(1);
    // The value is still produced from the averaged corner (unchanged behaviour).
    expect(trilinearInterpolate(table, 2200, 1000, 10)).not.toBeNull();
  });

  it("reports no gaps when every bracketing corner has data", () => {
    expect(trilinearTableGaps(table, 2000, 0, 0)).toBe(0);
    const full = {
      ...table,
      data: [table.data[0], [[140, 150], [160, 170]]],
    };
    expect(trilinearTableGaps(full, 2200, 1000, 10)).toBe(0);
  });

  it("reports no gaps when every corner is null (no value is produced, nothing is substituted)", () => {
    const empty = {
      ...table,
      data: [
        [
          [null, null],
          [null, null],
        ],
        [
          [null, null],
          [null, null],
        ],
      ],
    };
    expect(trilinearInterpolate(empty, 2200, 1000, 10)).toBeNull();
    expect(trilinearTableGaps(empty, 2200, 1000, 10)).toBe(0);
  });
});

describe("inverseLookupExtrapolation", () => {
  // Climb rate (fpm) by pressure altitude (rows) and temperature (columns).
  const alts = [0, 4000, 8000];
  const temps = [0, 20];
  const roc = [
    [900, 800],
    [700, 600],
    [500, 400],
  ];

  it("is null when the target lies within the table", () => {
    const x = findInverseXgivenYandZ(roc, alts, temps, 600, 20);
    expect(x).toBe(4000);
    expect(inverseLookupExtrapolation(roc, alts, temps, 20, x)).toBeNull();
  });

  it("reports 'above' when the result was extrapolated beyond the highest table altitude", () => {
    const x = findInverseXgivenYandZ(roc, alts, temps, 300, 20);
    expect(x).toBeGreaterThan(8000);
    expect(inverseLookupExtrapolation(roc, alts, temps, 20, x)).toBe("above");
  });

  it("reports 'below' when the result was extrapolated below the lowest table altitude", () => {
    const x = findInverseXgivenYandZ(roc, alts, temps, 1000, 0);
    expect(x).toBeLessThan(0);
    expect(inverseLookupExtrapolation(roc, alts, temps, 0, x)).toBe("below");
  });

  it("uses only the rows with data at that temperature", () => {
    const gappy = [
      [900, 800],
      [700, 600],
      [null, null],
    ];
    const x = findInverseXgivenYandZ(gappy, alts, temps, 500, 20);
    expect(x).toBeGreaterThan(4000);
    expect(inverseLookupExtrapolation(gappy, alts, temps, 20, x)).toBe("above");
  });
});
