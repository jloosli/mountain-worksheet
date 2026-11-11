import { pointInPolygon, classifyAirmets, fetchGAirmets, type GAirmetFeature } from "../gairmetApi";
import { fieldSubject, stepSubject } from "../notifications";

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
    hazard: "TURB-LO",
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
    hazard: "MT_OBSC",
  };
  const ifrAirmet: GAirmetFeature = {
    ...turbAirmet,
    hazard: "IFR",
  };

  it("flags hazards whose polygon contains the position", () => {
    const r = classifyAirmets(
      [turbAirmet, mtnObscAirmet, ifrAirmet],
      [41, -112],
      new Date("2026-05-12T16:00:00Z"),
    );
    expect(r.turb).toBe(true);
    expect(r.mtnObsc).toBe(true);
    expect(r.cielVis).toBe(true);
    // IFR threshold-mismatch note is always emitted when IFR is within threshold:
    // an auto-flag computed with a weaker threshold is a Caution on that flag.
    expect(r.notifications).toEqual([
      {
        level: "caution",
        subject: fieldSubject("cielVis"),
        message: expect.stringMatching(/1000 ft \/ 3 sm/i),
      },
    ]);
  });

  it("does not flag hazards whose polygon excludes the position", () => {
    const r = classifyAirmets(
      [turbAirmet, mtnObscAirmet],
      [50, -100],
      new Date("2026-05-12T16:00:00Z"),
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
    const r = classifyAirmets([closer, farther], [41, -112], new Date("2026-05-12T16:00:00Z"));
    expect(r.turb).toBe(true);
  });

  it("warns when no AIRMET set within 3 hr of midTime", () => {
    const r = classifyAirmets([turbAirmet], [41, -112], new Date("2026-06-01T00:00:00Z"));
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: stepSubject("weather"),
        message: expect.stringMatching(/unavailable/i),
      },
    ]);
  });

  it("emits the IFR threshold-mismatch note whenever IFR was classified", () => {
    const r = classifyAirmets([ifrAirmet], [41, -112], new Date("2026-05-12T16:00:00Z"));
    expect(r.notifications.some((n) => /1000 ft \/ 3 sm/i.test(n.message))).toBe(true);
  });

  it("does not emit the IFR threshold-mismatch note when no IFR AIRMET was within threshold", () => {
    const r = classifyAirmets([turbAirmet], [41, -112], new Date("2026-05-12T16:00:00Z"));
    expect(r.notifications.some((n) => /1000 ft \/ 3 sm/i.test(n.message))).toBe(false);
  });

  it("clears flags to false when response has no TURB-LO/IFR/MT_OBSC features", () => {
    // e.g. only ICE / LLWS hazards present, or empty array. The fetch succeeded
    // so we should clear stale flags rather than leave them via null sentinel.
    const iceAirmet: GAirmetFeature = { ...turbAirmet, hazard: "ICE" };
    const r = classifyAirmets([iceAirmet], [41, -112], new Date("2026-05-12T16:00:00Z"));
    expect(r.turb).toBe(false);
    expect(r.cielVis).toBe(false);
    expect(r.mtnObsc).toBe(false);
  });

  it("clears flags to false on an empty G-AIRMET response", () => {
    const r = classifyAirmets([], [41, -112], new Date("2026-05-12T16:00:00Z"));
    expect(r.turb).toBe(false);
    expect(r.cielVis).toBe(false);
    expect(r.mtnObsc).toBe(false);
  });

  it("raises a Caution on a flag whose hazard has no G-AIRMET within 3 hr while another hazard does", () => {
    const staleTurb: GAirmetFeature = {
      ...turbAirmet,
      validTime: "2026-05-12T22:00:00.000Z",
    };
    const r = classifyAirmets(
      [staleTurb, mtnObscAirmet],
      [41, -112],
      new Date("2026-05-12T16:00:00Z"),
    );
    expect(r.turb).toBe(false);
    expect(r.mtnObsc).toBe(true);
    expect(r.notifications).toEqual([
      {
        level: "caution",
        subject: fieldSubject("turb"),
        message: expect.stringMatching(/no low-level turbulence G-AIRMET within 3 hr/i),
      },
    ]);
  });

  it("ignores TURB-HI: turbulence at FL180 and above does not set the turbulence flag", () => {
    const turbHi: GAirmetFeature = { ...turbAirmet, hazard: "TURB-HI" };
    const r = classifyAirmets([turbHi, ifrAirmet], [41, -112], new Date("2026-05-12T16:00:00Z"));
    expect(r.turb).toBe(false);
    expect(r.cielVis).toBe(true);
  });

  it("does not classify the retired hazard names TURB and MTN OBSC", () => {
    const r = classifyAirmets(
      [
        { ...turbAirmet, hazard: "TURB" },
        { ...turbAirmet, hazard: "MTN OBSC" },
      ],
      [41, -112],
      new Date("2026-05-12T16:00:00Z"),
    );
    expect(r.turb).toBe(false);
    expect(r.mtnObsc).toBe(false);
  });

  it("raises an Advisory on the weather step when flags are cleared because no relevant G-AIRMETs are in effect", () => {
    const r = classifyAirmets([], [41, -112], new Date("2026-05-12T16:00:00Z"));
    expect(r.notifications).toEqual([
      {
        level: "advisory",
        subject: stepSubject("weather"),
        message: expect.stringMatching(
          /no low-level turbulence, IFR or mountain obscuration G-AIRMETs/i,
        ),
      },
    ]);
  });
});

describe("fetchGAirmets", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const respond = (status: number, body?: unknown) =>
    (global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 204 ? "No Content" : "",
      json: async () => body,
    }) as unknown as typeof fetch);

  it("asks for the G-AIRMET snapshot nearest the sortie time", async () => {
    respond(200, []);
    await fetchGAirmets(new Date("2026-11-11T15:45:00Z"));
    const url = new URL((global.fetch as jest.Mock).mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("endpoint")).toBe("gairmet");
    expect(url.searchParams.get("date")).toBe("2026-11-11T15:45:00Z");
  });

  it("returns the features of a 200 response", async () => {
    const features = [{ hazard: "IFR", validTime: "2026-11-11T15:00:00.000Z" }];
    respond(200, features);
    await expect(fetchGAirmets(new Date("2026-11-11T15:45:00Z"))).resolves.toEqual(features);
  });

  it("returns null on 204: no G-AIRMET forecast covers the sortie time", async () => {
    respond(204);
    await expect(fetchGAirmets(new Date("2026-11-12T03:00:00Z"))).resolves.toBeNull();
  });

  it("throws on an error status", async () => {
    respond(500);
    await expect(fetchGAirmets(new Date("2026-11-11T15:45:00Z"))).rejects.toThrow(/500/);
  });
});
