import { computeCanyonTurnEntryRanges, type ComputedValue } from "../derived";
import { fieldSubject } from "../notifications";
import type { ManeuveringSpeeds } from "../types";

// Worksheet p.3, Canyon Turns: entry airspeed between 1.4 × Vso (the 60°-bank
// stall speed) and Va, for each flap setting.
const speeds: ManeuveringSpeeds = {
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

const va = (value: number): ComputedValue => ({
  status: "computed",
  value,
  dependsOn: [fieldSubject("weight")],
});

describe("computeCanyonTurnEntryRanges", () => {
  it("runs from 1.4 × Vso to Va for each flap setting", () => {
    const vaValue = va(101);
    expect(computeCanyonTurnEntryRanges(speeds, vaValue)).toEqual([
      { flapSetting: 0, status: "range", min: 71, va: vaValue },
      { flapSetting: 30, status: "range", min: 57, va: vaValue },
    ]);
  });

  it("reports no usable range when 1.4 × Vso is at or above Va", () => {
    const ranges = computeCanyonTurnEntryRanges(speeds, va(71));
    expect(ranges.map((r) => [r.flapSetting, r.status])).toEqual([
      [0, "noRange"],
      [30, "range"],
    ]);
    expect(computeCanyonTurnEntryRanges(speeds, va(60))[0]).toMatchObject({
      status: "noRange",
      min: 71,
    });
  });

  it.each<ComputedValue>([
    { status: "withheld", reason: "needs weight" },
    { status: "unavailable" },
  ])("keeps the lower bound and carries Va through when Va is %j", (missing) => {
    expect(computeCanyonTurnEntryRanges(speeds, missing)).toEqual([
      { flapSetting: 0, status: "noVa", min: 71, va: missing },
      { flapSetting: 30, status: "noVa", min: 57, va: missing },
    ]);
  });

  it("is empty without maneuvering speeds", () => {
    expect(computeCanyonTurnEntryRanges(null, va(101))).toEqual([]);
  });
});
