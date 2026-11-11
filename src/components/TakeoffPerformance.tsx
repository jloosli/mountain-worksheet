import React, { useId } from "react";
import InlineNotifications from "./InlineNotifications";
import ValueMarkers from "./ValueMarkers";
import { limitPointClass } from "./LimitCheckCallout";
import type { LimitState } from "@/utils/limitChecks";
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
  /**
   * The Runway Limit check's point state at each airport, which styles the
   * ground-roll runway-remaining cells. The over-50-ft-obstacle column isn't checked.
   */
  runwayStates?: Partial<Record<AirportSlot, LimitState>>;
}

const SLOTS: AirportSlot[] = ["departure", "arrival"];

const ROWS: { label: string; cells: [TOLDValueKey, TOLDValueKey]; checked?: boolean }[] = [
  { label: "Take Off Ground Roll", cells: ["takeoffGroundRoll", "takeoff50ftObstacle"] },
  { label: "Landing Ground Roll", cells: ["landingGroundRoll", "landing50ftObstacle"] },
  {
    label: "Available runway remaining",
    cells: ["runwayRemainingGroundRoll", "runwayRemaining50ft"],
    checked: true,
  },
];

/**
 * One TOLD cell: the value, what it is waiting for, or a dash when it
 * couldn't be computed. `limitState` is the Limit check point state of a value
 * a check evaluates.
 */
function ValueCell({
  value,
  limitState,
  className = "",
  inputNotifications,
}: {
  value: ComputedValue;
  limitState?: LimitState;
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
  return (
    <td className={`${base} ${limitPointClass(limitState)}`}>
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
  runwayStates = {},
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
            {ROWS.map(({ label, cells: [shortField, obstacle], checked }) => (
              <tr key={label} className="border-b dark:border-gray-700">
                <td className="py-2 px-4">{label}</td>
                <ValueCell
                  value={told.departure.values[shortField]}
                  limitState={checked ? runwayStates.departure : undefined}
                  inputNotifications={inputNotifications}
                />
                <ValueCell
                  value={told.arrival.values[shortField]}
                  limitState={checked ? runwayStates.arrival : undefined}
                  className="border-r dark:border-gray-700"
                  inputNotifications={inputNotifications}
                />
                <ValueCell
                  value={told.departure.values[obstacle]}
                  inputNotifications={inputNotifications}
                />
                <ValueCell
                  value={told.arrival.values[obstacle]}
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
