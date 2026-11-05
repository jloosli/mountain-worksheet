import { pressureAltitudeToDensityAltitude } from "@/utils/formulas";
import InlineNotifications from "@/components/InlineNotifications";
import type { Notification, Subject } from "@/utils/notifications";
import {
  COLUMNS,
  type ClimbViewModel,
  type ComputedValue,
  type ServiceCeiling,
} from "@/utils/derived";

interface ClimbPerformanceProps {
  aircraftModel?: string;
  climb: ClimbViewModel;
  OATs?: [number | null, number | null, number | null];
  altimeters?: [number | null, number | null, number | null];
}

const CELL = "py-2 px-4 text-right";
const MUTED = "text-xs italic text-gray-500 dark:text-gray-400";

function Value({ value, className = "" }: { value: ComputedValue; className?: string }) {
  if (value.status === "withheld") {
    return <td className={`${CELL} ${MUTED}`}>{value.reason}</td>;
  }
  if (value.status === "unavailable") {
    return <td className={`${CELL} text-gray-500 dark:text-gray-400`}>—</td>;
  }
  return <td className={`${CELL} ${className}`}>{value.value}</td>;
}

function percentStyle(value: ComputedValue): string {
  if (value.status !== "computed") return "";
  if (value.value > 100) return "text-red-500 font-bold";
  if (value.value >= 90) return "text-yellow-500 font-bold";
  return "";
}

function CeilingCell({
  ceiling,
  oat,
  altimeter,
}: {
  ceiling: ServiceCeiling;
  oat: number | null;
  altimeter: number | null;
}) {
  if (ceiling.status === "aboveTable") {
    return <td className={CELL}>{`> ${ceiling.tableMax.toLocaleString()} ft`}</td>;
  }
  if (ceiling.status !== "computed") return <Value value={ceiling} />;
  const sc = ceiling.value;
  const scPA = Math.round(sc);
  const scDA = oat !== null ? Math.round(pressureAltitudeToDensityAltitude(sc, oat)) : null;
  const title =
    scDA !== null
      ? `Pressure Alt: ${scPA.toLocaleString()} ft\nDensity Alt: ${scDA.toLocaleString()} ft`
      : `Pressure Alt: ${scPA.toLocaleString()} ft`;
  const display =
    altimeter !== null && altimeter >= 28
      ? `${Math.round(sc + (altimeter - 29.92) * 1000).toLocaleString()} ft`
      : `${scPA.toLocaleString()} ft (PA)`;
  return (
    <td className={CELL} title={title}>
      {display}
    </td>
  );
}

/** Every distinct value Subject among the climb notifications, in order. */
function subjectsOf(notifications: readonly Notification[]): Subject[] {
  const seen = new Map<string, Subject>();
  for (const n of notifications) {
    if (n.subject.kind !== "value") continue;
    seen.set(n.subject.id, n.subject);
  }
  return [...seen.values()];
}

export default function ClimbPerformance({
  aircraftModel,
  climb,
  OATs,
  altimeters,
}: ClimbPerformanceProps) {
  if (!aircraftModel) return null;
  const empty = <td className={CELL}></td>;

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">
        Rates of Climb, V Speeds, Ceilings ({aircraftModel})
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 px-4 text-left">Metric</th>
              <th className="py-2 px-4 text-right">Departure</th>
              <th className="py-2 px-4 text-right">Operating</th>
              <th className="py-2 px-4 text-right">Arrival</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Rate of Climb (MGW)</td>
              {COLUMNS.map((i) => <Value key={i} value={climb.rateOfClimb[i]} />)}
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Rate of Climb (Actual Wt, note 11)</td>
              {COLUMNS.map((i) => <Value key={i} value={climb.rateOfClimbActual[i]} />)}
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Vx (Best Angle)</td>
              {COLUMNS.map((i) => <Value key={i} value={climb.vx[i]} />)}
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Vy (Best Rate)</td>
              {COLUMNS.map((i) => <Value key={i} value={climb.vy[i]} />)}
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Va at Actual Weight</td>
              <Value value={climb.va} />
              {empty}
              {empty}
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Vra (Rough Air Speed)</td>
              <Value value={climb.vra} />
              {empty}
              {empty}
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Percent of MGW</td>
              {climb.percentMGW.status === "computed" ? (
                <td className={`${CELL} ${percentStyle(climb.percentMGW)}`}>
                  {`${climb.percentMGW.value}%`}
                </td>
              ) : (
                <Value value={climb.percentMGW} />
              )}
              {empty}
              {empty}
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Service Ceiling (300 ft/min ROC, MSL)</td>
              {COLUMNS.map((i) => (
                <CeilingCell
                  key={i}
                  ceiling={climb.serviceCeiling[i]}
                  oat={OATs?.[i] ?? null}
                  altimeter={altimeters?.[i] ?? null}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-2 space-y-1">
        {subjectsOf(climb.notifications).map((subject) => (
          <InlineNotifications
            key={subject.kind === "value" ? subject.id : ""}
            notifications={climb.notifications}
            subject={subject}
          />
        ))}
      </div>
    </div>
  );
}
