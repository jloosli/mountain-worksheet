"use client";

import { useState, type ReactNode } from "react";
import { fetchWorksheetWeather } from "@/utils/weatherFetch";
import type { WorksheetData } from "@/utils/types";
import type { WeatherSessionEvent } from "@/utils/weatherSession";
import { WeatherLoadingModal } from "./WeatherModal";

interface WeatherDataIntegrationProps {
  worksheetData: WorksheetData;
  /** Whether the worksheet holds what a fetch needs (`canFetch`). */
  canFetch: boolean;
  /**
   * Receives every fetch as one session event, including failures: what it
   * applies (null if nothing), its result and when it arrived.
   */
  onFetched: (event: Extract<WeatherSessionEvent, { type: "fetchApplied" }>) => void;
  renderButton: (props: {
    onClick: () => void;
    disabled: boolean;
    isLoading: boolean;
  }) => ReactNode;
}

/**
 * Runs a weather fetch for the worksheet and reports it. Never blocks and
 * never opens a dialog beyond the loading indicator: problems come back as
 * notifications in the result, shown inline by the parent.
 */
export default function WeatherDataIntegration({
  worksheetData,
  canFetch,
  onFetched,
  renderButton,
}: WeatherDataIntegrationProps) {
  const [isLoading, setIsLoading] = useState(false);

  const fetchWeather = async () => {
    if (!canFetch) return;
    setIsLoading(true);
    const { data, result } = await fetchWorksheetWeather(worksheetData);
    onFetched({ type: "fetchApplied", data, result, at: new Date() });
    setIsLoading(false);
  };

  return (
    <>
      {renderButton({
        onClick: () => void fetchWeather(),
        disabled: !canFetch || isLoading,
        isLoading,
      })}
      <WeatherLoadingModal
        isOpen={isLoading}
        title="Fetching Weather Data..."
        message="Retrieving current weather conditions and forecasts..."
      />
    </>
  );
}
