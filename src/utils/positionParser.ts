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

const ddmFromParts = (degStr: string, minStr: string): number | null => {
  const deg = Number(degStr);
  const min = Number(minStr);
  if (!Number.isFinite(deg) || !Number.isFinite(min)) return null;
  if (min < 0 || min >= 60) return null;
  return deg + min / 60;
};

const tryDdmLetters = (s: string): { lat: number; lon: number } | null => {
  // \d{2}\d{2}\.\d+ for lat (DDMM.mm), \d{3}\d{2}\.\d+ for lon (DDDMM.mm)
  const m = s.match(/^(\d{2})(\d{2}\.\d+)([NS])\/(\d{3})(\d{2}\.\d+)([EW])$/);
  if (!m) return null;
  const latVal = ddmFromParts(m[1], m[2]);
  const lonVal = ddmFromParts(m[4], m[5]);
  if (latVal === null || lonVal === null) return null;
  const lat = latVal * (m[3] === "S" ? -1 : 1);
  const lon = lonVal * (m[6] === "W" ? -1 : 1);
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

const tryDdmMinus = (s: string): { lat: number; lon: number } | null => {
  const m = s.match(/^(\d{2})(\d{2}\.\d+)\/(-?)(\d{3})(\d{2}\.\d+)$/);
  if (!m) return null;
  const latVal = ddmFromParts(m[1], m[2]);
  const lonVal = ddmFromParts(m[4], m[5]);
  if (latVal === null || lonVal === null) return null;
  const lat = latVal;
  const lon = lonVal * (m[3] === "-" ? -1 : 1);
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

const dmsFromParts = (degStr: string, minStr: string, secStr: string): number | null => {
  const deg = Number(degStr);
  const min = Number(minStr);
  const sec = Number(secStr);
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  if (min < 0 || min >= 60) return null;
  if (sec < 0 || sec >= 60) return null;
  return deg + min / 60 + sec / 3600;
};

const tryDmsLetters = (s: string): { lat: number; lon: number } | null => {
  // DDMMSS for lat (6 digits), DDDMMSS for lon (7 digits)
  const m = s.match(/^(\d{2})(\d{2})(\d{2})([NS])\/(\d{3})(\d{2})(\d{2})([EW])$/);
  if (!m) return null;
  const latVal = dmsFromParts(m[1], m[2], m[3]);
  const lonVal = dmsFromParts(m[5], m[6], m[7]);
  if (latVal === null || lonVal === null) return null;
  const lat = latVal * (m[4] === "S" ? -1 : 1);
  const lon = lonVal * (m[8] === "W" ? -1 : 1);
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

const tryDmsMinus = (s: string): { lat: number; lon: number } | null => {
  const m = s.match(/^(\d{2})(\d{2})(\d{2})\/(-?)(\d{3})(\d{2})(\d{2})$/);
  if (!m) return null;
  const latVal = dmsFromParts(m[1], m[2], m[3]);
  const lonVal = dmsFromParts(m[5], m[6], m[7]);
  if (latVal === null || lonVal === null) return null;
  const lat = latVal;
  const lon = lonVal * (m[4] === "-" ? -1 : 1);
  if (!inRange(lat, lon)) return null;
  return { lat: round4(lat), lon: round4(lon) };
};

export function parsePosition(input: string): ParsedPosition {
  const raw = input;
  const s = input.trim().toUpperCase();
  if (s === "") return { kind: "unrecognized", raw };

  const dmsL = tryDmsLetters(s);
  if (dmsL) return { kind: "dms", raw, ...dmsL };

  const dmsM = tryDmsMinus(s);
  if (dmsM) return { kind: "dms", raw, ...dmsM };

  const ddmL = tryDdmLetters(s);
  if (ddmL) return { kind: "ddm", raw, ...ddmL };

  const ddmM = tryDdmMinus(s);
  if (ddmM) return { kind: "ddm", raw, ...ddmM };

  const decL = tryDecimalLetters(s);
  if (decL) return { kind: "decimal", raw, ...decL };

  const decM = tryDecimalMinus(s);
  if (decM) return { kind: "decimal", raw, ...decM };

  return { kind: "unrecognized", raw };
}
