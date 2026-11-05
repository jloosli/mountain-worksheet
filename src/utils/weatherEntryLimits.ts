/**
 * The limits a pilot's weather entry must meet to be applied. Shared by the
 * weather editors (`WeatherSection`) and by values opened from a shared link
 * (`worksheetUrlState`), so both accept exactly the same values.
 */

export const ALTIMETER_RANGE_TEXT = "28.00–31.00 inHg";

export function isValidAltimeterEntry(inHg: number): boolean {
  return inHg >= 28.0 && inHg <= 31.0;
}

/** Winds-aloft rows: 0 direction, 1 speed, 2 temperature (°C). */
export type WindRow = 0 | 1 | 2;

export function isValidWindEntry(row: WindRow, value: number): boolean {
  if (row === 0) return Number.isInteger(value) && value >= 0 && value <= 359;
  if (row === 1) return Number.isInteger(value) && value >= 0 && value <= 150;
  return value >= -50 && value <= 50;
}

export const WIND_ROW_LABEL = ["wind direction", "wind speed", "temperature aloft"] as const;

/** What each row accepts, in °C for temperature. */
export const WIND_RANGE_TEXT = ["0–359°", "a whole number of knots, 0–150", "-50–50°C"] as const;
