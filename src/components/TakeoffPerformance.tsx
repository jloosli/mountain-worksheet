interface TakeoffPerformanceProps {
  aircraftModel?: string;
  airports: [string, string]; // [departure, arrival]
}

export default function TakeoffPerformance({
  aircraftModel,
  airports,
}: TakeoffPerformanceProps) {
  if (!aircraftModel) return null;

  const [departureAirport, arrivalAirport] = airports;

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">
        Take Off and Landing Distances (TOLD) ({aircraftModel})
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 px-4 text-left"></th>
              <th
                className="py-2 px-4 text-center border-r dark:border-gray-700"
                colSpan={2}
              >
                Normal Takeoff
              </th>
              <th className="py-2 px-4 text-center" colSpan={2}>
                Short Field Takeoff (over 50&apos; obstacle)
              </th>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 px-4 text-left"></th>
              <th className="py-2 px-4 text-right border-r-0 dark:border-gray-700">
                {departureAirport || "-"}
              </th>
              <th className="py-2 px-4 text-right border-r dark:border-gray-700">
                {arrivalAirport || "-"}
              </th>
              <th className="py-2 px-4 text-right border-r-0 dark:border-gray-700">
                {departureAirport || "-"}
              </th>
              <th className="py-2 px-4 text-right">{arrivalAirport || "-"}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Take Off Grnd Roll</td>
              <td className="py-2 px-4 text-right border-r-0 dark:border-gray-700">
                TBD
              </td>
              <td className="py-2 px-4 text-right border-r dark:border-gray-700">
                TBD
              </td>
              <td className="py-2 px-4 text-right border-r-0 dark:border-gray-700">
                TBD
              </td>
              <td className="py-2 px-4 text-right">TBD</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Landing Grnd Roll</td>
              <td className="py-2 px-4 text-right border-r-0 dark:border-gray-700">
                TBD
              </td>
              <td className="py-2 px-4 text-right border-r dark:border-gray-700">
                TBD
              </td>
              <td className="py-2 px-4 text-right border-r-0 dark:border-gray-700">
                TBD
              </td>
              <td className="py-2 px-4 text-right">TBD</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Available runway remaining</td>
              <td className="py-2 px-4 text-right border-r-0 dark:border-gray-700">
                TBD
              </td>
              <td className="py-2 px-4 text-right border-r dark:border-gray-700">
                TBD
              </td>
              <td className="py-2 px-4 text-right border-r-0 dark:border-gray-700">
                TBD
              </td>
              <td className="py-2 px-4 text-right">TBD</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
