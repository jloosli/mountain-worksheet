"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { parsePosition, type ParsedPosition } from "@/utils/positionParser";
import { geodesicDestination } from "@/utils/positionMath";
import { magneticVariation } from "@/utils/magvar";
import { getAirportInfo, getNavaidInfo } from "@/utils/aviationWeatherApi";
import { enteredPosition } from "@/utils/areaOfOpsWeather";

interface PositionInputProps {
  rawValue: string;
  cachedPosition: [number | null, number | null];
  onChange: (route: string, position: [number | null, number | null]) => void;
  /** ARIA props for the input, e.g. from `notificationA11yProps`. */
  inputA11yProps?: { "aria-invalid"?: true; "aria-describedby"?: string };
  /** Classes for the outer wrapper, e.g. a grid row span. */
  className?: string;
  /** Rendered at the bottom of the field's block, e.g. its notifications. */
  children?: ReactNode;
}

type PositionKind = Exclude<ParsedPosition["kind"], "unrecognized">;

/**
 * The accepted position formats, shown as chips under the field. Clicking a
 * chip fills the field with its example; the chip for the format being typed
 * lights up. Keep in step with `positionFormats` in InstructionsPanel.
 */
export const POSITION_FORMATS: ReadonlyArray<{
  kind: PositionKind;
  label: string;
  example: string;
}> = [
  { kind: "decimal", label: "Lat/Long", example: "41.43/-112.70" },
  { kind: "airport-rd", label: "Airport/Radial/NM", example: "KOGD/285/34" },
  { kind: "vor-rd", label: "VOR/Radial/NM", example: "OGD/285/34" },
  { kind: "dms", label: "Deg Min Sec", example: "360051N/0753004W" },
  { kind: "ddm", label: "Deg Decimal-Min", example: "3600.86N/07530.07W" },
];

const KIND_DESCRIPTION: Record<"decimal" | "dms" | "ddm", string> = {
  decimal: "decimal lat/long",
  dms: "degrees, minutes, seconds",
  ddm: "degrees, decimal minutes",
};

type Hint = { type: "ok" | "warn"; text: string; kind?: PositionKind };

const UNRECOGNIZED_HINT: Hint = {
  type: "warn",
  text: "⚠ Unrecognized format — saved as free text and not used as the operating position (area weather falls back to the departure–arrival midpoint). Use one of the formats above.",
};

/** How a parsed entry is being read, e.g. "VOR OGD, 285° radial, 34 NM". */
function describe(parsed: ParsedPosition): string {
  switch (parsed.kind) {
    case "airport-rd":
    case "vor-rd":
      return `${parsed.kind === "airport-rd" ? "airport" : "VOR"} ${parsed.stationId}, ${String(parsed.radial).padStart(3, "0")}° radial, ${parsed.distanceNm} NM`;
    case "unrecognized":
      return "";
    default:
      return KIND_DESCRIPTION[parsed.kind];
  }
}

function resolvedHint(parsed: ParsedPosition, lat: number, lon: number): Hint {
  // A link can carry a free-text route alongside valid coordinates; those
  // coordinates are still the operating position, so show them, not a warning.
  if (parsed.kind === "unrecognized") return { type: "ok", text: `→ ${formatLatLon(lat, lon)}` };
  return {
    type: "ok",
    text: `✓ Read as ${describe(parsed)} → ${formatLatLon(lat, lon)}`,
    kind: parsed.kind,
  };
}

