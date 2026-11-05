import {
  applyOpTempForAltitudeChange,
  describeOpTempChange,
  opTempChangeNotifications,
  buildAreaOfOpsWeather,
  greatCircleMidpoint,
  interpolateOpTempFromAloft,
} from "../areaOfOpsWeather";
import type { OpenMeteoPointForecast } from "../openMeteoApi";
import { fieldSubject, stepSubject, type Notification } from "../notifications";

const mockRaw: OpenMeteoPointForecast = {
  hourly: {
    time: ["2026-05-12T16:00", "2026-05-12T17:00"],
    pressure_msl: [1015, 1016],
    temperature_925hPa: [20, 21],
    temperature_900hPa: [18, 19],
    temperature_850hPa: [14, 15],
    temperature_800hPa: [10, 11],
    temperature_700hPa: [4, 5],
    temperature_600hPa: [-5, -4],
    temperature_500hPa: [-15, -14],
    wind_speed_925hPa: [5, 6],
    wind_speed_900hPa: [6, 7],
    wind_speed_850hPa: [8, 9],
    wind_speed_800hPa: [10, 11],
    wind_speed_700hPa: [14, 15],
    wind_speed_600hPa: [20, 21],
    wind_speed_500hPa: [30, 31],
    wind_direction_925hPa: [350, 351],
    wind_direction_900hPa: [355, 356],
    wind_direction_850hPa: [5, 6],
    wind_direction_800hPa: [10, 11],
    wind_direction_700hPa: [20, 21],
    wind_direction_600hPa: [30, 31],
    wind_direction_500hPa: [40, 41],
    // Heights in metres so heights*3.28084 ft come out roughly: 925→2500, 900→3300, 850→5000, 800→6500, 700→10000, 600→14000, 500→18000
    geopotential_height_925hPa: [762, 762],
    geopotential_height_900hPa: [1006, 1006],
    geopotential_height_850hPa: [1524, 1524],
    geopotential_height_800hPa: [1981, 1981],
    geopotential_height_700hPa: [3048, 3048],
    geopotential_height_600hPa: [4267, 4267],
    geopotential_height_500hPa: [5486, 5486],
  },
};

describe("greatCircleMidpoint", () => {
  it("computes midpoint of equal lat/lon pair as same point", () => {
    expect(greatCircleMidpoint([40, -111], [40, -111])).toEqual([40, -111]);
  });

  it("computes midpoint of two CONUS airports", () => {
    const [lat, lon] = greatCircleMidpoint([40.2, -111.7], [37.1, -113.6]);
    expect(lat).toBeGreaterThan(38);
    expect(lat).toBeLessThan(40);
    expect(lon).toBeGreaterThan(-113.6);
    expect(lon).toBeLessThan(-111.7);
  });
});

const AREA_FIELDS = [
  ...[0, 1, 2, 3, 4].map((i) => fieldSubject("wind", i)),
  fieldSubject("temp", 1),
  fieldSubject("altimeter", 1),
];

const cautionSubjects = (
  notifications: Notification[],
  message: RegExp
) =>
  notifications
    .filter((n) => n.level === "caution" && message.test(n.message))
    .map((n) => n.subject);

