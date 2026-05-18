import type { WorksheetData } from "@/utils/types";
import {
  computePressureColumns,
  computeTOLDViewModel,
  type Triple,
} from "@/utils/derived";

interface PrintBriefingProps {
  state: WorksheetData;
}

const WIND_LABELS = ["3,000", "6,000", "9,000", "12,000", "15,000"] as const;

const dash = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  return String(v);
};

const tick = (v: boolean): string => (v ? "✓" : "✗");

const fmtFt = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : Math.round(v).toLocaleString();

const fmtNum = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : v.toLocaleString();

type EnvReader = (
  s: WorksheetData,
  PAs: Triple,
  DAs: Triple,
) => [number | null, number | null, number | null];

const ENV_ROWS: ReadonlyArray<{
  label: string;
  read: EnvReader;
  fmt: (v: number | null) => string;
}> = [
  {
    label: "Actual Altitude (ft)",
    read: (s) => s.altitude,
    fmt: fmtFt,
  },
  {
    label: "OAT (°C)",
    read: (s) => s.temp,
    fmt: fmtNum,
  },
  {
    label: "Altimeter (inHg)",
    read: (s) => s.altimeter,
    fmt: (v) => (v === null ? "—" : v.toFixed(2)),
  },
  {
    label: "Pressure Alt (ft)",
    read: (_s, PAs) => PAs,
    fmt: fmtFt,
  },
  {
    label: "Density Alt (ft)",
    read: (_s, _PAs, DAs) => DAs,
    fmt: fmtFt,
  },
];

function TOLDRow({
  label,
  dep,
  arr,
  colorNegative,
}: {
  label: string;
  dep: number | null;
  arr: number | null;
  colorNegative?: boolean;
}) {
  const cellClass = (v: number | null) => {
    if (colorNegative && v !== null && v < 0) {
      return "py-0.5 text-right print-keep-color print-margin-bad text-red-700 font-semibold";
    }
    return "py-0.5 text-right";
  };
  return (
    <tr className="border-b border-slate-200">
      <td className="py-0.5 pr-2">{label}</td>
      <td className={cellClass(dep) + " pr-2"}>{fmtFt(dep)}</td>
      <td className={cellClass(arr)}>{fmtFt(arr)}</td>
    </tr>
  );
}

