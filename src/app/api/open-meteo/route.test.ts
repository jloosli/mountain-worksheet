/**
 * @jest-environment node
 */
import { GET } from "./route";
import { NextRequest } from "next/server";

global.fetch = jest.fn();

describe("GET /api/open-meteo", () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it("forwards query params to api.open-meteo.com/v1/gfs and returns JSON", async () => {
    const upstream = {
      latitude: 40.5,
      longitude: -112,
      hourly: { time: ["2026-05-12T16:00"], temperature_700hPa: [10] },
    };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => upstream,
    });

    const req = new NextRequest(
      "http://localhost/api/open-meteo?latitude=40.5&longitude=-112&hourly=temperature_700hPa&start_date=2026-05-12&end_date=2026-05-12"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(upstream);
    const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.open-meteo.com/v1/gfs");
    expect(calledUrl).toContain("latitude=40.5");
    expect(calledUrl).toContain("hourly=temperature_700hPa");
  });

  it("returns 400 when required params missing", async () => {
    const req = new NextRequest("http://localhost/api/open-meteo");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("propagates upstream HTTP errors", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      headers: { get: () => "application/json" },
      text: async () => "upstream down",
    });
    const req = new NextRequest(
      "http://localhost/api/open-meteo?latitude=40.5&longitude=-112"
    );
    const res = await GET(req);
    expect(res.status).toBe(503);
  });
});