describe("buildAreaOfOpsWeather", () => {
  it("puts a midpoint Caution only on the fields the fetch filled", () => {
    const { pressure_msl: _omit, ...hourly } = mockRaw.hourly;
    void _omit;
    const r = buildAreaOfOpsWeather({
      position: [null, null],
      depAirportLatLon: [40.2, -111.7],
      arrAirportLatLon: [37.1, -113.6],
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: null,
      raw: { hourly: hourly as OpenMeteoPointForecast["hourly"] },
    });
    expect(cautionSubjects(r.notifications, /position not entered/i)).toEqual(
      [0, 1, 2, 3, 4].map((i) => fieldSubject("wind", i))
    );
  });

  it("uses user position when both coords present", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.positionSource).toBe("user");
    expect(r.position).toEqual([40.5, -112.0]);
  });

  it("falls back to dep/arr midpoint when position blank", () => {
    const r = buildAreaOfOpsWeather({
      position: [null, null],
      depAirportLatLon: [40.2, -111.7],
      arrAirportLatLon: [37.1, -113.6],
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.positionSource).toBe("midpoint");
    // A midpoint position is a Substitution for every area-of-ops field it
    // filled, so values computed from them carry its marker.
    expect(cautionSubjects(r.notifications, /position not entered/i)).toEqual(
      AREA_FIELDS
    );
  });

  it("populates 5-altitude wind table from interpolation", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    // wind table has direction[5], speed[5], temp[5]
    expect(r.windsAloft.direction).toHaveLength(5);
    expect(r.windsAloft.speed).toHaveLength(5);
    expect(r.windsAloft.temp).toHaveLength(5);
    expect(r.windsAloft.temp[0]).not.toBeNull();
  });

  it("computes opTemp at user altitude and opAltimeter from pressure_msl", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.opTemp).toBeGreaterThan(0);
    expect(r.opTemp).toBeLessThan(15);
    // 1015 hPa × 0.02953 ≈ 29.97 inHg
    expect(r.opAltimeter).toBeCloseTo(29.97, 2);
  });

  it("raises a Warning on the operating altimeter when the forecast has no sea-level pressure", () => {
    const { pressure_msl: _omit, ...hourly } = mockRaw.hourly;
    void _omit;
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: { hourly: hourly as OpenMeteoPointForecast["hourly"] },
    });
    expect(r.opAltimeter).toBeNull();
    expect(r.notifications).toContainEqual({
      level: "warning",
      subject: fieldSubject("altimeter", 1),
      message: expect.stringMatching(/sea-level pressure/i),
    });
  });

  it("returns null op fields and warning when no airport coords either", () => {
    const r = buildAreaOfOpsWeather({
      position: [null, null],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(r.positionSource).toBe("none");
    expect(r.opTemp).toBeNull();
    // Entering a position is how the pilot fixes this, so it sits on that field.
    expect(r.notifications).toEqual([
      {
        level: "warning",
        subject: fieldSubject("position"),
        message: expect.stringMatching(/skipped/i),
      },
    ]);
  });

  it("warns when forecast time snap delta exceeds 1 hour", () => {
    // mockRaw covers 2026-05-12T16:00 and T17:00; midTime far away → snap
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-13T05:00:00Z"),
      opAltitudeFt: 9000,
      raw: mockRaw,
    });
    expect(cautionSubjects(r.notifications, /forecast time snapped/i)).toEqual(
      AREA_FIELDS
    );
  });

  it("raises a Caution on the winds-aloft column whose altitude was snapped", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      // Drop 925/900 hPa so the lowest level (850 hPa, ~5,000 ft) sits above 3,000 ft.
      raw: {
        hourly: {
          ...mockRaw.hourly,
          geopotential_height_925hPa: [NaN, NaN],
          geopotential_height_900hPa: [NaN, NaN],
        },
      },
    });
    expect(r.notifications).toEqual([
      {
        level: "caution",
        subject: fieldSubject("wind", 0),
        message: expect.stringMatching(/3000 ft below/i),
      },
    ]);
  });

  it("raises a Caution on the operating temperature when its altitude was snapped", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 20000,
      raw: mockRaw,
    });
    expect(r.notifications).toContainEqual({
      level: "caution",
      subject: fieldSubject("temp", 1),
      message: expect.stringMatching(/20000 ft above/i),
    });
  });

  it("raises Warnings on the winds aloft and operating values when the forecast has no times", () => {
    const r = buildAreaOfOpsWeather({
      position: [40.5, -112.0],
      depAirportLatLon: null,
      arrAirportLatLon: null,
      midTime: new Date("2026-05-12T16:00:00Z"),
      opAltitudeFt: 9000,
      raw: { hourly: { ...mockRaw.hourly, time: [] } },
    });
    expect(r.notifications.map((n) => [n.level, n.subject])).toEqual([
      ["warning", fieldSubject("wind")],
      ["warning", fieldSubject("temp", 1)],
      ["warning", fieldSubject("altimeter", 1)],
    ]);
  });
});

