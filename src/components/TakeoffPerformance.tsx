import React, { useId } from "react";
import InlineNotifications from "./InlineNotifications";
import { valueSubject } from "@/utils/notifications";
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
}: {
  value: ComputedValue;
  margin?: boolean;
  className?: string;
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
    </td>
  );
}

export default function TakeoffPerformance({
  aircraftModel,
  airports,
  told,
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
                <ValueCell value={told.departure.values[shortField]} margin={margin} />
                <ValueCell
                  value={told.arrival.values[shortField]}
                  margin={margin}
                  className="border-r dark:border-gray-700"
                />
                <ValueCell value={told.departure.values[obstacle]} margin={margin} />
                <ValueCell value={told.arrival.values[obstacle]} margin={margin} />
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
