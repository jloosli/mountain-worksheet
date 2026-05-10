"use client";

import { useEffect, useRef, useState } from "react";
import { parsePosition, type ParsedPosition } from "@/utils/positionParser";
import { geodesicDestination } from "@/utils/positionMath";
import { magneticVariation } from "@/utils/magvar";
import { getAirportInfo, getNavaidInfo } from "@/utils/aviationWeatherApi";

interface PositionInputProps {
  rawValue: string;
  cachedPosition: [number | null, number | null];
  onChange: (route: string, position: [number | null, number | null]) => void;
}

const formatLatLon = (lat: number, lon: number): string =>
  `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

// Module-scoped session cache: id -> {lat, lon}.
const stationCache = new Map<string, { lat: number; lon: number }>();

async function resolveStation(
  parsed: Extract<ParsedPosition, { kind: "airport-rd" | "vor-rd" }>
): Promise<{ lat: number; lon: number }> {
  const cached = stationCache.get(parsed.stationId);
  if (cached) return cached;

  if (parsed.kind === "airport-rd") {
    const [a] = await getAirportInfo([parsed.stationId]);
    if (!a) throw new Error("not found");
    const coords = { lat: a.lat, lon: a.lon };
    stationCache.set(parsed.stationId, coords);
    return coords;
  } else {
    const [n] = await getNavaidInfo([parsed.stationId]);
    if (!n) throw new Error("not found");
    const coords = { lat: n.lat, lon: n.lon };
    stationCache.set(parsed.stationId, coords);
    return coords;
  }
}

function resolveRadialDistance(
  parsed: Extract<ParsedPosition, { kind: "airport-rd" | "vor-rd" }>,
  station: { lat: number; lon: number }
): { lat: number; lon: number } {
  const variation = magneticVariation(station.lat, station.lon);
  const trueBearing = parsed.radial + variation;
  const dest = geodesicDestination(
    station.lat,
    station.lon,
    trueBearing,
    parsed.distanceNm
  );
  return { lat: round4(dest.lat), lon: round4(dest.lon) };
}

export default function PositionInput({
  rawValue,
  cachedPosition,
  onChange,
}: PositionInputProps) {
  const [localRaw, setLocalRaw] = useState(rawValue);
  const lastPushed = useRef(rawValue);
  const requestId = useRef(0);
  const [hint, setHint] = useState<{ type: "ok" | "warn"; text: string } | null>(
    cachedPosition[0] !== null && cachedPosition[1] !== null
      ? { type: "ok", text: `→ ${formatLatLon(cachedPosition[0]!, cachedPosition[1]!)}` }
      : null
  );

  useEffect(() => {
    if (rawValue !== lastPushed.current) {
      setLocalRaw(rawValue);
      const hasCachedCoords =
        cachedPosition[0] !== null && cachedPosition[1] !== null;
      if (hasCachedCoords) {
        setHint({
          type: "ok",
          text: `→ ${formatLatLon(cachedPosition[0]!, cachedPosition[1]!)}`,
        });
        // Trust the URL-cached coordinates; suppress the second effect's
        // re-parse so we don't refetch airport/VOR lookups on hydration.
        lastPushed.current = rawValue;
      } else if (rawValue === "") {
        setHint(null);
        lastPushed.current = rawValue;
      }
    }
  }, [rawValue, cachedPosition]);

  useEffect(() => {
    if (localRaw === lastPushed.current) return;

    const handle = setTimeout(() => {
      const myId = ++requestId.current;
      const parsed = parsePosition(localRaw);
      lastPushed.current = localRaw;

      if (localRaw === "") {
        setHint(null);
        onChange("", [null, null]);
        return;
      }

      if (parsed.kind === "decimal" || parsed.kind === "dms" || parsed.kind === "ddm") {
        setHint({ type: "ok", text: `→ ${formatLatLon(parsed.lat, parsed.lon)}` });
        onChange(localRaw, [parsed.lat, parsed.lon]);
        return;
      }

      if (parsed.kind === "unrecognized") {
        setHint({
          type: "warn",
          text: "⚠ Unrecognized format — saved as free text",
        });
        onChange(localRaw, [null, null]);
        return;
      }

      // airport-rd or vor-rd
      setHint({
        type: "ok",
        text: `→ looking up ${parsed.stationId}…`,
      });

      resolveStation(parsed)
        .then((station) => {
          if (myId !== requestId.current) return; // stale
          const dest = resolveRadialDistance(parsed, station);
          setHint({
            type: "ok",
            text: `→ ${formatLatLon(dest.lat, dest.lon)} (${parsed.raw})`,
          });
          onChange(localRaw, [dest.lat, dest.lon]);
        })
        .catch(() => {
          if (myId !== requestId.current) return; // stale
          setHint({
            type: "warn",
            text: `⚠ Could not find ${parsed.stationId}`,
          });
          onChange(localRaw, [null, null]);
        });
    }, 300);

    return () => clearTimeout(handle);
  }, [localRaw, onChange]);

  return (
    <div className="space-y-2">
      <label htmlFor="route" className="block text-sm font-medium">
        Area of Operations (position)
      </label>
      <input
        type="text"
        id="route"
        name="route"
        value={localRaw}
        onChange={(e) => setLocalRaw(e.target.value.toUpperCase())}
        className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
      />
      {hint && (
        <div
          className={`text-xs ${
            hint.type === "warn"
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          {hint.text}
        </div>
      )}
    </div>
  );
}
