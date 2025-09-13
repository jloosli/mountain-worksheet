interface AltitudesProps {
    departureActual: number | null;
  departurePA: number | null;
  departureDA: number | null;
  altitudeActual: number | null;
  altitudePA: number | null;
  altitudeDA: number | null;
  arrivalActual: number | null;
  arrivalPA: number | null;
  arrivalDA: number | null;
}

export default function Altitudes({
    departureActual,
  departurePA,
  departureDA,
  altitudeActual,
  altitudePA,
  altitudeDA,
  arrivalActual,
  arrivalPA,
  arrivalDA,
}: AltitudesProps) {
  return (
    <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700">
      <thead>
        <tr>
          <th className="border border-gray-300 dark:border-gray-700 p-2">
            Altitudes
          </th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">
            Departure
          </th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">
            Operating
          </th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">
            Arrival
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">
            Actual Altitude (feet)
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {departureActual ? Math.round(departureActual).toLocaleString() : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {altitudeActual ? Math.round(altitudeActual).toLocaleString() : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {arrivalActual ? Math.round(arrivalActual).toLocaleString() : "-"}
          </td>
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">
            Pressure Altitude (feet)
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {departurePA ? Math.round(departurePA).toLocaleString() : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {altitudePA ? Math.round(altitudePA).toLocaleString() : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {arrivalPA ? Math.round(arrivalPA).toLocaleString() : "-"}
          </td>
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">
            Density Altitude (feet)
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {departureDA ? Math.round(departureDA).toLocaleString() : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {altitudeDA ? Math.round(altitudeDA).toLocaleString() : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {arrivalDA ? Math.round(arrivalDA).toLocaleString() : "-"}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
