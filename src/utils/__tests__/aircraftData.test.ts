import aircraftData from "@/data/aircraft.json";
import { vyForPressureAltitude } from "../derived";
import { calculateVx } from "../formulas";
import type { Aircraft } from "../types";

const aircraft = aircraftData as unknown as Aircraft[];

describe("aircraft.json climb performance tables", () => {
  it.each(aircraft.map((a) => [a.id, a] as const))(
    "%s has one climb speed and one ROC row per pressure altitude",
    (_id, a) => {
      const { pressureAltitudes, climbSpeeds, data } = a.climbPerformance;
      expect(climbSpeeds).toHaveLength(pressureAltitudes.length);
      expect(data).toHaveLength(pressureAltitudes.length);
    },
  );

  it("T206H Vy matches POH Figure 5-7 (3600 lb) at the top of the table", () => {
    const t206 = aircraft.find((a) => a.id === "T206H")!;
    expect(vyForPressureAltitude(t206.climbPerformance, 16000)).toBe(87);
    expect(vyForPressureAltitude(t206.climbPerformance, 20000)).toBe(81);
    expect(vyForPressureAltitude(t206.climbPerformance, 24000)).toBe(79);
    expect(vyForPressureAltitude(t206.climbPerformance, 25000)).toBe(79);
  });
});

describe("aircraft.json Vx", () => {
  it.each(aircraft.map((a) => [a.id, a] as const))(
    "%s has a Vx speed for each Vx altitude",
    (_id, a) => {
      expect(a.Vx).toBeDefined();
      expect(a.Vx!.speeds.length).toBeGreaterThan(0);
      expect(a.Vx!.speeds).toHaveLength(a.Vx!.altitudes.length);
    },
  );

  it("C172S Vx matches POH Section 4 (Airspeeds for Normal Operation)", () => {
    const c172 = aircraft.find((a) => a.id === "C172S")!;
    expect(calculateVx(c172, 0)).toBe(62);
    expect(calculateVx(c172, 10000)).toBe(67);
  });
});
