import React from "react";
import TOLDErrorDisplay from "./TOLDErrorDisplay";
import TOLDFallbackDisplay from "./TOLDFallbackDisplay";
import type { TOLDError } from "@/utils/types";

interface TakeoffPerformanceProps {
  aircraftModel?: string;
  airports: [string, string]; // [departure, arrival]
  toldData?: {
    results: {
      takeoffGroundRoll: { departure: number | null; arrival: number | null };
      takeoff50ftObstacle: { departure: number | null; arrival: number | null };
      landingGroundRoll: { departure: number | null; arrival: number | null };
      landing50ftObstacle: { departure: number | null; arrival: number | null };
      availableRunwayRemainingTakeoffGroundRoll: {
        departure: number | null;
        arrival: number | null;
      };
      availableRunwayRemainingTakeoff50ft: {
        departure: number | null;
        arrival: number | null;
      };
    } | null;
    status: string;
    errors: TOLDError[];
    warnings: TOLDError[];
    extrapolationWarnings: TOLDError[];
    isCalculating: boolean;
    errorSummary: {
      count: number;
      critical: number;
      warnings: number;
      messages: string[];
    } | null;
    warningSummary: {
      count: number;
      validation: number;
      extrapolation: number;
      messages: string[];
    } | null;
    hasErrors: boolean;
    hasWarnings: boolean;
    retryCalculation: () => void;
    clearErrors: () => void;
  };
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
        onRetry={toldData?.retryCalculation}
      />
    );
  }

  const [departureAirport, arrivalAirport] = airports;

  // Helper function to format numbers with commas
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "TBD";
    return value.toLocaleString();
  };

  // Helper function to get display value with loading/error states
  const getDisplayValue = (
    value: number | null | undefined,
    isCalculating: boolean,
    hasErrors: boolean
  ): string => {
    if (isCalculating) return "Calculating...";
    if (hasErrors) return "Error";
    return formatNumber(value);
  };

  // Helper function to get CSS classes for conditional styling
  const getCellClasses = (
    value: number | null | undefined,
    isCalculating: boolean,
    hasErrors: boolean
  ): string => {
    const baseClasses = "py-2 px-4 text-right";
    if (isCalculating) return `${baseClasses} text-blue-600 dark:text-blue-400`;
    if (hasErrors) return `${baseClasses} text-red-600 dark:text-red-400`;
    if (value === null || value === undefined)
      return `${baseClasses} text-gray-500 dark:text-gray-400`;
    return baseClasses;
  };

  // Debug information
  const debugInfo = toldData
    ? {
        hasResults: !!toldData.results,
        isCalculating: toldData.isCalculating,
        hasErrors: toldData.hasErrors,
        status: toldData.status,
      }
    : {
        hasResults: false,
        isCalculating: false,
        hasErrors: false,
        status: "no-data",
      };

  // Extract TOLD data
  const results = toldData?.results;
  const isCalculating = toldData?.isCalculating || false;
  const hasErrors = toldData?.hasErrors || false;

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">
        Take Off and Landing Distances (TOLD) ({aircraftModel})
      </h3>

      {/* Debug information */}
      <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
        <strong>Debug Info:</strong> {JSON.stringify(debugInfo)}
      </div>

      {/* Error and Warning Display */}
      {toldData && (
        <TOLDErrorDisplay
          errors={toldData.errors}
          warnings={toldData.warnings}
          extrapolationWarnings={toldData.extrapolationWarnings}
          onRetry={toldData.retryCalculation}
          onClear={toldData.clearErrors}
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
                Short Field Takeoff
              </th>
              <th className="py-2 px-4 text-center" colSpan={2}>
                Over 50&apos; Obstacle
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
              <td
                className={
                  getCellClasses(
                    results?.takeoffGroundRoll.departure,
                    isCalculating,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.takeoffGroundRoll.departure,
                  isCalculating,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.takeoffGroundRoll.arrival,
                    isCalculating,
                    hasErrors
                  ) + " border-r dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.takeoffGroundRoll.arrival,
                  isCalculating,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.takeoff50ftObstacle.departure,
                    isCalculating,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.takeoff50ftObstacle.departure,
                  isCalculating,
                  hasErrors
                )}
              </td>
              <td
                className={getCellClasses(
                  results?.takeoff50ftObstacle.arrival,
                  isCalculating,
                  hasErrors
                )}
              >
                {getDisplayValue(
                  results?.takeoff50ftObstacle.arrival,
                  isCalculating,
                  hasErrors
                )}
              </td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Landing Grnd Roll</td>
              <td
                className={
                  getCellClasses(
                    results?.landingGroundRoll.departure,
                    isCalculating,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.landingGroundRoll.departure,
                  isCalculating,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.landingGroundRoll.arrival,
                    isCalculating,
                    hasErrors
                  ) + " border-r dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.landingGroundRoll.arrival,
                  isCalculating,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.landing50ftObstacle.departure,
                    isCalculating,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.landing50ftObstacle.departure,
                  isCalculating,
                  hasErrors
                )}
              </td>
              <td
                className={getCellClasses(
                  results?.landing50ftObstacle.arrival,
                  isCalculating,
                  hasErrors
                )}
              >
                {getDisplayValue(
                  results?.landing50ftObstacle.arrival,
                  isCalculating,
                  hasErrors
                )}
              </td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Available runway remaining</td>
              <td
                className={
                  getCellClasses(
                    results?.availableRunwayRemainingTakeoffGroundRoll
                      .departure,
                    isCalculating,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.availableRunwayRemainingTakeoffGroundRoll.departure,
                  isCalculating,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.availableRunwayRemainingTakeoffGroundRoll.arrival,
                    isCalculating,
                    hasErrors
                  ) + " border-r dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.availableRunwayRemainingTakeoffGroundRoll.arrival,
                  isCalculating,
                  hasErrors
                )}
              </td>
              <td
                className={
                  getCellClasses(
                    results?.availableRunwayRemainingTakeoff50ft.departure,
                    isCalculating,
                    hasErrors
                  ) + " border-r-0 dark:border-gray-700"
                }
              >
                {getDisplayValue(
                  results?.availableRunwayRemainingTakeoff50ft.departure,
                  isCalculating,
                  hasErrors
                )}
              </td>
              <td
                className={getCellClasses(
                  results?.availableRunwayRemainingTakeoff50ft.arrival,
                  isCalculating,
                  hasErrors
                )}
              >
                {getDisplayValue(
                  results?.availableRunwayRemainingTakeoff50ft.arrival,
                  isCalculating,
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
