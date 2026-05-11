import React from "react";
import TOLDErrorDisplay from "./TOLDErrorDisplay";
import TOLDFallbackDisplay from "./TOLDFallbackDisplay";
import type { TOLDViewModel } from "@/utils/derived";

interface TakeoffPerformanceProps {
  aircraftModel?: string;
  airports: [string, string]; // [departure, arrival]
  toldData?: TOLDViewModel;
}

export default function TakeoffPerformance({
  aircraftModel,
  airports,
  toldData,
}: TakeoffPerformanceProps) {
  if (!aircraftModel) return null;

  // Check if we should show fallback display
  const shouldShowFallback = () => {
    if (!toldData) return true;

    // Check for aircraft not found errors
    const hasAircraftNotFoundError = toldData.errors.some(
      (error) => error.type === "aircraft_not_found"
    );

    // Check for missing data errors
    const hasMissingDataError = toldData.errors.some(
      (error) => error.type === "missing_data"
    );

    // Check if calculation failed completely
    const hasCalculationFailed = toldData.errors.some(
      (error) => error.type === "calculation_failed"
    );

    return (
      hasAircraftNotFoundError || hasMissingDataError || hasCalculationFailed
    );
  };

  // Show fallback display if needed
  if (shouldShowFallback()) {
    const getFallbackReason = ():
      | "no-aircraft"
      | "no-data"
      | "calculation-failed" => {
      if (!toldData) return "calculation-failed";

      if (
        toldData.errors.some((error) => error.type === "aircraft_not_found")
      ) {
        return "no-aircraft";
      }

      if (toldData.errors.some((error) => error.type === "missing_data")) {
        return "no-data";
      }

      return "calculation-failed";
    };

    return (
      <TOLDFallbackDisplay
        aircraftModel={aircraftModel}
        airports={airports}
        reason={getFallbackReason()}
      />
    );
  }

  const [departureAirport, arrivalAirport] = airports;

  // Helper function to format numbers with commas
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "TBD";
    return value.toLocaleString();
  };

  // Helper function to get display value with error states
  const getDisplayValue = (
    value: number | null | undefined,
    hasErrors: boolean,
  ): string => {
    if (hasErrors) return "Error";
    return formatNumber(value);
  };

  // Helper function to get CSS classes for conditional styling
  const getCellClasses = (
    value: number | null | undefined,
    hasErrors: boolean,
  ): string => {
    const baseClasses = "py-2 px-4 text-right";
    if (hasErrors) return `${baseClasses} text-red-600 dark:text-red-400`;
    if (value === null || value === undefined)
      return `${baseClasses} text-gray-500 dark:text-gray-400`;
    return baseClasses;
  };

  // Helper function to get CSS classes for available runway remaining cells
  // Shows red text for negative values
  const getAvailableRunwayCellClasses = (
    value: number | null | undefined,
    hasErrors: boolean,
  ): string => {
    const baseClasses = "py-2 px-4 text-right";
    if (hasErrors) return `${baseClasses} text-red-600 dark:text-red-400`;
    if (value === null || value === undefined)
      return `${baseClasses} text-gray-500 dark:text-gray-400`;
    if (value < 0) return `${baseClasses} text-red-600 dark:text-red-400`;
    return baseClasses;
  };

  // Extract TOLD data
  const results = toldData?.results;
  const hasErrors = toldData?.hasErrors || false;

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">
        Take Off and Landing Distances (TOLD) ({aircraftModel})
      </h3>

      {/* Error and Warning Display */}
      {toldData && (
        <TOLDErrorDisplay
          errors={toldData.errors}
          warnings={toldData.warnings}
          extrapolationWarnings={toldData.extrapolationWarnings}
        />
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse">
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
              <td className="py-2 px-4">Take Off Ground Roll</td>
              <td
                className={
                  getCellClasses(
                    results?.takeoffGroundRoll.departure,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.takeoffGroundRoll.departure,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.takeoffGroundRoll.arrival,
                    hasErrors
                  ) + " border-r dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.takeoffGroundRoll.arrival,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.takeoff50ftObstacle.departure,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.takeoff50ftObstacle.departure,
                  hasErrors
                )}
              </td>
              <td
                className={getCellClasses(
                  results?.takeoff50ftObstacle.arrival,
                  hasErrors
                )}
              >
                {getDisplayValue(
                  results?.takeoff50ftObstacle.arrival,
                  hasErrors
                )}
              </td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Landing Ground Roll</td>
              <td
                className={
                  getCellClasses(
                    results?.landingGroundRoll.departure,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.landingGroundRoll.departure,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.landingGroundRoll.arrival,
                    hasErrors
                  ) + " border-r dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.landingGroundRoll.arrival,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.landing50ftObstacle.departure,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.landing50ftObstacle.departure,
                  hasErrors
                )}
              </td>
              <td
                className={getCellClasses(
                  results?.landing50ftObstacle.arrival,
                  hasErrors
                )}
              >
                {getDisplayValue(
                  results?.landing50ftObstacle.arrival,
                  hasErrors
                )}
              </td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Available runway remaining</td>
              <td
                className={
                  getAvailableRunwayCellClasses(
                    results?.availableRunwayRemainingTakeoffGroundRoll
                      .departure,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.availableRunwayRemainingTakeoffGroundRoll.departure,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getAvailableRunwayCellClasses(
                    results?.availableRunwayRemainingTakeoffGroundRoll.arrival,
                    hasErrors
                  ) + " border-r dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.availableRunwayRemainingTakeoffGroundRoll.arrival,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getAvailableRunwayCellClasses(
                    results?.availableRunwayRemainingTakeoff50ft.departure,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.availableRunwayRemainingTakeoff50ft.departure,
                  hasErrors
                )}
              </td>
              <td
                className={getAvailableRunwayCellClasses(
                  results?.availableRunwayRemainingTakeoff50ft.arrival,
                  hasErrors
                )}
              >
                {getDisplayValue(
                  results?.availableRunwayRemainingTakeoff50ft.arrival,
                  hasErrors
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