describe("interpolateOpTempFromAloft", () => {
  const aloft = [20, 14, 8, 2, -10]; // temps at 3k, 6k, 9k, 12k, 15k

  it("returns the bucket temp when altitude lands exactly on one", () => {
    expect(interpolateOpTempFromAloft(9000, aloft)).toBe(8);
  });

  it("interpolates between buckets", () => {
    // 10000 ft → 1/3 between 9000(8) and 12000(2) → 8 + (1/3)*(2-8) = 6
    expect(interpolateOpTempFromAloft(10000, aloft)).toBe(6);
  });

  it("snaps to lowest bucket below 3000 ft", () => {
    expect(interpolateOpTempFromAloft(1500, aloft)).toBe(20);
  });

  it("snaps to highest bucket above 15000 ft", () => {
    expect(interpolateOpTempFromAloft(18000, aloft)).toBe(-10);
  });

  it("returns null when altitude is missing", () => {
    expect(interpolateOpTempFromAloft(null, aloft)).toBeNull();
    expect(interpolateOpTempFromAloft(undefined, aloft)).toBeNull();
  });

  it("returns null when aloft temps are missing or all null", () => {
    expect(interpolateOpTempFromAloft(9000, null)).toBeNull();
    expect(
      interpolateOpTempFromAloft(9000, [null, null, null, null, null])
    ).toBeNull();
  });

  it("skips null buckets and interpolates from the rest", () => {
    // Only 3k=20 and 12k=2 available → at 9k, f=(9k-3k)/(12k-3k)=2/3 → 20 + 2/3*(2-20) = 8
    expect(
      interpolateOpTempFromAloft(9000, [20, null, null, 2, null])
    ).toBe(8);
  });

  it("returns the only available bucket when just one is present", () => {
    expect(
      interpolateOpTempFromAloft(10000, [null, null, 7, null, null])
    ).toBe(7);
  });

  it("snaps to the lowest *available* bucket when the 3k bucket is missing", () => {
    // 3k missing → 6k=14 is the lowest available. Altitude 4000 (below 6k)
    // snaps to 14, not to a null 3k value.
    expect(
      interpolateOpTempFromAloft(4000, [null, 14, 8, 2, -10])
    ).toBe(14);
  });

  it("snaps to the highest *available* bucket when the 15k bucket is missing", () => {
    // 15k missing → 12k=2 is the highest available. Altitude 16000 (above 12k)
    // snaps to 2, not to a null 15k value.
    expect(
      interpolateOpTempFromAloft(16000, [20, 14, 8, 2, null])
    ).toBe(2);
  });
});

