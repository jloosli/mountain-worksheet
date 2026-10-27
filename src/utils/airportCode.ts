/**
 * Canonical form of a user-entered airport identifier: surrounding whitespace
 * removed and uppercased. AviationWeather.gov rejects ids with stray spaces
 * (HTTP 400), so every lookup must go through this first.
 */
export function normalizeAirportCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}
