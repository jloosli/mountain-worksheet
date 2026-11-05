/**
 * Checks a worksheet opened from a link for values the URL deserializer
 * coerced or passed through (`urlState.ts` is type-hinted, not validated),
 * and raises a Warning for each one on its field.
 */
import {
  fieldSubject,
  readField,
  type Notification,
  type Subject,
} from "./notifications";
import type { WorksheetData } from "./types";

export interface UrlLoadResult {
  /** The worksheet with malformed values cleared or reset. */
  state: WorksheetData;
  notifications: Notification[];
}

const NUMERIC_SCALARS = ["weight", "duration"] as const;
const NUMERIC_ARRAYS = [
  "temp",
  "altimeter",
  "altitude",
  "rwy",
  "position",
] as const;
const FLAGS = ["turb", "cielVis", "mtnObsc", "mtnEndorse", "mtnCert"] as const;

const LABEL: Partial<Record<keyof WorksheetData, string>> = {
  weight: "takeoff weight",
  duration: "duration",
  temp: "temperature",
  altimeter: "altimeter",
  altitude: "altitude",
  rwy: "runway length",
  position: "position",
  wind: "winds aloft",
  turb: "turbulence flag",
  cielVis: "ceiling/visibility flag",
  mtnObsc: "mountain obscuration flag",
  mtnEndorse: "mountain endorsement",
  mtnCert: "mountain certification",
  date: "date",
  time: "time",
};

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const isMalformedNumber = (v: unknown) =>
  v !== null && v !== undefined && !(typeof v === "number" && Number.isFinite(v));

const notANumber = (subject: Subject, raw: unknown): Notification => {
  const field = subject.kind === "field" ? subject.field : undefined;
  return {
    level: "warning",
    subject,
    message: `The link's ${LABEL[field!] ?? field} value "${String(
      raw
    )}" isn't a number; it was cleared. Enter it again.`,
  };
};

export function sanitizeWorksheetUrlState(
  state: WorksheetData,
  query: string | URLSearchParams | null,
  initialState: WorksheetData
): UrlLoadResult {
  const params = new URLSearchParams(
    query instanceof URLSearchParams ? query.toString() : query ?? ""
  );
  const next: WorksheetData = { ...state };
  const notifications: Notification[] = [];

  for (const key of NUMERIC_SCALARS) {
    const v = next[key] as unknown;
    if (isMalformedNumber(v)) {
      notifications.push(notANumber(fieldSubject(key), v));
      (next as unknown as Record<string, unknown>)[key] = null;
    }
  }

  for (const key of NUMERIC_ARRAYS) {
    const arr = next[key] as unknown;
    if (!Array.isArray(arr)) continue;
    const cleaned = arr.map((v, i) => {
      if (!isMalformedNumber(v)) return v ?? null;
      notifications.push(notANumber(fieldSubject(key, i), v));
      return null;
    });
    (next as unknown as Record<string, unknown>)[key] = cleaned;
  }

  if (Array.isArray(next.wind)) {
    next.wind = next.wind.map((row) =>
      Array.isArray(row)
        ? row.map((v, col) => {
            if (!isMalformedNumber(v)) return v ?? null;
            notifications.push(notANumber(fieldSubject("wind", col), v));
            return null;
          })
        : row
    ) as WorksheetData["wind"];
  }

  for (const key of FLAGS) {
    const raw = params.get(key);
    if (raw === null || ["0", "1", "true", "false"].includes(raw)) continue;
    notifications.push({
      level: "warning",
      subject: fieldSubject(key),
      message: `The link's ${LABEL[key]} value "${raw}" isn't on or off; it was read as ${
        next[key] ? "on" : "off"
      }. Check it.`,
    });
  }

  (
    [
      ["date", DATE_RE, "YYYY-MM-DD"],
      ["time", TIME_RE, "HH:MM UTC"],
    ] as const
  ).forEach(([key, re, format]) => {
    const raw = params.get(key);
    if (raw === null || re.test(raw)) return;
    next[key] = initialState[key];
    notifications.push({
      level: "warning",
      subject: fieldSubject(key),
      message: `The link's ${key} "${raw}" isn't a valid ${format} ${key}; using ${initialState[key]} instead. Check it.`,
    });
  });

  return { state: next, notifications };
}

/**
 * The link notifications still in force: each holds while its field still
 * holds the value the link load left there, and clears once the pilot
 * changes it.
 */
export function deriveUrlNotifications(
  state: WorksheetData,
  load: UrlLoadResult | null
): Notification[] {
  if (!load) return [];
  return load.notifications.filter((n) => {
    if (n.subject.kind !== "field") return true;
    return (
      JSON.stringify(readField(state, n.subject)) ===
      JSON.stringify(readField(load.state, n.subject))
    );
  });
}
