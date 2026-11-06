"use client";

import { useState, useCallback, type ReactNode } from "react";
import {
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { isApiPopulatedData } from "@/utils/weatherDataMapper";
import { fetchWorksheetWeather } from "@/utils/weatherFetch";
import type { WeatherFetchResult } from "@/utils/notifications";
import { WeatherLoadingModal } from "./WeatherModal";
import type { WorksheetData } from "@/utils/types";
import { normalizeAirportCode } from "@/utils/airportCode";

interface WeatherDataIntegrationProps {
  worksheetData: WorksheetData;
  onDataUpdate: (data: Partial<WorksheetData>) => void;
  /**
   * Receives every fetch's result, including failures. The parent derives
   * notifications from it plus current state (see `deriveNotifications`).
   */
  onFetchResult?: (result: WeatherFetchResult) => void;
  onTimestampUpdate?: (timestamp: Date) => void; // Callback to pass timestamp to parent
  disabled?: boolean;
  hideBox?: boolean; // If true, don't render the status box UI (the loading indicator still renders)
  renderButton?: (props: {
    onClick: () => void;
    disabled: boolean;
    isLoading: boolean;
  }) => ReactNode; // Optional render function for custom button rendering
}

export default function WeatherDataIntegration({
  worksheetData,
  onDataUpdate,
  onFetchResult,
  onTimestampUpdate,
  disabled = false,
  hideBox = false,
  renderButton,
}: WeatherDataIntegrationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const canFetchWeather = useCallback(() => {
    const airports = worksheetData.airport;
    return Boolean(
      airports &&
        normalizeAirportCode(airports[0]) &&
        normalizeAirportCode(airports[1]) &&
        worksheetData.date &&
        worksheetData.time
    );
  }, [worksheetData]);

  // Never blocks and never opens a modal: problems come back as
  // notifications in the result, shown inline by the parent.
  const fetchWeatherData = useCallback(async () => {
    if (!canFetchWeather()) return;
    setIsLoading(true);
    const { data, result } = await fetchWorksheetWeather(worksheetData);
    if (data) {
      onDataUpdate(data);
      const updateTime = new Date();
      setLastUpdated(updateTime);
      onTimestampUpdate?.(updateTime);
    }
    onFetchResult?.(result);
    setIsLoading(false);
  }, [worksheetData, onDataUpdate, onFetchResult, onTimestampUpdate, canFetchWeather]);

  const isApiDataPopulated = isApiPopulatedData(worksheetData);
  const canFetch = canFetchWeather() && !disabled;

  const buttonProps = {
    onClick: () => void fetchWeatherData(),
    disabled: !canFetch || isLoading,
    isLoading,
  };

  return (
    <>
      {!hideBox && (
        <>
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
                {lastUpdated && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Last updated: {lastUpdated.toLocaleTimeString()}
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
                  canFetch && !isLoading
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400"
                }`}
              >
                {isLoading ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <CloudArrowDownIcon className="h-5 w-5" />
                )}
                {isLoading ? "Loading..." : "Fetch Weather"}
              </button>
            </div>
          </div>
        </>
      )}

      {renderButton && renderButton(buttonProps)}

      {/* Loading indicator */}
      <WeatherLoadingModal
        isOpen={isLoading}
        title="Fetching Weather Data..."
        message="Retrieving current weather conditions and forecasts..."
      />
    </>
  );
}
