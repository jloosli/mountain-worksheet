"use client";

import React from "react";

interface TOLDFallbackDisplayProps {
  aircraftModel?: string;
  airports: [string, string];
  reason: "no-aircraft" | "no-data" | "calculation-failed";
  onRetry?: () => void;
}

/**
 * Fallback display component for TOLD calculations when aircraft data is unavailable
 * Provides helpful information and guidance to users
 */
export default function TOLDFallbackDisplay({
  aircraftModel,
  airports,
  reason,
  onRetry,
}: TOLDFallbackDisplayProps) {
  const getFallbackMessage = () => {
    switch (reason) {
      case "no-aircraft":
        return {
          title: "Aircraft Not Found",
          message: `Performance data for aircraft model "${aircraftModel}" is not available in the system.`,
          suggestion:
            "Please verify the aircraft model or contact support to add this aircraft to the database.",
        };
      case "no-data":
        return {
          title: "Performance Data Missing",
          message: `Takeoff and landing performance data is not available for aircraft "${aircraftModel}".`,
          suggestion:
            "This aircraft may not have complete performance data. Please verify the aircraft model or use a different aircraft.",
        };
      case "calculation-failed":
        return {
          title: "Calculation Error",
          message:
            "An error occurred while calculating takeoff and landing distances.",
          suggestion:
            "Please check your input values and try again. If the problem persists, contact support.",
        };
      default:
        return {
          title: "Data Unavailable",
          message:
            "Takeoff and landing distance calculations are not available.",
          suggestion: "Please check your inputs and try again.",
        };
    }
  };

  const { title, message, suggestion } = getFallbackMessage();

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">
        Take Off and Landing Distances (TOLD) (
        {aircraftModel || "Unknown Aircraft"})
      </h3>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h4 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">
              {title}
            </h4>
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              <p className="mb-2">{message}</p>
              <p className="italic">{suggestion}</p>
            </div>

            {/* Airport information */}
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/40 rounded-md">
              <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Flight Plan:
              </h5>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  <span className="font-medium">Departure:</span>{" "}
                  {airports[0] || "Not specified"}
                </p>
                <p>
                  <span className="font-medium">Arrival:</span>{" "}
                  {airports[1] || "Not specified"}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex space-x-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-md text-sm font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors"
                >
                  Retry Calculation
                </button>
              )}
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder table to maintain layout */}
      <div className="mt-4 overflow-x-auto">
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
                {airports[0] || "-"}
              </th>
              <th className="py-2 px-4 text-right border-r dark:border-gray-700">
                {airports[1] || "-"}
              </th>
              <th className="py-2 px-4 text-right border-r-0 dark:border-gray-700">
                {airports[0] || "-"}
              </th>
              <th className="py-2 px-4 text-right">{airports[1] || "-"}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4 font-medium">Take Off Grnd Roll</td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 border-r-0 dark:border-gray-700">
                N/A
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 border-r dark:border-gray-700">
                N/A
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 border-r-0 dark:border-gray-700">
                N/A
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400">
                N/A
              </td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4 font-medium">Landing Grnd Roll</td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 border-r-0 dark:border-gray-700">
                N/A
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 border-r dark:border-gray-700">
                N/A
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 border-r-0 dark:border-gray-700">
                N/A
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400">
                N/A
              </td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium">
                Available Runway Remaining
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 border-r-0 dark:border-gray-700">
                N/A
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 border-r dark:border-gray-700">
                N/A
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 border-r-0 dark:border-gray-700">
                N/A
              </td>
              <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400">
                N/A
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
