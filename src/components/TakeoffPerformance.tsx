import React, { useId } from "react";
import InlineNotifications from "./InlineNotifications";
import ValueMarkers from "./ValueMarkers";
import { valueSubject, type Notification } from "@/utils/notifications";
import {
  toldSubject,
  type AirportSlot,
  type ComputedValue,
  type TOLDValueKey,
  type TOLDViewModel,
} from "@/utils/derived";

interface TakeoffPerformanceProps {
  aircraftModel?: string;
  airports: [string, string]; // [departure, arrival]
  told: TOLDViewModel;
  /** All notifications in force, for markers on values whose inputs carry a Caution. */
  inputNotifications?: readonly Notification[];
}

const SLOTS: AirportSlot[] = ["departure", "arrival"];

const ROWS: { label: string; cells: [TOLDValueKey, TOLDValueKey]; margin?: boolean }[] = [
  { label: "Take Off Ground Roll", cells: ["takeoffGroundRoll", "takeoff50ftObstacle"] },
  { label: "Landing Ground Roll", cells: ["landingGroundRoll", "landing50ftObstacle"] },
  {
    label: "Available runway remaining",
    cells: ["runwayRemainingGroundRoll", "runwayRemaining50ft"],
    margin: true,
  },
];

/** One TOLD cell: the value, what it is waiting for, or a dash when it couldn't be computed. */
function ValueCell({
  value,
  margin,
  className = "",
  inputNotifications,
}: {
  value: ComputedValue;
  margin?: boolean;
  className?: string;
  inputNotifications: readonly Notification[];
}) {
  const base = `py-2 px-4 text-right ${className}`;
  if (value.status === "withheld") {
    return (
      <td className={`${base} text-xs italic text-gray-500 dark:text-gray-400`}>
        {value.reason}
      </td>
    );
  }
  if (value.status === "unavailable") {
    return <td className={`${base} text-gray-500 dark:text-gray-400`}>—</td>;
  }
  const negative = margin && value.value < 0;
  return (
    <td className={`${base} ${negative ? "text-red-600 dark:text-red-400" : ""}`}>
      {value.value.toLocaleString()}
      <ValueMarkers notifications={inputNotifications} value={value} />
    </td>
  );
}

export default function TakeoffPerformance({
  aircraftModel,
  airports,
  told,
  inputNotifications = [],
}: TakeoffPerformanceProps) {
  const headingId = useId();
  if (!aircraftModel) return null;

  const [departureAirport, arrivalAirport] = airports;
  const notifications = told.notifications;

  return (
    <div className="mt-6">
      <h3 id={headingId} className="text-xl font-semibold mb-4">
        Take Off and Landing Distances (TOLD) ({aircraftModel})
      </h3>

      <div className="overflow-x-auto">
        <table aria-labelledby={headingId} className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 px-4 text-left"></th>
              <th
                className="py-2 px-4 text-center border-r dark:border-gray-700"
                colSpan={2}
              >
                Short Field
              </th>
              <th className="py-2 px-4 text-center" colSpan={2}>
                Short Field Over 50&apos; Obstacle
              </th>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 px-4 text-left"></th>
              <th className="py-2 px-4 text-right">{departureAirport || "-"}</th>
              <th className="py-2 px-4 text-right border-r dark:border-gray-700">
                {arrivalAirport || "-"}
              </th>
              <th className="py-2 px-4 text-right">{departureAirport || "-"}</th>
              <th className="py-2 px-4 text-right">{arrivalAirport || "-"}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ label, cells: [shortField, obstacle], margin }) => (
              <tr key={label} className="border-b dark:border-gray-700">
                <td className="py-2 px-4">{label}</td>
                <ValueCell
                  value={told.departure.values[shortField]}
                  margin={margin}
                  inputNotifications={inputNotifications}
                />
                <ValueCell
                  value={told.arrival.values[shortField]}
                  margin={margin}
                  className="border-r dark:border-gray-700"
                  inputNotifications={inputNotifications}
                />
                <ValueCell
                  value={told.departure.values[obstacle]}
                  margin={margin}
                  inputNotifications={inputNotifications}
                />
                <ValueCell
                  value={told.arrival.values[obstacle]}
                  margin={margin}
                  inputNotifications={inputNotifications}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Airport-, takeoff- and landing-level notifications; input notifications show at their inputs. */}
      <div className="mt-2 space-y-1">
        {SLOTS.flatMap((slot) => [
          <InlineNotifications
            key={slot}
            notifications={notifications}
            subject={valueSubject(`told.${slot}`, "decision")}
          />,
          <InlineNotifications
            key={`${slot}.takeoff`}
            notifications={notifications}
            subject={toldSubject(slot, "takeoff")}
          />,
          <InlineNotifications
            key={`${slot}.landing`}
            notifications={notifications}
            subject={toldSubject(slot, "landing")}
          />,
        ])}
      </div>
    </div>
  );
}