function formatLatLon(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

// Module-scoped session cache: id -> {lat, lon}.
const stationCache = new Map<string, { lat: number; lon: number }>();

async function resolveStation(
  parsed: Extract<ParsedPosition, { kind: "airport-rd" | "vor-rd" }>,
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
  station: { lat: number; lon: number },
): { lat: number; lon: number } {
  const variation = magneticVariation(station.lat, station.lon);
  const trueBearing = parsed.radial + variation;
  const dest = geodesicDestination(station.lat, station.lon, trueBearing, parsed.distanceNm);
  return { lat: round4(dest.lat), lon: round4(dest.lon) };
}

export default function PositionInput({
  rawValue,
  cachedPosition,
  onChange,
  inputA11yProps,
  className = "",
  children,
}: PositionInputProps) {
  const [localRaw, setLocalRaw] = useState(rawValue);
  const lastPushed = useRef(rawValue);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState<Hint | null>(() => {
    const cached = enteredPosition(cachedPosition);
    return cached ? resolvedHint(parsePosition(rawValue), cached[0], cached[1]) : null;
  });

  useEffect(() => {
    if (rawValue !== lastPushed.current) {
      setLocalRaw(rawValue);
      const cached = enteredPosition(cachedPosition);
      if (cached) {
        setHint(resolvedHint(parsePosition(rawValue), cached[0], cached[1]));
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
        setHint(resolvedHint(parsed, parsed.lat, parsed.lon));
        onChange(localRaw, [parsed.lat, parsed.lon]);
        return;
      }

      if (parsed.kind === "unrecognized") {
        setHint(UNRECOGNIZED_HINT);
        onChange(localRaw, [null, null]);
        return;
      }

      // airport-rd or vor-rd
      setHint({
        type: "ok",
        text: `Read as ${describe(parsed)} → looking up ${parsed.stationId}…`,
        kind: parsed.kind,
      });

      resolveStation(parsed)
        .then((station) => {
          if (myId !== requestId.current) return; // stale
          const dest = resolveRadialDistance(parsed, station);
          setHint(resolvedHint(parsed, dest.lat, dest.lon));
          onChange(localRaw, [dest.lat, dest.lon]);
        })
        .catch(() => {
          if (myId !== requestId.current) return; // stale
          setHint({
            type: "warn",
            text: `⚠ Could not find ${parsed.kind === "airport-rd" ? "airport" : "VOR"} ${parsed.stationId} — saved as free text. Check the ID.`,
          });
          onChange(localRaw, [null, null]);
        });
    }, 300);

    return () => clearTimeout(handle);
  }, [localRaw, onChange]);

  const describedBy = [inputA11yProps?.["aria-describedby"], "route-hint", "route-formats"]
    .filter(Boolean)
    .join(" ");

  const fillExample = (example: string) => {
    setLocalRaw(example);
    inputRef.current?.focus();
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor="route" className="block text-sm font-medium">
        Area of Operations (position)
      </label>
      <input
        ref={inputRef}
        type="text"
        id="route"
        name="route"
        value={localRaw}
        placeholder="Lat/long, or airport/VOR radial/distance"
        onChange={(e) => setLocalRaw(e.target.value.toUpperCase())}
        className="w-full px-3 py-2 border rounded-md dark:bg-black/[.15] dark:border-white/[.145]"
        {...inputA11yProps}
        aria-describedby={describedBy}
      />
      <div id="route-formats" className="space-y-1">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Accepted formats (click one to use its example):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {POSITION_FORMATS.map((f) => {
            const active = hint?.kind === f.kind;
            return (
              <button
                key={f.kind}
                type="button"
                onClick={() => fillExample(f.example)}
                aria-current={active || undefined}
                aria-label={`Use ${f.label} example ${f.example}`}
                className={`inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100"
                    : "border-slate-300 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:hover:bg-blue-900/30"
                }`}
              >
                <span className="font-medium">{f.label}</span>
                <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                  {f.example}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Mounted even when empty so a hint set later is announced. */}
      <div
        id="route-hint"
        aria-live="polite"
        className={`text-xs ${
          hint?.type === "warn"
            ? "text-amber-600 dark:text-amber-400"
            : "text-gray-600 dark:text-gray-400"
        }`}
      >
        {hint?.text}
      </div>
      {children}
    </div>
  );
}
