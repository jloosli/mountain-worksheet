import { fieldSubject, stepSubject, type Notification } from "./notifications";

const BASE_URL = "/api/aviation-weather";

export interface GAirmetCoord {
  lat: string;
  lon: string;
}

export interface GAirmetFeature {
  /**
   * As aviationweather.gov names them, e.g. "TURB-LO", "TURB-HI", "IFR",
   * "MT_OBSC", "ICE", "FZLVL", "LLWS", "SFC_WND".
   */
  hazard: string;
  validTime: string;
  forecastHour: number;
  geom: "AREA" | string;
  coords: GAirmetCoord[];
}

export interface AirmetClassification {
  turb: boolean | null;
  cielVis: boolean | null;
  mtnObsc: boolean | null;
  notifications: Notification[];
}

/**
 * Warning raised when the AIRMET flags could not be updated. The flags are
 * left as they were (clearing a turbulence flag on a failed fetch would be
 * worse), so the pilot must check them.
 */
export function airmetFlagsUnavailable(reason: string): Notification {
  return {
    level: "warning",
    subject: stepSubject("weather"),
    message: `${reason}; turbulence, ceiling/visibility and mountain obscuration flags were not updated. Check AIRMETs manually.`,
  };
}

const VALID_TIME_THRESHOLD_MS = 3 * 60 * 60 * 1000;

/**
 * The G-AIRMET hazards that set a worksheet flag. Turbulence is TURB-LO only
 * (below FL180): TURB-HI is above anything a mountain sortie flies.
 */
const HAZARD_FLAG: Record<
  string,
  { field: "turb" | "cielVis" | "mtnObsc"; label: string } | undefined
> = {
  "TURB-LO": { field: "turb", label: "turbulence" },
  IFR: { field: "cielVis", label: "IFR" },
  MT_OBSC: { field: "mtnObsc", label: "mountain obscuration" },
};

/**
 * The G-AIRMET snapshot nearest `at`. Without a `date` the endpoint returns a
 * single snapshot near now, so a later sortie would never find its own.
 * Resolves to `null` (204 No Content) when no snapshot of the current
 * issuance covers `at`, e.g. beyond the 12-hour forecast.
 */
export async function fetchGAirmets(at: Date): Promise<GAirmetFeature[] | null> {
  const date = at.toISOString().replace(/\.\d{3}Z$/, "Z");
  const url = `${BASE_URL}?endpoint=gairmet&format=json&date=${encodeURIComponent(date)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`G-AIRMET fetch failed: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return null;
  const json = await res.json();
  return Array.isArray(json) ? (json as GAirmetFeature[]) : [];
}

export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [pLat, pLon] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [iLat, iLon] = polygon[i];
    const [jLat, jLon] = polygon[j];
    const intersect =
      iLon > pLon !== jLon > pLon && pLat <= ((jLat - iLat) * (pLon - iLon)) / (jLon - iLon) + iLat;
    if (intersect) inside = !inside;
  }
  return inside;
}

function airmetCoords(a: GAirmetFeature): [number, number][] {
  return a.coords.map((c) => [Number(c.lat), Number(c.lon)]);
}

export function classifyAirmets(
  features: GAirmetFeature[],
  position: [number, number],
  midTime: Date,
): AirmetClassification {
  const notifications: Notification[] = [];
  const targetMs = midTime.getTime();
  const eligible = features.filter((f) => HAZARD_FLAG[f.hazard]);
  // Fetch succeeded but the response carries no TURB-LO/IFR/MT_OBSC features at
  // all → no relevant hazards. Clear the flags rather than leaving stale state.
  // (Genuine unavailability — fetch failure or no features in the time window
  // — is signaled with null sentinels below.)
  if (eligible.length === 0) {
    notifications.push({
      level: "advisory",
      subject: stepSubject("weather"),
      message:
        "No turbulence, IFR or mountain obscuration G-AIRMETs in effect; those flags were cleared",
    });
    return { turb: false, cielVis: false, mtnObsc: false, notifications };
  }

  // Group by hazard
  const byHazard = new Map<string, GAirmetFeature[]>();
  for (const f of eligible) {
    const list = byHazard.get(f.hazard) ?? [];
    list.push(f);
    byHazard.set(f.hazard, list);
  }

  const result: AirmetClassification = {
    turb: false,
    cielVis: false,
    mtnObsc: false,
    notifications,
  };

  const staleHazards: { hazard: string; deltaMs: number }[] = [];
  let anyWithinThreshold = false;
  let ifrWithinThreshold = false;
  for (const [hazard, list] of byHazard.entries()) {
    // Sort by abs delta from midTime; pick closest validTime
    const sorted = [...list].sort(
      (a, b) =>
        Math.abs(Date.parse(a.validTime) - targetMs) - Math.abs(Date.parse(b.validTime) - targetMs),
    );
    const bestDelta = Math.abs(Date.parse(sorted[0].validTime) - targetMs);
    if (bestDelta > VALID_TIME_THRESHOLD_MS) {
      staleHazards.push({ hazard, deltaMs: bestDelta });
      continue;
    }
    anyWithinThreshold = true;
    if (hazard === "IFR") ifrWithinThreshold = true;

    const bestTime = sorted[0].validTime;
    const atBestTime = list.filter((f) => f.validTime === bestTime);
    const hit = atBestTime.some((f) => pointInPolygon(position, airmetCoords(f)));
    const flag = HAZARD_FLAG[hazard];
    if (flag) result[flag.field] = hit;
  }

  if (ifrWithinThreshold) {
    notifications.push({
      level: "caution",
      subject: fieldSubject("cielVis"),
      message:
        "AIRMET IFR auto-flag uses 1000 ft / 3 sm threshold, not the worksheet's 2000 ft / 10 sm threshold",
    });
  }

  if (anyWithinThreshold) {
    for (const { hazard, deltaMs } of staleHazards) {
      const flag = HAZARD_FLAG[hazard];
      if (!flag) continue;
      notifications.push({
        level: "caution",
        subject: fieldSubject(flag.field),
        message: `No ${flag.label} G-AIRMET within 3 hr of the sortie (nearest is ${(
          deltaMs / 3_600_000
        ).toFixed(1)} hr away); flag left off. Check AIRMETs manually.`,
      });
    }
  }

  if (!anyWithinThreshold) {
    return {
      turb: null,
      cielVis: null,
      mtnObsc: null,
      notifications: [
        airmetFlagsUnavailable(`G-AIRMET data unavailable within 3 hr of ${midTime.toISOString()}`),
      ],
    };
  }
  return result;
}
