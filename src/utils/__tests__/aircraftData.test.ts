import aircraftData from "@/data/aircraft.json";
import { vyForPressureAltitude } from "../derived";
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
