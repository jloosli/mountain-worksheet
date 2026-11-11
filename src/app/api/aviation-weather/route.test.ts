/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "./route";

const upstream = (response: Response) =>
  jest.spyOn(global, "fetch").mockResolvedValue(response);

const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/aviation-weather?${query}`));

afterEach(() => jest.restoreAllMocks());

describe("GET /api/aviation-weather", () => {
  it("forwards the query, less endpoint, to aviationweather.gov", async () => {
    const spy = upstream(Response.json([]));
    await get("endpoint=gairmet&format=json&date=2026-11-11T15:45:00Z");
    expect(spy.mock.calls[0][0]).toBe(
      "https://aviationweather.gov/api/data/gairmet?format=json&date=2026-11-11T15%3A45%3A00Z"
    );
  });

  it("passes a 204 No Content through, so callers can tell no data from empty data", async () => {
    upstream(new Response(null, { status: 204 }));
    const res = await get("endpoint=gairmet&format=json&date=2026-11-12T03:00:00Z");
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("returns upstream JSON", async () => {
    upstream(Response.json([{ hazard: "IFR" }]));
    const res = await get("endpoint=gairmet&format=json");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ hazard: "IFR" }]);
  });

  it("reports an upstream error with its status", async () => {
    upstream(new Response("bad", { status: 400, statusText: "Bad Request" }));
    const res = await get("endpoint=taf&ids=KOGD&hours=6");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: 400, statusText: "Bad Request" });
  });
});
