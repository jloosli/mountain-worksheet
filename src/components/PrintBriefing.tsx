import type { WorksheetData } from "@/utils/types";
import {
  COLUMNS,
  climbSubject,
  computeCanyonTurnEntryRanges,
  computeClimbViewModel,
  computePressureColumns,
  describeCanyonTurnEntryRange,
  pressureColumnValue,
  computeTOLDViewModel,
  pressureColumnDependsOn,
  toldValueSubjects,
  type AirportSlot,
  type CanyonTurnEntryRange,
  type ComputedValue,
  type TOLDValueKey,
  type Triple,
} from "@/utils/derived";
import { calculateManeuveringSpeeds } from "@/utils/maneuveringCalculations";
import { enteredPosition } from "@/utils/areaOfOpsWeather";
import {
  fieldSubject,
  valueSubject,
  type FieldName,
  type Notification,
} from "@/utils/notifications";
import {
  briefingNotes,
  type BriefingNote,
  type BriefingNotes,
  type BriefingSection,
} from "@/utils/briefingNotes";

interface PrintBriefingProps {
  state: WorksheetData;
  /**
   * All notifications in force (the same derived list the screen shows).
   * Warnings and Cautions are printed next to the values they concern;
   * Advisories are left off.
   */
  notifications?: readonly Notification[];
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

/** Reference numbers of the notes a value concerns (or rests on), as a superscript. */
function Refs({ refs }: { refs: readonly number[] }) {
  if (refs.length === 0) return null;
  return (
    <sup className="ml-0.5 text-[6.5pt] font-semibold">
      {refs.map((r, i) => (
        <span key={r} data-ref={r}>
          {i > 0 ? "," : ""}
          {r}
        </span>
      ))}
    </sup>
  );
}

const LEVEL_LABEL = { warning: "Warning", caution: "Caution" } as const;
const LEVEL_CLASS = {
  warning: "print-keep-color text-red-700",
  caution: "print-keep-color text-amber-700",
} as const;

/** The numbered Warnings and Cautions printed under one section. */
function Notes({ notes }: { notes: readonly BriefingNote[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="mb-2 -mt-1 space-y-0.5 text-[7.5pt]">
      {notes.map((n) => (
        <li key={n.ref} data-ref={n.ref} data-level={n.level}>
          <span className="font-semibold">{n.ref}.</span>{" "}
          <span className={`font-semibold ${LEVEL_CLASS[n.level]}`}>
            {LEVEL_LABEL[n.level]}:
          </span>{" "}
          <span data-message>{n.message}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A computed value: its number with the references of the notes about it and
 * of the Cautions it rests on; what it is waiting for when withheld; a dash
 * (with the Warning's reference) when it couldn't be computed.
 */
function ValueCell({
  value,
  refs,
  briefing,
  format = fmtNum,
  className = "py-0.5 pr-2 text-right",
  colorNegative,
}: {
  value: ComputedValue;
  refs: number[];
  briefing: BriefingNotes;
  format?: (v: number) => string;
  className?: string;
  colorNegative?: boolean;
}) {
  if (value.status === "withheld") {
    return <td className={`${className} italic text-slate-600`}>{value.reason}</td>;
  }
  if (value.status === "unavailable") {
    return (
      <td className={className}>
        —<Refs refs={refs} />
      </td>
    );
  }
  const bad = colorNegative && value.value < 0;
  const all = [...new Set([...refs, ...briefing.markersOn(value)])].sort((a, b) => a - b);
  return (
    <td
      className={
        bad ? `${className} print-keep-color print-margin-bad text-red-700 font-semibold` : className
      }
    >
      {format(value.value)}
      <Refs refs={all} />
    </td>
  );
}

/**
 * A canyon-turn entry range cell. Refs point to Va's own notes (a Warning when
 * it can't be computed, a Caution when extrapolated) and its inputs' Cautions.
 */
function EntryCell({
  range,
  briefing,
}: {
  range: CanyonTurnEntryRange | undefined;
  briefing: BriefingNotes;
}) {
  if (!range) return <td className="py-0.5 text-right">—</td>;
  const refs = [
    ...new Set([
      ...briefing.refsOn(climbSubject("va")),
      ...(range.status === "noVa" ? [] : briefing.markersOn(range.va)),
    ]),
  ].sort((x, y) => x - y);
  return (
    <td className={range.status === "noVa" ? "py-0.5 text-right italic text-slate-600" : "py-0.5 text-right"}>
      {describeCanyonTurnEntryRange(range)}
      <Refs refs={refs} />
    </td>
  );
}

const ENV_ROWS: ReadonlyArray<{
  label: string;
  field: "altitude" | "temp" | "altimeter";
  fmt: (v: number | null) => string;
}> = [
  { label: "Actual Altitude (ft)", field: "altitude", fmt: fmtFt },
  { label: "OAT (°C)", field: "temp", fmt: fmtNum },
  {
    label: "Altimeter (inHg)",
    field: "altimeter",
    fmt: (v) => (v === null ? "—" : v.toFixed(2)),
  },
];

const SLOTS: AirportSlot[] = ["departure", "arrival"];

const TOLD_ROWS: ReadonlyArray<{
  label: string;
  key: TOLDValueKey;
  colorNegative?: boolean;
}> = [
  { label: "TO Ground Roll", key: "takeoffGroundRoll" },
  { label: "TO over 50' obstacle", key: "takeoff50ftObstacle" },
  { label: "Landing Ground Roll", key: "landingGroundRoll" },
  { label: "Landing over 50' obstacle", key: "landing50ftObstacle" },
  { label: "Runway remaining (50' obstacle)", key: "runwayRemaining50ft", colorNegative: true },
];

export default function PrintBriefing({ state, notifications = [] }: PrintBriefingProps) {
  const [dep, arr] = state.airport;
  const entered = enteredPosition(state.position);
  const position = entered
    ? `${entered[0].toFixed(2)}, ${entered[1].toFixed(2)}`
    : "—";

  const { PAs, DAs } = computePressureColumns(
    state.altitude,
    state.altimeter,
    state.temp,
  );
  const told = computeTOLDViewModel(state, PAs, notifications);
  const climb = computeClimbViewModel(state, notifications);
  const b = briefingNotes(notifications);
  const notesIn = (section: BriefingSection) => <Notes notes={b.inSection(section)} />;
  const on = (field: FieldName, index?: number) => <Refs refs={b.refsOn(fieldSubject(field, index))} />;

  /**
   * A pressure/density-altitude cell, marked when its inputs carry a Caution
   * and withheld when one carries a Warning.
   */
  const altitudeCell = (values: Triple, col: 0 | 1 | 2, kind: "pressureAltitude" | "densityAltitude") => {
    const value = pressureColumnValue(values, col, kind, notifications);
    if (value.status === "withheld") {
      return <span className="italic text-slate-600">{value.reason}</span>;
    }
    const v = values[col];
    const refs =
      v === null
        ? []
        : b.markersOn({ status: "computed", dependsOn: pressureColumnDependsOn(col)[kind] });
    return (
      <>
        {fmtFt(v)}
        <Refs refs={refs} />
      </>
    );
  };

  const climbCells = (row: "rateOfClimb" | "rateOfClimbActual" | "vx" | "vy", label: string) => (
    <tr className="border-b border-slate-200">
      <td className="py-0.5 pr-2">{label}</td>
      {COLUMNS.map((col) => (
        <ValueCell
          key={col}
          value={climb[row][col]}
          refs={b.refsOn(climbSubject(row, col), climbSubject(row))}
          briefing={b}
          className={col === 2 ? "py-0.5 text-right" : "py-0.5 pr-2 text-right"}
        />
      ))}
    </tr>
  );
  const singleClimbRow = (
    row: "va" | "vra" | "percentMGW",
    label: string,
    format: (v: number) => string = fmtNum,
  ) => (
    <tr className="border-b border-slate-200">
      <td className="py-0.5 pr-2">{label}</td>
      <ValueCell
        value={climb[row]}
        refs={b.refsOn(climbSubject(row))}
        briefing={b}
        format={format}
      />
      <td className="py-0.5 pr-2 text-right"></td>
      <td className="py-0.5 text-right"></td>
    </tr>
  );

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
        {on("pilot")}
        <span className="mx-2">·</span>
        <span className="font-semibold">AC:</span>{" "}
        <span>{dash(state.acType)}</span>
        {on("acType")} / <span>{dash(state.tailN)}</span>
        {on("tailN")}
        <span className="mx-2">·</span>
        <span data-field="weight">
          <span className="font-semibold">Weight:</span>{" "}
          {state.weight !== null ? `${state.weight.toLocaleString()} lbs` : "—"}
          {on("weight")}
        </span>
        <span className="mx-2">·</span>
        <span className="font-semibold">UTC:</span>{" "}
        <span>{dash(state.date)}</span>
        {on("date")}{" "}
        <span>{dash(state.time)}</span>
        {on("time")}
        <span className="mx-2">·</span>
        <span className="font-semibold">Duration:</span>{" "}
        <span>{state.duration !== null ? `${state.duration} h` : "—"}</span>
        {on("duration")}
        <span className="mx-2">·</span>
        <span>Mtn Endorse {tick(state.mtnEndorse)}</span>
        <span className="mx-2">·</span>
        <span>Mtn Cert {tick(state.mtnCert)}</span>
      </div>

      <div className="mb-2">
        <span className="font-semibold">Route:</span>{" "}
        <span>{dash(dep)}</span>
        {on("airport", 0)} →{" "}
        <span>{dash(arr)}</span>
        {on("airport", 1)}
        <Refs refs={b.refsOn(fieldSubject("airport"))} />
        <span className="mx-2">·</span>
        <span className="font-semibold">Area:</span>{" "}
        <span>{dash(state.route)}</span>
        {on("route")}
        <span className="mx-2">·</span>
        <span className="font-semibold">Position:</span>{" "}
        <span>{position}</span>
        {on("position")}
      </div>
      {notesIn("sortie")}

      {/* ---- Conditions ---- */}
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-x-4 break-inside-avoid">
        <div>
          <div className="font-semibold mb-0.5">
            Winds aloft
            {on("wind")}
          </div>
          <table className="w-full border-collapse text-[8pt]">
            <thead>
              <tr className="border-b border-slate-400">
                <th className="text-left pr-2 font-medium"></th>
                {WIND_LABELS.map((label, colIdx) => (
                  <th key={label} className="text-right pr-2 font-medium last:pr-0">
                    {label}
                    {on("wind", colIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["Dir", "Vel", "Temp"] as const).map((rowLabel, rowIdx) => (
                <tr key={rowLabel} className="border-b border-slate-200">
                  <td className="py-0.5 pr-2">{rowLabel}</td>
                  {WIND_LABELS.map((altLabel, colIdx) => (
                    <td
                      key={altLabel}
                      className="py-0.5 pr-2 text-right last:pr-0"
                    >
                      {dash(state.wind[rowIdx][colIdx] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="self-start">
          <div className="font-semibold mb-0.5">AIRMETs</div>
          <ul className="space-y-0.5 text-[8pt]">
            <li>
              <span className={state.turb ? "print-keep-color text-amber-700 font-semibold" : "text-slate-500"}>
                Turb {tick(state.turb)}
              </span>
              {on("turb")}
            </li>
            <li>
              <span className={state.cielVis ? "print-keep-color text-amber-700 font-semibold" : "text-slate-500"}>
                Ceil/Vis {tick(state.cielVis)}
              </span>
              {on("cielVis")}
            </li>
            <li>
              <span className={state.mtnObsc ? "print-keep-color text-amber-700 font-semibold" : "text-slate-500"}>
                Mtn Obsc {tick(state.mtnObsc)}
              </span>
              {on("mtnObsc")}
            </li>
          </ul>
        </div>
      </div>
      {notesIn("conditions")}

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
              {COLUMNS.map((col) => (
                <td key={col} className={col === 2 ? "py-0.5 text-right" : "py-0.5 pr-2 text-right"}>
                  {row.fmt(state[row.field][col])}
                  {on(row.field, col)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-b border-slate-200">
            <td className="py-0.5 pr-2">Pressure Alt (ft)</td>
            {COLUMNS.map((col) => (
              <td key={col} className={col === 2 ? "py-0.5 text-right" : "py-0.5 pr-2 text-right"}>
                {altitudeCell(PAs, col, "pressureAltitude")}
              </td>
            ))}
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-0.5 pr-2">Density Alt (ft)</td>
            {COLUMNS.map((col) => (
              <td key={col} className={col === 2 ? "py-0.5 text-right" : "py-0.5 pr-2 text-right"}>
                {altitudeCell(DAs, col, "densityAltitude")}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {notesIn("environment")}

      {!state.acType && (
        <p className="text-[8pt] italic text-slate-700 mb-2">
          Select an aircraft model to print performance.
        </p>
      )}
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
            {TOLD_ROWS.map(({ label, key, colorNegative }) => (
              <tr key={key} className="border-b border-slate-200">
                <td className="py-0.5 pr-2">{label}</td>
                {SLOTS.map((slot) => (
                  <ValueCell
                    key={slot}
                    value={told[slot].values[key]}
                    refs={b.refsOn(...toldValueSubjects(slot, key))}
                    briefing={b}
                    format={fmtFt}
                    colorNegative={colorNegative}
                    className={slot === "arrival" ? "py-0.5 text-right" : "py-0.5 pr-2 text-right"}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {notesIn("told")}
      {/* ---- Climb + V-speeds ---- */}
      {state.acType && (
        <table className="w-full border-collapse text-[8pt] mb-2 break-inside-avoid">
          <thead>
            <tr className="border-b border-slate-400">
              <th className="text-left pr-2 font-medium" colSpan={4}>
                Climb &amp; V-speeds ({state.acType})
              </th>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="text-left pr-2 font-medium"></th>
              <th className="text-right pr-2 font-medium">Dep</th>
              <th className="text-right pr-2 font-medium">Op</th>
              <th className="text-right font-medium">Arr</th>
            </tr>
          </thead>
          <tbody>
            {climbCells("rateOfClimb", "Rate of Climb (MGW)")}
            {climbCells("rateOfClimbActual", "Rate of Climb (Actual wt)")}
            {climbCells("vx", "Vx")}
            {climbCells("vy", "Vy")}
            {singleClimbRow("va", "Va (actual weight)")}
            {singleClimbRow("vra", "Vra")}
            {singleClimbRow("percentMGW", "% MGW", (v) => `${v}%`)}
          </tbody>
        </table>
      )}
      {notesIn("climb")}

      {/* ---- Maneuvering / canyon-turn speeds ---- */}
      {(() => {
        if (!state.acType) return null;
        const ms = calculateManeuveringSpeeds(state.acType);
        if (!ms) return null;
        const banks = [0, 45, 60];
        const entryRanges = computeCanyonTurnEntryRanges(ms, climb.va);
        return (
          <table className="w-full border-collapse text-[8pt] mb-2 break-inside-avoid">
            <thead>
              <tr className="border-b border-slate-400">
                <th className="text-left pr-2 font-medium" colSpan={5}>
                  Maneuvering speeds (kts) ({state.acType})
                  <Refs refs={b.refsOn(valueSubject("maneuvering", "decision"))} />
                </th>
              </tr>
              <tr className="border-b border-slate-300">
                <th className="text-left pr-2 font-medium">Flaps</th>
                {banks.map((bank) => (
                  <th key={bank} className="text-right pr-2 font-medium">
                    {bank}°
                  </th>
                ))}
                <th className="text-right font-medium">Canyon-turn entry (1.4 × Vso–Va)</th>
              </tr>
            </thead>
            <tbody>
              {ms.flapSettings.map((flap) => (
                <tr key={flap} className="border-b border-slate-200">
                  <td className="py-0.5 pr-2">{flap}°</td>
                  {banks.map((bank) => {
                    const found = ms.speeds.find(
                      (s) => s.flapSetting === flap && s.bankAngle === bank,
                    );
                    return (
                      <td key={bank} className="py-0.5 pr-2 text-right">
                        {fmtNum(found ? found.speed : null)}
                      </td>
                    );
                  })}
                  <EntryCell
                    range={entryRanges.find((r) => r.flapSetting === flap)}
                    briefing={b}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}
      {notesIn("maneuvering")}
      {notesIn("general")}

      <footer className="border-t border-slate-400 pt-1 mt-1 text-[7pt] text-slate-700 flex justify-between">
        <span>
          For reference only — PIC and FRO are responsible for the go/no-go
          decision.
        </span>
        <span>mountain-worksheet.vercel.app</span>
      </footer>
    </section>
  );
}
