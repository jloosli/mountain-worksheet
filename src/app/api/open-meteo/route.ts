import { NextRequest, NextResponse } from "next/server";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/gfs";

// Only forward params we explicitly use. Anything else is dropped so callers
// can't drive arbitrarily large requests through this server.
const ALLOWED_PARAMS = new Set([
  "latitude",
  "longitude",
  "start_date",
  "end_date",
  "hourly",
  "wind_speed_unit",
  "temperature_unit",
]);

const MAX_WINDOW_DAYS = 7;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (!searchParams.get("latitude") || !searchParams.get("longitude")) {
      return NextResponse.json(
        { error: "Missing required latitude/longitude parameters" },
        { status: 400 }
      );
    }

    const upstreamParams = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (ALLOWED_PARAMS.has(key)) upstreamParams.append(key, value);
    }

    const start = upstreamParams.get("start_date");
    const end = upstreamParams.get("end_date");
    if (start && end && ISO_DATE_RE.test(start) && ISO_DATE_RE.test(end)) {
      const startMs = Date.parse(start + "T00:00:00Z");
      const endMs = Date.parse(end + "T00:00:00Z");
      if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
        const maxMs = MAX_WINDOW_DAYS * 24 * 3600 * 1000;
        if (endMs - startMs > maxMs) {
          upstreamParams.set(
            "end_date",
            dateOnly(new Date(startMs + maxMs))
          );
        }
      }
    }

    const upstreamUrl = `${OPEN_METEO_BASE}?${upstreamParams.toString()}`;
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Open-Meteo API error",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Open-Meteo proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
