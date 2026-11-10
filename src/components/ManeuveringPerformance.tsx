import type { ManeuveringSpeeds } from "@/utils/types";
import type { Notification } from "@/utils/notifications";
import {
  MANEUVERING_SUBJECT,
  climbSubject,
  describeCanyonTurnEntryRange,
  type CanyonTurnEntryRange,
} from "@/utils/derived";
import InlineNotifications from "@/components/InlineNotifications";
import ValueMarkers from "@/components/ValueMarkers";

interface ManeuveringPerformanceProps {
  aircraftModel?: string;
  maneuveringSpeeds?: ManeuveringSpeeds | null;
  notifications?: readonly Notification[];
  /** Canyon-turn entry airspeed range per flap setting (1.4 × Vso to Va). */
  entryRanges?: readonly CanyonTurnEntryRange[];
  /** All notifications in force, for markers on a range whose Va carries a Caution. */
  inputNotifications?: readonly Notification[];
}

function EntryRange({
  range,
  notes,
}: {
  range: CanyonTurnEntryRange | undefined;
  notes: readonly Notification[];
}) {
  if (!range) return <>—</>;
  const text = describeCanyonTurnEntryRange(range);
  if (range.status === "noVa") {
    return <span className="italic text-gray-500 dark:text-gray-400">{text}</span>;
  }
  // Va's own Cautions (e.g. extrapolated) and those on its inputs.
  const markers = (
    <ValueMarkers
      notifications={notes}
      value={{ status: "computed", dependsOn: [...range.va.dependsOn, climbSubject("va")] }}
    />
  );
  return (
    <>
      {text}
      {markers}
    </>
  );
}

export default function ManeuveringPerformance({
  aircraftModel,
  maneuveringSpeeds,
  notifications = [],
  entryRanges = [],
  inputNotifications = [],
}: ManeuveringPerformanceProps) {
  if (!aircraftModel) return null;

  // Helper function to get speed for a specific flap setting and bank angle
  const getSpeed = (flapSetting: number, bankAngle: number): number | null => {
    if (!maneuveringSpeeds) return null;
    const speedData = maneuveringSpeeds.speeds.find(
      (s) => s.flapSetting === flapSetting && s.bankAngle === bankAngle
    );
    return speedData ? speedData.speed : null;
  };

  // Get flap settings from maneuvering speeds or fallback to default
  const flapSettings = maneuveringSpeeds?.flapSettings || [0, 30];
  const bankAngles = [0, 45, 60];

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">
        Minimum Maneuver/Canyon Turn Speed (kts) ({aircraftModel})
      </h3>
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700">
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
              <th
                className="border border-gray-300 dark:border-gray-700 p-2 text-center"
                rowSpan={2}
              >
                Canyon-turn entry
                <div className="text-xs font-normal">1.4 × Vso to Va</div>
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
            {flapSettings.map((flapSetting, index) => (
              <tr key={flapSetting}>
                {index === 0 && (
                  <th
                    className="border border-gray-300 dark:border-gray-700 p-2 text-center"
                    rowSpan={flapSettings.length}
                  >
                    <div className="transform rotate-270">Flaps</div>
                  </th>
                )}
                <td className="border border-gray-300 dark:border-gray-700 p-2">
                  {flapSetting}&deg;
                </td>
                {bankAngles.map((bankAngle) => {
                  const speed = getSpeed(flapSetting, bankAngle);
                  return (
                    <td
                      key={bankAngle}
                      className="border border-gray-300 dark:border-gray-700 p-2 text-right"
                    >
                      {speed !== null ? speed : "TBD"}
                    </td>
                  );
                })}
                <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
                  <EntryRange
                    range={entryRanges.find((r) => r.flapSetting === flapSetting)}
                    notes={inputNotifications}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <InlineNotifications
          notifications={notifications}
          subject={MANEUVERING_SUBJECT}
          className="mt-2"
        />
      </div>
  );
}