describe("applyOpTempForAltitudeChange", () => {
  const aloftTemps = [20, 14, 8, 2, -10];
  const wind: [
    (number | null)[],
    (number | null)[],
    (number | null)[],
  ] = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    aloftTemps,
  ];

  it("recomputes temp[1] when altitude[1] changes (regression for #117)", () => {
    // User fetched weather with altitude[1] = 6000 (temp[1]=14), then bumps
    // altitude to 10000 ft. Expected new temp[1] interpolates 9k→12k: at 10k
    // that's 8 + (1/3)*(2-8) = 6.
    const prev = {
      altitude: [4500, 6000, 4490] as [number | null, number | null, number | null],
      temp: [21, 14, 19] as [number | null, number | null, number | null],
      wind,
    };
    const updates = {
      altitude: [4500, 10000, 4490] as [number | null, number | null, number | null],
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toEqual([21, 6, 19]);
  });

  it("snaps to lowest bucket when the new operating altitude is below 3k", () => {
    const prev = {
      altitude: [4500, 9000, 4490] as [number | null, number | null, number | null],
      temp: [21, 8, 19] as [number | null, number | null, number | null],
      wind,
    };
    const updates = {
      altitude: [4500, 1500, 4490] as [number | null, number | null, number | null],
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toEqual([21, 20, 19]);
  });

  it("returns null when altitude[1] is unchanged", () => {
    const prev = {
      altitude: [4500, 9000, 4490] as [number | null, number | null, number | null],
      temp: [21, 8, 19] as [number | null, number | null, number | null],
      wind,
    };
    const updates = {
      altitude: [4500, 9000, 5000] as [number | null, number | null, number | null], // only arrival changed
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toBeNull();
  });

  it("returns null when the update already carries an explicit temp (fresh weather fetch)", () => {
    // A weather fetch may include altitude, temp, and wind together. The
    // mapper already wrote the correct opTemp; don't second-guess it.
    const prev = {
      altitude: [null, null, null] as [number | null, number | null, number | null],
      temp: [null, null, null] as [number | null, number | null, number | null],
      wind: null,
    };
    const updates = {
      altitude: [4500, 10000, 4490] as [number | null, number | null, number | null],
      temp: [21, 4, 19] as [number | null, number | null, number | null],
      wind,
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toBeNull();
  });

  it("returns null when no winds-aloft data is available", () => {
    const prev = {
      altitude: [null, null, null] as [number | null, number | null, number | null],
      temp: [null, null, null] as [number | null, number | null, number | null],
      wind: null,
    };
    const updates = {
      altitude: [null, 10000, null] as [number | null, number | null, number | null],
    };
    expect(applyOpTempForAltitudeChange(prev, updates)).toBeNull();
  });

  it("returns null when the recomputed temp equals the existing temp[1]", () => {
    const prev = {
      altitude: [null, 6000, null] as [number | null, number | null, number | null],
      temp: [null, 14, null] as [number | null, number | null, number | null],
      wind,
    };
    const updates = {
      altitude: [null, 6001, null] as [number | null, number | null, number | null],
    };
    // Interpolation rounds to 14 again → no change → null
    expect(applyOpTempForAltitudeChange(prev, updates)).toBeNull();
  });
});

describe("operating temperature re-derivation notifications (#225)", () => {
  type Triple = [number | null, number | null, number | null];
  const wind: [(number | null)[], (number | null)[], (number | null)[]] = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [20, 14, 8, 2, -10],
  ];
  const prev = {
    altitude: [4500, 6000, 4490] as Triple,
    temp: [21, 5, 19] as Triple,
    wind,
  };
  const at = (altitude: number, opTemp: number | null) => ({
    altitude: [4500, altitude, 4490] as Triple,
    temp: [21, opTemp, 19] as Triple,
  });

  it("raises a Caution when the re-derived value replaced the pilot's entry", () => {
    const change = describeOpTempChange(
      prev,
      { altitude: [4500, 9000, 4490] },
      { fetchedOpTemp: 14 }
    );
    expect(change).toEqual({
      value: 8,
      altitudeFt: 9000,
      replaced: 5,
      snappedToFt: null,
    });
    expect(opTempChangeNotifications(at(9000, 8), change)).toEqual([
      {
        level: "caution",
        subject: fieldSubject("temp", 1),
        message: expect.stringMatching(
          /re-derived from winds aloft at 9,000 ft \(8°C\).*your entry of 5°C/
        ),
      },
    ]);
  });

  it("does not call a fetched value a manual entry", () => {
    const change = describeOpTempChange(
      prev,
      { altitude: [4500, 9000, 4490] },
      { fetchedOpTemp: 5 }
    );
    expect(change?.replaced).toBeNull();
    expect(opTempChangeNotifications(at(9000, 8), change)).toEqual([]);
  });

  it("does not call its own earlier re-derivation a manual entry", () => {
    const earlier = { value: 5, altitudeFt: 6000, replaced: null, snappedToFt: null };
    const change = describeOpTempChange(
      prev,
      { altitude: [4500, 9000, 4490] },
      { fetchedOpTemp: null, previous: earlier }
    );
    expect(change?.replaced).toBeNull();
  });

  it("raises a Caution when the altitude is outside the winds-aloft temperatures and the value snapped", () => {
    const change = describeOpTempChange(
      prev,
      { altitude: [4500, 17000, 4490] },
      { fetchedOpTemp: 5 }
    );
    expect(change?.snappedToFt).toBe(15000);
    expect(opTempChangeNotifications(at(17000, -10), change)).toEqual([
      {
        level: "caution",
        subject: fieldSubject("temp", 1),
        message: expect.stringMatching(
          /17,000 ft is above the winds-aloft temperatures; using the 15,000 ft temperature/
        ),
      },
    ]);
  });

  it("keeps the snap Caution when the new altitude's temperature equals the stored one", () => {
    // 15,000 → 17,000 ft: both use the 15,000 ft bucket (-10°C), so the
    // stored temperature doesn't change, but the value is still snapped.
    const atTop = { altitude: [4500, 15000, 4490] as Triple, temp: [21, -10, 19] as Triple, wind };
    const change = describeOpTempChange(
      atTop,
      { altitude: [4500, 17000, 4490] },
      { fetchedOpTemp: 5 }
    );
    expect(change).toEqual({
      value: -10,
      altitudeFt: 17000,
      replaced: null,
      snappedToFt: 15000,
    });
    expect(opTempChangeNotifications(at(17000, -10), change)).toEqual([
      {
        level: "caution",
        subject: fieldSubject("temp", 1),
        message: expect.stringMatching(/17,000 ft is above the winds-aloft temperatures/),
      },
    ]);
  });

  it("drops the notifications once the pilot overrides the temperature or changes altitude again", () => {
    const change = describeOpTempChange(
      prev,
      { altitude: [4500, 17000, 4490] },
      { fetchedOpTemp: null }
    );
    expect(opTempChangeNotifications(at(17000, -10), change)).toHaveLength(2);
    expect(opTempChangeNotifications(at(17000, -4), change)).toEqual([]);
    expect(opTempChangeNotifications(at(16000, -10), change)).toEqual([]);
    expect(opTempChangeNotifications(at(17000, -10), null)).toEqual([]);
  });

  it("returns null when no re-derivation applies", () => {
    expect(
      describeOpTempChange(prev, { altitude: [4500, 6000, 4490] }, {})
    ).toBeNull();
  });
});