export default function PrintBriefing({ state }: PrintBriefingProps) {
  const [dep, arr] = state.airport;
  const [lat, lon] = state.position;
  const position =
    lat !== null && lon !== null
      ? `${lat.toFixed(2)}, ${lon.toFixed(2)}`
      : "—";

  const { PAs, DAs } = computePressureColumns(
    state.altitude,
    state.altimeter,
    state.temp,
  );
  const told = computeTOLDViewModel(state, PAs);

  return (
    <section
      className="hidden print:block text-[9pt] leading-tight text-slate-900"
      aria-label="Print briefing"
    >
      <header className="flex items-baseline justify-between border-b border-slate-400 pb-1 mb-2">
        <h2 className="text-[12pt] font-bold tracking-tight">
          CAP Mountain Flying Worksheet — Briefing
        </h2>
      </header>

      <div className="mb-1.5">
        <span className="font-semibold">Pilot:</span>{" "}
        <span>{dash(state.pilot)}</span>
        <span className="mx-2">·</span>
        <span className="font-semibold">AC:</span>{" "}
        <span>{dash(state.acType)}</span> / <span>{dash(state.tailN)}</span>
        <span className="mx-2">·</span>
        <span className="font-semibold">UTC:</span>{" "}
        <span>{dash(state.date)}</span>{" "}
        <span>{dash(state.time)}</span>
        <span className="mx-2">·</span>
        <span className="font-semibold">Duration:</span>{" "}
        <span>{state.duration !== null ? `${state.duration} h` : "—"}</span>
        <span className="mx-2">·</span>
        <span>Mtn Endorse {tick(state.mtnEndorse)}</span>
        <span className="mx-2">·</span>
        <span>Mtn Cert {tick(state.mtnCert)}</span>
      </div>

      <div className="mb-2">
        <span className="font-semibold">Route:</span>{" "}
        <span>{dash(dep)}</span> →{" "}
        <span>{dash(arr)}</span>
        <span className="mx-2">·</span>
        <span className="font-semibold">Area:</span>{" "}
        <span>{dash(state.route)}</span>
        <span className="mx-2">·</span>
        <span className="font-semibold">Position:</span>{" "}
        <span>{position}</span>
      </div>

      {/* ---- Conditions ---- */}
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-x-4 break-inside-avoid">
        <div>
          <div className="font-semibold mb-0.5">Winds aloft</div>
          <table className="w-full border-collapse text-[8pt]">
            <thead>
              <tr className="border-b border-slate-400">
                <th className="text-left pr-2 font-medium">Alt</th>
                <th className="text-right pr-2 font-medium">Dir</th>
                <th className="text-right pr-2 font-medium">Vel</th>
                <th className="text-right font-medium">Temp</th>
              </tr>
            </thead>
            <tbody>
              {WIND_LABELS.map((label, idx) => (
                <tr key={label} className="border-b border-slate-200">
                  <td className="py-0.5 pr-2">{label}</td>
                  <td className="py-0.5 pr-2 text-right">
                    {dash(state.wind[0][idx] ?? null)}
                  </td>
                  <td className="py-0.5 pr-2 text-right">
                    {dash(state.wind[1][idx] ?? null)}
                  </td>
                  <td className="py-0.5 text-right">
                    {dash(state.wind[2][idx] ?? null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="self-start">
          <div className="font-semibold mb-0.5">Advisories</div>
          <ul className="space-y-0.5 text-[8pt]">
            <li>
              <span className={state.turb ? "print-keep-color text-amber-700 font-semibold" : "text-slate-500"}>
                Turb {tick(state.turb)}
              </span>
            </li>
            <li>
              <span className={state.cielVis ? "print-keep-color text-amber-700 font-semibold" : "text-slate-500"}>
                Ceil/Vis {tick(state.cielVis)}
              </span>
            </li>
            <li>
              <span className={state.mtnObsc ? "print-keep-color text-amber-700 font-semibold" : "text-slate-500"}>
                Mtn Obsc {tick(state.mtnObsc)}
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* ---- Per-phase environment ---- */}
      <table className="w-full border-collapse text-[8pt] mb-2 break-inside-avoid">
        <thead>
          <tr className="border-b border-slate-400">
            <th className="text-left pr-2 font-medium"></th>
            <th className="text-right pr-2 font-medium">Departure</th>
            <th className="text-right pr-2 font-medium">Operating</th>
            <th className="text-right font-medium">Arrival</th>
          </tr>
        </thead>
        <tbody>
          {ENV_ROWS.map((row) => (
            <tr key={row.label} className="border-b border-slate-200">
              <td className="py-0.5 pr-2">{row.label}</td>
              <td className="py-0.5 pr-2 text-right">{row.fmt(row.read(state, PAs, DAs)[0])}</td>
              <td className="py-0.5 pr-2 text-right">{row.fmt(row.read(state, PAs, DAs)[1])}</td>
              <td className="py-0.5 text-right">{row.fmt(row.read(state, PAs, DAs)[2])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---- TOLD ---- */}
      {state.acType && (
        <table className="w-full border-collapse text-[8pt] mb-2 break-inside-avoid">
          <thead>
            <tr className="border-b border-slate-400">
              <th className="text-left pr-2 font-medium" colSpan={3}>
                Takeoff &amp; Landing ({state.acType})
              </th>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="text-left pr-2 font-medium"></th>
              <th className="text-right pr-2 font-medium">
                {dash(state.airport[0])}
              </th>
              <th className="text-right font-medium">
                {dash(state.airport[1])}
              </th>
            </tr>
          </thead>
          <tbody>
            <TOLDRow
              label="TO Ground Roll"
              dep={told.results?.takeoffGroundRoll.departure ?? null}
              arr={told.results?.takeoffGroundRoll.arrival ?? null}
            />
            <TOLDRow
              label="TO over 50' obstacle"
              dep={told.results?.takeoff50ftObstacle.departure ?? null}
              arr={told.results?.takeoff50ftObstacle.arrival ?? null}
            />
            <TOLDRow
              label="Landing Ground Roll"
              dep={told.results?.landingGroundRoll.departure ?? null}
              arr={told.results?.landingGroundRoll.arrival ?? null}
            />
            <TOLDRow
              label="Landing over 50' obstacle"
              dep={told.results?.landing50ftObstacle.departure ?? null}
              arr={told.results?.landing50ftObstacle.arrival ?? null}
            />
            <TOLDRow
              label="Runway remaining (50' obstacle)"
              dep={told.results?.availableRunwayRemainingTakeoff50ft.departure ?? null}
              arr={told.results?.availableRunwayRemainingTakeoff50ft.arrival ?? null}
              colorNegative
            />
          </tbody>
        </table>
      )}
    </section>
  );
}
