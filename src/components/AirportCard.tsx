// src/components/AirportCard.tsx
"use client";

import { useId } from "react";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import type { RunwayOption } from "@/utils/types";
import { celciusToFarenheit } from "@/utils/formulas";

type AirportCardVariant = "departure" | "operating" | "arrival";

interface AirportCardCommonProps {
  variant: AirportCardVariant;
  temperature: number | null;
  altimeter: number | null;
  onTemperatureChange: (value: string) => void;
  onAltimeterChange: (value: string) => void;
  apiPopulated: { temperature: boolean; pressure: boolean; runway: boolean };
  useFahrenheit?: boolean;
}

interface AirportCardAirportProps extends AirportCardCommonProps {
  variant: "departure" | "arrival";
  airportCode?: string;
  fieldElev?: number | null;
  runways?: RunwayOption[] | null;
  selectedRunwayLength?: number | null;
  onRunwaySelect?: (length: number) => void;
}

interface AirportCardOperatingProps extends AirportCardCommonProps {
  variant: "operating";
  operatingAltitude?: number | null;
}

type AirportCardProps = AirportCardAirportProps | AirportCardOperatingProps;

const formatTemperatureValue = (
  stored: number | null,
  useFahrenheit: boolean
): string => {
  if (stored === null) return "";
  if (useFahrenheit) return Math.round(celciusToFarenheit(stored)).toString();
  return parseFloat(stored.toFixed(1)).toString();
};

const formatThousands = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const cellInputClass = (apiPopulated: boolean): string => {
  const base =
    "num-mono text-right rounded px-2 py-1 w-24 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-100";
  return apiPopulated
    ? `${base} bg-blue-50 border border-blue-300 dark:bg-blue-900/20 dark:border-blue-600`
    : `${base} bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-600`;
};

const headerVariantLabel: Record<AirportCardVariant, string> = {
  departure: "Departure",
  operating: "Operating",
  arrival: "Arrival",
};

export default function AirportCard(props: AirportCardProps) {
  const variantLabel = headerVariantLabel[props.variant];
  const baseId = useId();
  const tempId = `${baseId}-temp`;
  const altId = `${baseId}-alt`;
  const rwyId = `${baseId}-rwy`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
      <header className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-baseline justify-between gap-2 dark:bg-slate-800 dark:border-slate-700">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {variantLabel}
        </span>
        {props.variant === "operating" ? (
          <span className="text-xs text-slate-500">Cruise · area of ops</span>
        ) : (
          <span className="num-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            {props.airportCode || "—"}
          </span>
        )}
      </header>
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={tempId}
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
          >
            Temperature
          </label>
          <input
            id={tempId}
            type="number"
            value={formatTemperatureValue(props.temperature, !!props.useFahrenheit)}
            onChange={(e) => props.onTemperatureChange(e.target.value)}
            min={props.useFahrenheit ? "-22" : "-30"}
            max={props.useFahrenheit ? "131" : "55"}
            className={cellInputClass(
              props.variant !== "operating" && props.apiPopulated.temperature
            )}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={altId}
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
          >
            Altimeter
          </label>
          <input
            id={altId}
            type="number"
            step="0.01"
            min="28.00"
            max="31.00"
            value={props.altimeter ?? ""}
            onChange={(e) => props.onAltimeterChange(e.target.value)}
            className={cellInputClass(
              props.variant !== "operating" && props.apiPopulated.pressure
            )}
          />
        </div>

        <div className="border-t border-dashed border-slate-200 -mx-4 dark:border-slate-700"></div>

        {props.variant === "operating" ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Altitude
            </span>
            <a
              href="#step-sortie"
              title="Set in Sortie Details"
              className="num-mono text-sm text-slate-900 dark:text-slate-100 inline-flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-400 group"
            >
              {props.operatingAltitude !== null && props.operatingAltitude !== undefined
                ? `${formatThousands(props.operatingAltitude)} ft`
                : "—"}
              <ArrowUpRightIcon className="h-3 w-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
            </a>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Field elev
              </span>
              <span className="num-mono text-sm text-slate-900 dark:text-slate-100">
                {props.fieldElev !== null && props.fieldElev !== undefined
                  ? `${formatThousands(props.fieldElev)} ft`
                  : "—"}
              </span>
            </div>
            <RunwayRow
              runways={props.runways ?? null}
              selectedLength={props.selectedRunwayLength ?? null}
              onSelect={props.onRunwaySelect}
              id={rwyId}
              apiPopulatedRunway={props.apiPopulated.runway}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface RunwayRowProps {
  runways: RunwayOption[] | null;
  selectedLength: number | null;
  onSelect?: (length: number) => void;
  id: string;
  apiPopulatedRunway: boolean;
}

function RunwayRow({
  runways,
  selectedLength,
  onSelect,
  id,
  apiPopulatedRunway,
}: RunwayRowProps) {
  // Filter helipads (alignment === null) from the list.
  const validRunways = runways?.filter((r) => r.alignment !== null) ?? null;

  const selectClass = apiPopulatedRunway
    ? "num-mono text-right bg-blue-50 border border-blue-300 rounded px-2 py-1 text-sm dark:bg-blue-900/20 dark:border-blue-600 dark:text-slate-100"
    : "num-mono text-right bg-white border border-slate-300 rounded px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100";

  return (
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor={id}
        className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
      >
        Runway
      </label>
      {!validRunways || validRunways.length === 0 ? (
        <span className="text-xs text-slate-400 italic">
          Fetch weather to load runways
        </span>
      ) : (
        <select
          id={id}
          value={selectedLength ?? ""}
          onChange={(e) => onSelect?.(Number(e.target.value))}
          className={selectClass}
        >
          {validRunways.map((r) => (
            <option key={r.id} value={r.length}>
              {r.id} · {formatThousands(r.length)} ft
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
