type Triple = [number | null, number | null, number | null];

interface AltitudesProps {
  altitudes: Triple;
  PAs: Triple;
  DAs: Triple;
}

function fmt(v: number | null): string {
  return v === null ? "-" : Math.round(v).toLocaleString();
}

export default function Altitudes({ altitudes, PAs, DAs }: AltitudesProps) {
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
          <td className="border border-gray-300 dark:border-gray-700 p-2">Actual Altitude (feet)</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(altitudes[0])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(altitudes[1])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(altitudes[2])}</td>
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">Pressure Altitude (feet)</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(PAs[0])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(PAs[1])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(PAs[2])}</td>
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">Density Altitude (feet)</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(DAs[0])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(DAs[1])}</td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">{fmt(DAs[2])}</td>
        </tr>
      </tbody>
    </table>
  );
}
