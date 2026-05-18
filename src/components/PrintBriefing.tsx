import type { WorksheetData } from "@/utils/types";

interface PrintBriefingProps {
  state: WorksheetData;
}

const dash = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  return String(v);
};

const tick = (v: boolean): string => (v ? "✓" : "✗");

export default function PrintBriefing({ state }: PrintBriefingProps) {
  const [dep, arr] = state.airport;
  const [lat, lon] = state.position;
  const position =
    lat !== null && lon !== null
      ? `${lat.toFixed(2)}, ${lon.toFixed(2)}`
      : "—";

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
    </section>
  );
}
