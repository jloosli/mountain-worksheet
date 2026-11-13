/**
 * Airport identity: what the airport lookup says about an entered airport ID.
 * See GLOSSARY.md (Unknown airport, Non-reporting airport, Auto-correction).
 *
 * Normalization (`normalizeAirportCode`) is silent and happens first. The
 * `K`-prefix correction is a separate step that is applied only when the
 * lookup confirms exactly that airport.
 */
import type { AirportResponse } from "./aviationWeatherApi";
import { fieldSubject, type Notification } from "./notifications";

export type AirportIdentity =
  /** The lookup has the entered ID. */
  | { kind: "known"; id: string }
  /** The entered ID matched nothing; the `K`-prefixed ID was confirmed. */
  | { kind: "corrected"; entered: string; id: string }
  /** Nothing matched, even after auto-correction. */
  | { kind: "unknown"; id: string; tried: string[] }
  /** The lookup itself failed, so nothing can be said about the ID. */
  | { kind: "unchecked"; id: string };

/** The `K`-prefixed form of a 3-character ID, or `null` if none applies. */
export function correctionCandidate(id: string): string | null {
  return /^[A-Z0-9]{3}$/.test(id) ? `K${id}` : null;
}

/** Number of airport records whose ICAO ID is exactly `id`. */
export function matchCount(id: string, airports: readonly AirportResponse[] | undefined): number {
  return (airports ?? []).filter((a) => a.icaoId?.toUpperCase() === id).length;
}

/**
 * Classifies one entered (already normalized) ID. `entered` is the lookup
 * result for the entered ID; `candidate` is the lookup result for its
 * correction candidate (`undefined` if no candidate was looked up; `null` if
 * that lookup failed).
 */
export function classifyAirport(
  id: string,
  entered: readonly AirportResponse[] | null,
  candidate?: readonly AirportResponse[] | null,
): AirportIdentity {
  if (entered === null) return { kind: "unchecked", id };
  if (matchCount(id, entered) > 0) return { kind: "known", id };
  const fix = correctionCandidate(id);
  if (fix && candidate === null) return { kind: "unchecked", id };
  if (fix && matchCount(fix, candidate ?? undefined) === 1) {
    return { kind: "corrected", entered: id, id: fix };
  }
  return { kind: "unknown", id, tried: fix ? [id, fix] : [id] };
}

/** The notification an airport's identity raises on its ID field, if any. */
export function airportIdentityNotification(
  identity: AirportIdentity,
  slot: 0 | 1,
): Notification | null {
  const subject = fieldSubject("airport", slot);
  switch (identity.kind) {
    case "corrected":
      return {
        level: "advisory",
        subject,
        message: `Using ${identity.id} for ${identity.entered}: no airport has the ID ${identity.entered}`,
      };
    case "unknown":
      return {
        level: "caution",
        subject,
        message: `No airport found for ${identity.tried.join(" or ")}. Check the ID, or, for a private strip, enter field elevation, runway length and weather manually`,
      };
    default:
      return null;
  }
}

/** Advisory for an airport that exists but publishes no METAR or TAF. */
/**
 * The Non-reporting airport's Advisory. `detail` says what the fetch filled
 * instead (#226); without it, both fields are left for the pilot.
 */
export function nonReportingAdvisory(
  id: string,
  slot: 0 | 1,
  detail = "enter temperature and altimeter manually",
): Notification {
  return {
    level: "advisory",
    subject: fieldSubject("airport", slot),
    message: `${id} doesn't report weather; ${detail}`,
  };
}
