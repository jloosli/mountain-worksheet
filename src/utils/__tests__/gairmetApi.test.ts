import { pointInPolygon, classifyAirmets, type GAirmetFeature } from "../gairmetApi";

describe("pointInPolygon", () => {
  const square: [number, number][] = [
    [40, -113],
    [42, -113],
    [42, -111],
    [40, -111],
    [40, -113],
  ];

  it("detects interior point", () => {
    expect(pointInPolygon([41, -112], square)).toBe(true);
  });

  it("detects exterior point", () => {
    expect(pointInPolygon([45, -112], square)).toBe(false);
  });

  it("works on concave polygon", () => {
    const concave: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [2, 2],
      [0, 4],
      [0, 0],
    ];
    // (1,3) is inside the concave bay's left lobe
    expect(pointInPolygon([1, 3], concave)).toBe(true);
    // (3, 3) is in the concave indent (above the (2,2) notch) — outside
    expect(pointInPolygon([3, 3], concave)).toBe(false);
  });
});

describe("classifyAirmets", () => {
  const turbAirmet: GAirmetFeature = {
    hazard: "TURB",
    validTime: "2026-05-12T16:00:00.000Z",
    forecastHour: 0,
    geom: "AREA",
    coords: [
      { lat: "40", lon: "-113" },
      { lat: "42", lon: "-113" },
      { lat: "42", lon: "-111" },
      { lat: "40", lon: "-111" },
      { lat: "40", lon: "-113" },
    ],
  };
  const mtnObscAirmet: GAirmetFeature = {
    ...turbAirmet,
    hazard: "MTN OBSC",
  };
  const ifrAirmet: GAirmetFeature = {
    ...turbAirmet,
    hazard: "IFR",
  };

  it("flags hazards whose polygon contains the position", () => {
    const r = classifyAirmets(
      [turbAirmet, mtnObscAirmet, ifrAirmet],
      [41, -112],
      new Date("2026-05-12T16:00:00Z")
    );
    expect(r.turb).toBe(true);
    expect(r.mtnObsc).toBe(true);
    expect(r.cielVis).toBe(true);
    // IFR threshold-mismatch note is always emitted when IFR is within threshold
    expect(r.warnings.some((w) => /1000 ft \/ 3 sm/i.test(w))).toBe(true);
  });

  it("does not flag hazards whose polygon excludes the position", () => {
    const r = classifyAirmets(
      [turbAirmet, mtnObscAirmet],
      [50, -100],
      new Date("2026-05-12T16:00:00Z")
    );
    expect(r.turb).toBe(false);
    expect(r.mtnObsc).toBe(false);
    expect(r.cielVis).toBe(false);
  });

  it("filters AIRMETs by validTime closest to midTime", () => {
    const closer: GAirmetFeature = {
      ...turbAirmet,
      validTime: "2026-05-12T16:00:00.000Z",
    };
    const farther: GAirmetFeature = {
      ...turbAirmet,
      validTime: "2026-05-12T22:00:00.000Z",
      coords: [
        { lat: "0", lon: "0" },
        { lat: "1", lon: "0" },
        { lat: "1", lon: "1" },
        { lat: "0", lon: "1" },
        { lat: "0", lon: "0" },
      ],
    };
    const r = classifyAirmets(
      [closer, farther],
      [41, -112],
      new Date("2026-05-12T16:00:00Z")
    );
    expect(r.turb).toBe(true);
  });

  it("warns when no AIRMET set within 3 hr of midTime", () => {
    const r = classifyAirmets(
      [turbAirmet],
      [41, -112],
      new Date("2026-06-01T00:00:00Z")
    );
    expect(r.warnings.some((w) => /unavailable/i.test(w))).toBe(true);
  });

  it("emits the IFR threshold-mismatch note whenever IFR was classified", () => {
    const r = classifyAirmets(
      [ifrAirmet],
      [41, -112],
      new Date("2026-05-12T16:00:00Z")
    );
    expect(r.warnings.some((w) => /1000 ft \/ 3 sm/i.test(w))).toBe(true);
  });

  it("does not emit the IFR threshold-mismatch note when no IFR AIRMET was within threshold", () => {
    const r = classifyAirmets(
      [turbAirmet],
      [41, -112],
      new Date("2026-05-12T16:00:00Z")
    );
    expect(r.warnings.some((w) => /1000 ft \/ 3 sm/i.test(w))).toBe(false);
  });
});
