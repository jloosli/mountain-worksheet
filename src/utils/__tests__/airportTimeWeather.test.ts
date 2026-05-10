import { selectAirportWeather, type TafFcst } from "../airportTimeWeather";
import type { METARResponse, TAFResponse } from "../aviationWeatherApi";

const baseMetar: METARResponse = {
  icaoId: "KSLC",
  obsTime: "2026-05-12T15:00:00Z",
  report: "",
  temp: 18,
  dewp: 5,
  wdir: 0,
  wspd: 0,
  visib: 10,
  altim: 1015, // hectopascals
  qcField: 0,
  metarType: "METAR",
  rawOb: "",
};

const tafFcsts = [
  {
    timeFrom: Math.floor(Date.parse("2026-05-12T15:00:00Z") / 1000),
    timeTo: Math.floor(Date.parse("2026-05-12T18:00:00Z") / 1000),
    temp: 22,
    altim: 30.0,
    wdir: 0,
    wspd: 0,
  },
  {
    timeFrom: Math.floor(Date.parse("2026-05-12T18:00:00Z") / 1000),
    timeTo: Math.floor(Date.parse("2026-05-12T21:00:00Z") / 1000),
    temp: 24,
    altim: 30.05,
    wdir: 0,
    wspd: 0,
  },
] as unknown as TafFcst[];

const baseTaf: TAFResponse = {
  icaoId: "KSLC",
  issueTime: "2026-05-12T14:00:00Z",
  validTime: "2026-05-12T15:00:00Z",
  validTimeEnd: "2026-05-12T21:00:00Z",
  rawTAF: "",
  lat: 40.77,
  lon: -111.96,
  elev: 1300,
  fcstType: "TAF",
  fcsts: tafFcsts,
} as unknown as TAFResponse;

describe("selectAirportWeather", () => {
  it("uses METAR when requested time is within ~90 min of obsTime", () => {
    const requested = new Date("2026-05-12T15:30:00Z");
    const result = selectAirportWeather(baseMetar, baseTaf, requested);
    expect(result.source).toBe("metar");
    expect(result.temp).toBe(18);
    expect(result.altimeter).toBeCloseTo(29.97, 2); // 1015 hPa → ~29.97 inHg
    expect(result.warnings).toEqual([]);
  });

  it("uses TAF period covering requested time when METAR is stale", () => {
    const requested = new Date("2026-05-12T19:30:00Z"); // > 90 min from METAR
    const result = selectAirportWeather(baseMetar, baseTaf, requested);
    expect(result.source).toBe("taf-fcst");
    expect(result.temp).toBe(24);
    expect(result.altimeter).toBe(30.05);
    expect(result.warnings).toEqual([]);
  });

  it("falls back to METAR temp when matched TAF period has no temp", () => {
    const tafNoTemp = {
      ...baseTaf,
      fcsts: [
        { ...tafFcsts[0], temp: undefined },
        tafFcsts[1],
      ],
    } as unknown as TAFResponse;
    const requested = new Date("2026-05-12T17:00:00Z"); // > 90 min from METAR, in fcst[0]
    const result = selectAirportWeather(baseMetar, tafNoTemp, requested);
    expect(result.source).toBe("taf-fcst");
    expect(result.temp).toBe(18); // fell back to METAR
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/no temperature/);
  });

  it("emits stale warning when no TAF period covers requested time", () => {
    const requested = new Date("2026-05-15T12:00:00Z"); // 3 days past TAF end
    const result = selectAirportWeather(baseMetar, baseTaf, requested);
    expect(result.source).toBe("taf-nearest");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/forecast unavailable/i);
  });

  it("returns source 'none' when neither METAR nor TAF available", () => {
    const requested = new Date("2026-05-12T15:00:00Z");
    const result = selectAirportWeather(undefined, undefined, requested);
    expect(result.source).toBe("none");
    expect(result.temp).toBeNull();
    expect(result.altimeter).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warns when METAR obsTime is unparseable but still attempts TAF", () => {
    const broken = { ...baseMetar, obsTime: "INVALID" };
    const requested = new Date("2026-05-12T19:30:00Z");
    const result = selectAirportWeather(broken, baseTaf, requested);
    expect(result.source).toBe("taf-fcst");
    expect(result.warnings.some((w) => /could not be parsed/i.test(w))).toBe(true);
  });

  it("picks the temporally closest sfcTemp from a TAF array-form temp", () => {
    const arrayTempFcsts = [
      {
        timeFrom: Math.floor(Date.parse("2026-05-12T15:00:00Z") / 1000),
        timeTo: Math.floor(Date.parse("2026-05-12T21:00:00Z") / 1000),
        altim: 30.0,
        temp: [
          {
            validTime: Math.floor(Date.parse("2026-05-12T16:00:00Z") / 1000),
            sfcTemp: 20,
          },
          {
            validTime: Math.floor(Date.parse("2026-05-12T19:00:00Z") / 1000),
            sfcTemp: 26,
          },
        ],
      },
    ] as unknown as TafFcst[];
    const tafArray = { ...baseTaf, fcsts: arrayTempFcsts } as unknown as TAFResponse;
    // Requested time near 19:00 (closer to sfcTemp 26)
    const requested = new Date("2026-05-12T18:45:00Z");
    const result = selectAirportWeather(baseMetar, tafArray, requested);
    expect(result.source).toBe("taf-fcst");
    expect(result.temp).toBe(26);
  });
});
