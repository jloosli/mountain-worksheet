import geomagnetism from "geomagnetism";

/**
 * Magnetic variation (declination) at a point.
 * Returns east-positive degrees: trueBearing = magneticBearing + variation.
 *
 * Uses the World Magnetic Model via the `geomagnetism` package.
 */
export function magneticVariation(
  lat: number,
  lon: number,
  date: Date = new Date()
): number {
  const model = geomagnetism.model(date);
  const point = model.point([lat, lon]);
  return point.decl;
}
