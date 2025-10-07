import type { ManeuveringSpeeds } from "@/utils/types";

interface ManeuveringPerformanceProps {
  aircraftModel?: string;
  maneuveringSpeeds?: ManeuveringSpeeds;
}

export default function ManeuveringPerformance({
  aircraftModel,
  maneuveringSpeeds,
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
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-center"></th>
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-center"></th>
              <th
                className="border border-gray-300 dark:border-gray-700 p-2 text-center"
                colSpan={3}
              >
                Bank Angles
              </th>
            </tr>
            <tr>
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-left"></th>
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-left"></th>
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                0&deg;
              </th>
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                45&deg;
              </th>
              <th className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                60&deg;
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th
                className="border border-gray-300 dark:border-gray-700 p-2 text-center"
                rowSpan={2}
              >
                <div className="transform rotate-270">Flaps</div>
              </th>
              <td className="border border-gray-300 dark:border-gray-700 p-2">
                0&deg;
              </td>
              <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                TBD
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
                30°
              </td>
              <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                TBD
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
