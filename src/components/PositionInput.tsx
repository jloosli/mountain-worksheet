"use client";

import { useEffect, useRef, useState } from "react";
import { parsePosition } from "@/utils/positionParser";

interface PositionInputProps {
  rawValue: string;
  cachedPosition: [number | null, number | null];
  onChange: (route: string, position: [number | null, number | null]) => void;
}

const formatLatLon = (lat: number, lon: number): string =>
  `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

export default function PositionInput({
  rawValue,
  cachedPosition,
  onChange,
}: PositionInputProps) {
  const [localRaw, setLocalRaw] = useState(rawValue);
  const lastPushed = useRef(rawValue);
  const [hint, setHint] = useState<{ type: "ok" | "warn"; text: string } | null>(
    cachedPosition[0] !== null && cachedPosition[1] !== null
      ? { type: "ok", text: `→ ${formatLatLon(cachedPosition[0]!, cachedPosition[1]!)}` }
      : null
  );

  // Sync incoming prop changes only when external (per AGENTS.md last-pushed pattern)
  useEffect(() => {
    if (rawValue !== lastPushed.current) {
      setLocalRaw(rawValue);
      if (cachedPosition[0] !== null && cachedPosition[1] !== null) {
        setHint({
          type: "ok",
          text: `→ ${formatLatLon(cachedPosition[0]!, cachedPosition[1]!)}`,
        });
      } else if (rawValue === "") {
        setHint(null);
      }
    }
  }, [rawValue, cachedPosition]);

  // Debounced parse on local edits
  useEffect(() => {
    if (localRaw === lastPushed.current) return;

    const handle = setTimeout(() => {
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
      } else if (parsed.kind === "unrecognized") {
        setHint({
          type: "warn",
          text: "⚠ Unrecognized format — saved as free text",
        });
        onChange(localRaw, [null, null]);
      } else {
        // airport-rd / vor-rd handled in Task 11
        onChange(localRaw, [null, null]);
      }
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
