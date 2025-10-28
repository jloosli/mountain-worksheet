/**
 * Parser for AviationWeather.gov windtemp plain text data
 *
 * Format example:
 * FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
 * KOGD 2122+15 2218+08 2216+02 2438-12 2530-22 272838 272750 274663
 *
 * Each data entry format: DDSS±TT
 * - DD: Wind direction (degrees)
 * - SS: Wind speed (knots)
 * - ±TT: Temperature (°C, positive or negative)
 */

export interface WindTempData {
  icaoId: string;
  altitude: number;
  wdir: number;
  wspd: number;
  temp: number;
  pressure: number; // Add pressure field for compatibility
}

export interface ParsedWindTempResponse {
  validTime: string;
  altitudes: number[];
  data: WindTempData[];
}

/**
 * Parse windtemp plain text data from AviationWeather.gov
 */
export function parseWindTempData(textData: string): ParsedWindTempResponse {
  const lines = textData.trim().split("\n");

  // Find the altitude header line
  let altitudeLineIndex = -1;
  let altitudes: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("FT  ")) {
      altitudeLineIndex = i;
      // Parse altitudes from header line
      const altitudeMatch = lines[i].match(/FT\s+(.+)/);
      if (altitudeMatch) {
        altitudes = altitudeMatch[1]
          .split(/\s+/)
          .filter((alt) => alt.trim())
          .map((alt) => parseInt(alt, 10))
          .filter((alt) => !isNaN(alt));
      }
      break;
    }
  }

  if (altitudeLineIndex === -1 || altitudes.length === 0) {
    throw new Error("Could not parse altitude header from windtemp data");
  }

  // Extract valid time from header
  let validTime = "";
  for (let i = 0; i < altitudeLineIndex; i++) {
    if (lines[i].includes("VALID")) {
      const validMatch = lines[i].match(/VALID\s+(\d+)Z/);
      if (validMatch) {
        validTime = validMatch[1];
        break;
      }
    }
  }

  // Parse data lines (after altitude header) - focus on SLC
  const data: WindTempData[] = [];

  for (let i = altitudeLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Look specifically for SLC line
    if (line.startsWith("SLC")) {
      // Extract airport code and data
      const airportMatch = line.match(/^(SLC)\s+(.+)/);
      if (!airportMatch) continue;

      const airportCode = airportMatch[1];
      const dataString = airportMatch[2];

      // Parse wind/temp data for each altitude
      const dataEntries = dataString
        .split(/\s+/)
        .filter((entry) => entry.trim());

      for (let j = 0; j < Math.min(dataEntries.length, altitudes.length); j++) {
        const entry = dataEntries[j];
        const altitude = altitudes[j];

        // Handle different entry formats:
        // 1. DDSS±TT (e.g., "2605+06") - normal wind/temp
        // 2. 9900 - variable wind, no temp data
        // 3. Empty or missing data

        if (entry === "9900") {
          // Variable wind, no temperature data
          data.push({
            icaoId: airportCode,
            altitude,
            wdir: 0, // Variable wind
            wspd: 0,
            temp: 0, // No temperature data
            pressure: 29.92,
          });
        } else {
          // Parse entry format: DDSS±TT (e.g., "2605+06")
          const windTempMatch = entry.match(/^(\d{2})(\d{2})([+-]\d{2})$/);
          if (windTempMatch) {
            const wdir = parseInt(windTempMatch[1] + "0", 10); // Convert "26" to "260"
            const wspd = parseInt(windTempMatch[2], 10);
            const temp = parseInt(windTempMatch[3], 10);

            data.push({
              icaoId: airportCode,
              altitude,
              wdir,
              wspd,
              temp,
              pressure: 29.92,
            });
          }
        }
      }
      break; // Found SLC, no need to continue
    }
  }

  return {
    validTime,
    altitudes,
    data,
  };
}

/**
 * Filter parsed windtemp data for specific airports and altitudes
 */
export function filterWindTempData(
  parsedData: ParsedWindTempResponse,
  airportCodes: string[],
  targetAltitudes: number[]
): WindTempData[] {
  return parsedData.data.filter(
    (item) =>
      airportCodes.includes(item.icaoId) &&
      targetAltitudes.includes(item.altitude)
  );
}
