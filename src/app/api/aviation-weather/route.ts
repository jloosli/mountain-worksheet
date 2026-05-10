/**
 * Next.js API route to proxy AviationWeather.gov API calls
 * This avoids CORS issues by making server-side requests
 */

import { NextRequest, NextResponse } from "next/server";

const AVIATION_WEATHER_BASE_URL = "https://aviationweather.gov/api/data";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing endpoint parameter" },
        { status: 400 }
      );
    }

    // Build the full URL
    const fullUrl = `${AVIATION_WEATHER_BASE_URL}/${endpoint}`;

    // Copy query parameters (excluding 'endpoint')
    const apiParams = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (key !== "endpoint") {
        apiParams.append(key, value);
      }
    }

    const finalUrl = `${fullUrl}?${apiParams.toString()}`;

    // Make the request to AviationWeather.gov
    const response = await fetch(finalUrl, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mountain-Worksheet/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "AviationWeather API error",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      );
    }

    // Check content type and handle accordingly
    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();

      // For airport endpoint, parse runway dimensions
      if (endpoint === "airport" && Array.isArray(data)) {
        data = data.map(
          (airport: {
            runways?: Array<{
              dimension: string;
              id: string;
              surface: string;
              alignment: number | null;
            }>;
          }) => ({
            ...airport,
            runway:
              airport.runways?.map(
                (runway: {
                  dimension: string;
                  id: string;
                  surface: string;
                  alignment: number | null;
                }) => {
                  const [length, width] = runway.dimension
                    ?.split("x")
                    .map(Number) || [0, 0];
                  return {
                    id: runway.id,
                    length,
                    width,
                    surface: runway.surface,
                    alignment: runway.alignment,
                    lighted: true, // Default to true
                    closed: false, // Default to false
                  };
                }
              ) || [],
          })
        );
      }
    } else {
      // Plain text response: best-effort JSON parse, otherwise return raw
      const textData = await response.text();
      try {
        data = JSON.parse(textData);
      } catch {
        data = { raw: textData };
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
