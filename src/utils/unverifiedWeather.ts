/**
 * Unverified weather (see GLOSSARY.md): weather values on the worksheet that
 * were not fetched during the current session, e.g. values opened from a
 * shared link. A shared link carries the values but not when or how they
 * were fetched, nor the notifications they came with.
 */
import { hasWeatherData } from "./actionBarState";
import { stepSubject, subjectKey, type Notification } from "./notifications";
import type { WorksheetData } from "./types";

export const UNVERIFIED_WEATHER_MESSAGE =
  "Weather values came from a shared link and haven't been fetched this session. Fetch weather to verify them.";

/**
 * A Caution on the weather step while the worksheet holds weather values, or
 * a ticked advisory box, and no weather fetch has succeeded this session. It
 * never blocks anything.
 *
 * A ticked box alone isn't weather data (`hasWeatherData`), so it doesn't
 * make the action bar or the weather step "fetched"; it is still a value the
 * session didn't fetch. An unticked box is the default and can't be told
 * apart, so it raises nothing.
 */
export function unverifiedWeatherNotifications(
  state: WorksheetData,
  weatherLastUpdated: Date | null
): Notification[] {
  const tickedBox = state.turb || state.cielVis || state.mtnObsc;
  if (weatherLastUpdated !== null || !(hasWeatherData(state) || tickedBox)) return [];
  return [
    {
      level: "caution",
      subject: stepSubject("weather"),
      message: UNVERIFIED_WEATHER_MESSAGE,
    },
  ];
}

/** Whether `n` is the Unverified weather Caution. */
export const isUnverifiedWeather = (n: Notification): boolean =>
  n.level === "caution" &&
  subjectKey(n.subject) === subjectKey(stepSubject("weather")) &&
  n.message === UNVERIFIED_WEATHER_MESSAGE;
