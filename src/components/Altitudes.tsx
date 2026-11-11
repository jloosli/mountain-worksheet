import ValueMarkers from "@/components/ValueMarkers";
import { pressureColumnDependsOn, pressureColumnValue } from "@/utils/derived";
import type { Notification } from "@/utils/notifications";

type Triple = [number | null, number | null, number | null];

interface AltitudesProps {
  altitudes: Triple;
  PAs: Triple;
  DAs: Triple;
  /**
   * All notifications in force: an altitude computed from an input with a
   * Warning is withheld, one from an input with a Caution is marked.
   */
  notifications?: readonly Notification[];
}

const COLS = [0, 1, 2] as const;
const CELL = "border border-gray-300 dark:border-gray-700 p-2 text-right";

function fmt(v: number | null): string {
  return v === null ? "-" : Math.round(v).toLocaleString();
}

export default function Altitudes({ altitudes, PAs, DAs, notifications = [] }: AltitudesProps) {
  const cell = (values: Triple, i: 0 | 1 | 2, kind: "pressureAltitude" | "densityAltitude") => {
    const value = pressureColumnValue(values, i, kind, notifications);
    if (value.status === "withheld") {
      return <span className="italic text-slate-500">{value.reason}</span>;
    }
    return (
      <>
        {fmt(values[i])}
        {values[i] !== null && (
          <ValueMarkers
            notifications={notifications}
            value={{ status: "computed", dependsOn: pressureColumnDependsOn(i)[kind] }}
          />
        )}
      </>
    );
  };
  return (
    <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700">
      <thead>
        <tr>
          <th className="border border-gray-300 dark:border-gray-700 p-2">Altitudes</th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">Departure</th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">Operating</th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">Arrival</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">
            Actual Altitude (feet)
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {fmt(altitudes[0])}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {fmt(altitudes[1])}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {fmt(altitudes[2])}
          </td>
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">
            Pressure Altitude (feet)
          </td>
          {COLS.map((i) => (
            <td key={i} className={CELL}>
              {cell(PAs, i, "pressureAltitude")}
            </td>
          ))}
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">
            Density Altitude (feet)
          </td>
          {COLS.map((i) => (
            <td key={i} className={CELL}>
              {cell(DAs, i, "densityAltitude")}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
