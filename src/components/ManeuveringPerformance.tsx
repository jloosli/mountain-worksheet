interface ManeuveringPerformanceProps {
  aircraftModel?: string;
}

export default function ManeuveringPerformance({
  aircraftModel,
}: ManeuveringPerformanceProps) {
  if (!aircraftModel) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">
        Maneuver/Canyon Turn Speed (kts) ({aircraftModel})
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse border border-gray-300 dark:border-gray-700">
          <thead>
            <tr>
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-left"></th>
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                Min
              </th>
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                Max
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 dark:border-gray-700 p-2">
                Zero Flaps
              </td>
              <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                TBD
              </td>
              <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                TBD
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 dark:border-gray-700 p-2">
                10° Flaps
              </td>
              <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                TBD
              </td>
              <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                TBD
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 dark:border-gray-700 p-2">
                20° Flaps
              </td>
              <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                TBD
              </td>
              <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                TBD
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
