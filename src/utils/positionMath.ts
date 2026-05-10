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
  distanceNm: number
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
