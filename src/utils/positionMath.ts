const EARTH_RADIUS_NM = 3440.065;
const toRad = (d: number): number => (d * Math.PI) / 180;
const toDeg = (r: number): number => (r * 180) / Math.PI;

/**
 * Spherical-earth direct geodesic.
 * Given a start lat/lon, a TRUE bearing (degrees, clockwise from north),
 * and a distance in nautical miles, returns the destination lat/lon.
 */
export function geodesicDestination(
  startLat: number,
  startLon: number,
  trueBearingDeg: number,
  distanceNm: number,
): { lat: number; lon: number } {
  const angularDistance = distanceNm / EARTH_RADIUS_NM;
  const lat1 = toRad(startLat);
  const lon1 = toRad(startLon);
  const brng = toRad(trueBearingDeg);

  const sinLat2Raw =
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(brng);
  // Clamp to [-1, 1] to absorb floating-point drift that would otherwise
  // make Math.asin return NaN near the poles or for long legs.
  const sinLat2 = Math.max(-1, Math.min(1, sinLat2Raw));
  const lat2 = Math.asin(sinLat2);

  const y = Math.sin(brng) * Math.sin(angularDistance) * Math.cos(lat1);
  const x = Math.cos(angularDistance) - Math.sin(lat1) * sinLat2;
  const lon2 = lon1 + Math.atan2(y, x);

  // Normalize longitude to [-180, 180]
  const lon2Norm = ((toDeg(lon2) + 540) % 360) - 180;

  return { lat: toDeg(lat2), lon: lon2Norm };
}

/** Great-circle distance in nautical miles between two lat/lon points. */
export function greatCircleDistanceNm(from: [number, number], to: [number, number]): number {
  const [lat1, lon1] = from.map(toRad);
  const [lat2, lon2] = to.map(toRad);
  const h =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial TRUE bearing (degrees, 0–360) from one lat/lon point to another. */
export function initialBearingDeg(from: [number, number], to: [number, number]): number {
  const [lat1, lon1] = from.map(toRad);
  const [lat2, lon2] = to.map(toRad);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** The nearest of the eight compass points to a TRUE bearing. */
export function compassPoint(bearingDeg: number): (typeof COMPASS_POINTS)[number] {
  return COMPASS_POINTS[Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8];
}
