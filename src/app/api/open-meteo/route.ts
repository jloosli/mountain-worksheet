import { NextRequest, NextResponse } from "next/server";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/gfs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (!searchParams.get("latitude") || !searchParams.get("longitude")) {
      return NextResponse.json(
        { error: "Missing required latitude/longitude parameters" },
        { status: 400 }
      );
    }
    const upstreamUrl = `${OPEN_METEO_BASE}?${searchParams.toString()}`;
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
