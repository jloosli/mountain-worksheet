/**
 * Unverified weather (see GLOSSARY.md): weather values on the worksheet that
 * were not fetched during the current session, e.g. values opened from a
 * shared link. A shared link carries the values but not when or how they
 * were fetched, nor the notifications they came with.
 */
import { hasWeatherData } from "./actionBarState";
import { stepSubject, type Notification } from "./notifications";
import type { WorksheetData } from "./types";

export const UNVERIFIED_WEATHER_MESSAGE =
  "Weather values came from a shared link and haven't been fetched this session. Fetch weather to verify them.";

/**
 * A Caution on the weather step while the worksheet holds weather values and
 * no weather fetch has succeeded this session. Derived from the same two
 * facts `deriveStepStatuses` uses; it never blocks anything.
 */
export function unverifiedWeatherNotifications(
  state: WorksheetData,
  weatherLastUpdated: Date | null
): Notification[] {
  if (weatherLastUpdated !== null || !hasWeatherData(state)) return [];
  return [
    {
      level: "caution",
      subject: stepSubject("weather"),
      message: UNVERIFIED_WEATHER_MESSAGE,
    },
  ];
}
