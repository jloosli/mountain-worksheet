export type ParsedPosition =
  | { kind: "decimal";      raw: string; lat: number; lon: number }
  | { kind: "dms";          raw: string; lat: number; lon: number }
  | { kind: "ddm";          raw: string; lat: number; lon: number }
  | { kind: "airport-rd";   raw: string; stationId: string; radial: number; distanceNm: number }
  | { kind: "vor-rd";       raw: string; stationId: string; radial: number; distanceNm: number }
  | { kind: "unrecognized"; raw: string };

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

const inRange = (lat: number, lon: number): boolean =>
  lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

const tryDecimalLetters = (s: string): { lat: number; lon: number } | null => {
  const m = s.match(/^([\d.]+)([NS])\/([\d.]+)([EW])$/);
  if (!m) return null;
  const lat = Number(m[1]) * (m[2] === "S" ? -1 : 1);
  const lon = Number(m[3]) * (m[4] === "W" ? -1 : 1);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

const tryDecimalMinus = (s: string): { lat: number; lon: number } | null => {
  // Accept either `/` or `,` (with optional whitespace) as separator
  const m = s.match(/^(-?[\d.]+)\s*[/,]\s*(-?[\d.]+)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

export function parsePosition(input: string): ParsedPosition {
  const raw = input;
  const s = input.trim().toUpperCase();
  if (s === "") return { kind: "unrecognized", raw };

  const letters = tryDecimalLetters(s);
  if (letters) return { kind: "decimal", raw, ...letters };

  const minus = tryDecimalMinus(s);
  if (minus) return { kind: "decimal", raw, ...minus };

  return { kind: "unrecognized", raw };
}
