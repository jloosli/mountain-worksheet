"use client";

import { useState, useCallback, type ReactNode } from "react";
import {
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { getWeatherDataBatch } from "@/utils/aviationWeatherApi";
import {
  mapWeatherDataToWorksheet,
  mergeWeatherData,
  isApiPopulatedData,
} from "@/utils/weatherDataMapper";
import {
  WeatherErrorModal,
  WeatherLoadingModal,
  AirportNotFoundModal,
} from "./WeatherModal";
import type { WorksheetData } from "@/utils/types";

interface WeatherDataIntegrationProps {
  worksheetData: Partial<WorksheetData>;
  onDataUpdate: (data: Partial<WorksheetData>) => void;
  onTimestampUpdate?: (timestamp: Date) => void; // Callback to pass timestamp to parent
  disabled?: boolean;
  hideBox?: boolean; // If true, don't render the box UI, only modals
  renderButton?: (props: {
    onClick: () => void;
    disabled: boolean;
    isLoading: boolean;
  }) => ReactNode; // Optional render function for custom button rendering
}

interface WeatherApiState {
  isLoading: boolean;
  error: {
    title: string;
    message: string;
    details?: string;
    retryable?: boolean;
  } | null;
  airportNotFound: string | null;
  lastUpdated: Date | null;
  isRetrying: boolean;
}

export default function WeatherDataIntegration({
  worksheetData,
  onDataUpdate,
  onTimestampUpdate,
  disabled = false,
  hideBox = false,
  renderButton,
}: WeatherDataIntegrationProps) {
  const [apiState, setApiState] = useState<WeatherApiState>({
    isLoading: false,
    error: null,
    airportNotFound: null,
    lastUpdated: null,
    isRetrying: false,
  });

  const canFetchWeather = useCallback(() => {
    // Check if we have the required data to fetch weather
    const airports = worksheetData.airport;
    const date = worksheetData.date;
    const time = worksheetData.time;

    return airports && airports[0] && airports[1] && date && time;
  }, [worksheetData]);

  const fetchWeatherData = useCallback(
    async (isRetry = false) => {
      if (!canFetchWeather()) {
        setApiState((prev) => ({
          ...prev,
          error: {
            title: "Missing Required Information",
            message:
              "Please fill in departure airport, arrival airport, date, and time before fetching weather data.",
            retryable: false,
          },
        }));
        return;
      }

      setApiState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        airportNotFound: null,
        isRetrying: isRetry,
      }));

      try {
        const airports = worksheetData.airport!;
        const departureAirport = airports[0].toUpperCase();
        const arrivalAirport = airports[1].toUpperCase();

        // Collect unique airports
        const uniqueAirports = Array.from(
          new Set([departureAirport, arrivalAirport].filter(Boolean))
        );

        if (uniqueAirports.length === 0) {
          throw new Error("No valid airports specified");
        }

        // Fetch weather data
        const apiData = await getWeatherDataBatch(uniqueAirports, {
          includeMETAR: true,
          includeTAF: true,
          includeAirport: true,
          includeWindTemp: true,
          metarHours: 1,
          tafHours: 6,
          altitudes: [3000, 6000, 9000, 12000, 15000],
        });

        // Map API data to worksheet format
        const mappingResult = mapWeatherDataToWorksheet(apiData, {
          flightDate: worksheetData.date!,
          flightTime: worksheetData.time!,
          departureAirport,
          arrivalAirport,
          validateData: true,
        });

        if (!mappingResult.success) {
          throw new Error(
            `Data mapping failed: ${mappingResult.errors.join(", ")}`
          );
        }

        // Check for airport not found errors
        const airportErrors = mappingResult.warnings.filter(
          (warning) =>
            warning.includes("airport") && warning.includes("not found")
        );

        if (airportErrors.length > 0) {
          // Extract airport codes from error messages
          const notFoundAirports = airportErrors
            .map((error) => {
              const match = error.match(/airport code (\w+)/i);
              return match ? match[1] : null;
            })
            .filter(Boolean);

          if (notFoundAirports.length > 0) {
            setApiState((prev) => ({
              ...prev,
              isLoading: false,
              airportNotFound: notFoundAirports[0],
            }));
            return;
          }
        }

        // Merge with existing data
        const mergedData = mergeWeatherData(
          worksheetData,
          mappingResult.data,
          true
        );

        // Update the worksheet data
        onDataUpdate(mergedData);

        const updateTime = new Date();
        setApiState((prev) => ({
          ...prev,
          isLoading: false,
          lastUpdated: updateTime,
          isRetrying: false,
        }));

        // Pass timestamp to parent
        if (onTimestampUpdate) {
          onTimestampUpdate(updateTime);
        }
      } catch (error) {
        console.error("Weather data fetch error:", error);

        let errorMessage =
          "An unexpected error occurred while fetching weather data.";
        let errorDetails: string | undefined;
        let retryable = true;

        if (error instanceof Error) {
          errorMessage = error.message;
          errorDetails = error.stack;

          // Determine if error is retryable based on error message
          if (
            error.message.includes("network") ||
            error.message.includes("timeout") ||
            error.message.includes("rate limit")
          ) {
            retryable = true;
          } else if (
            error.message.includes("not found") ||
            error.message.includes("invalid")
          ) {
            retryable = false;
          }
        }

        setApiState((prev) => ({
          ...prev,
          isLoading: false,
          error: {
            title: "Weather Data Fetch Failed",
            message: errorMessage,
            details: errorDetails,
            retryable,
          },
          isRetrying: false,
        }));
      }
    },
    [worksheetData, onDataUpdate, canFetchWeather, onTimestampUpdate]
  );

  const handleRetry = useCallback(() => {
    fetchWeatherData(true);
  }, [fetchWeatherData]);

  const handleCloseError = useCallback(() => {
    setApiState((prev) => ({ ...prev, error: null }));
  }, []);

  const handleCloseAirportNotFound = useCallback(() => {
    setApiState((prev) => ({ ...prev, airportNotFound: null }));
  }, []);

  const handleRetryAirportNotFound = useCallback(() => {
    setApiState((prev) => ({ ...prev, airportNotFound: null }));
    fetchWeatherData(true);
  }, [fetchWeatherData]);

  const isApiDataPopulated = isApiPopulatedData(worksheetData);
  const canFetch = canFetchWeather() && !disabled;

  const buttonProps = {
    onClick: () => fetchWeatherData(false),
    disabled: !canFetch || apiState.isLoading,
    isLoading: apiState.isLoading,
  };

  return (
    <>
      {!hideBox && (
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-3">
            <CloudArrowDownIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Aviation Weather Data
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {isApiDataPopulated.wind ||
                isApiDataPopulated.temperature ||
                isApiDataPopulated.pressure ||
                isApiDataPopulated.runway
                  ? "Data populated from AviationWeather.gov"
                  : "No weather data loaded"}
              </p>
              {apiState.lastUpdated && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Last updated: {apiState.lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isApiDataPopulated.wind ||
            isApiDataPopulated.temperature ||
            isApiDataPopulated.pressure ||
            isApiDataPopulated.runway ? (
              <div className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Data Available</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span>Manual Entry Required</span>
              </div>
            )}

            <button
              type="button"
              onClick={buttonProps.onClick}
              disabled={buttonProps.disabled}
              className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                canFetch && !apiState.isLoading
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400"
              }`}
            >
              {apiState.isLoading ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <CloudArrowDownIcon className="h-5 w-5" />
              )}
              {apiState.isLoading ? "Loading..." : "Fetch Weather"}
            </button>
          </div>
        </div>
      )}

      {renderButton && renderButton(buttonProps)}

      {/* Loading Modal */}
      <WeatherLoadingModal
        isOpen={apiState.isLoading}
        title={
          apiState.isRetrying
            ? "Retrying Weather Data..."
            : "Fetching Weather Data..."
        }
        message={
          apiState.isRetrying
            ? "Attempting to fetch weather data again..."
            : "Retrieving current weather conditions and forecasts..."
        }
      />

      {/* Error Modal */}
      <WeatherErrorModal
        isOpen={!!apiState.error}
        onClose={handleCloseError}
        onRetry={apiState.error?.retryable ? handleRetry : undefined}
        error={apiState.error || { title: "", message: "", retryable: false }}
      />

      {/* Airport Not Found Modal */}
      <AirportNotFoundModal
        isOpen={!!apiState.airportNotFound}
        onClose={handleCloseAirportNotFound}
        onRetry={handleRetryAirportNotFound}
        airportCode={apiState.airportNotFound || ""}
      />
    </>
  );
}
