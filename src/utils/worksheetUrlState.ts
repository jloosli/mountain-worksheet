/**
 * Checks a worksheet opened from a link for values the URL deserializer
 * coerced or passed through (`urlState.ts` is type-hinted, not validated),
 * and raises a Warning for each one on its field.
 */
import { fieldSubject, type Notification, type Subject } from "./notifications";
import type { WorksheetData } from "./types";
import {
  ALTIMETER_RANGE_TEXT,
  isValidAltimeterEntry,
  isValidWindEntry,
  WIND_RANGE_TEXT,
  WIND_ROW_LABEL,
  type WindRow,
} from "./weatherEntryLimits";

/**
 * The value a link notification is about: a whole field, one slot
 * (`index`), or one winds-aloft cell (`row` and `index` as the column). It can
 * be narrower than the notification's Subject, which is where it is shown
 * (a winds-aloft column, the whole position).
 */
export interface UrlCell {
  field: keyof WorksheetData;
  index?: number;
  row?: number;
}

export interface UrlLoadResult {
  /** The worksheet with malformed values cleared or reset. */
  state: WorksheetData;
  notifications: Notification[];
  /** The value each notification is about, by position in `notifications`. */
  cells: UrlCell[];
}

function readCell(data: Partial<WorksheetData>, cell: UrlCell): unknown {
  const value = data[cell.field] as unknown;
  if (cell.index === undefined) return value;
  if (!Array.isArray(value)) return undefined;
  if (cell.row !== undefined) {
    const row = value[cell.row] as unknown;
    return Array.isArray(row) ? row[cell.index] : undefined;
  }
  return value[cell.index];
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const NUMERIC_SCALARS = ["weight", "duration"] as const;
const NUMERIC_ARRAYS = ["temp", "altimeter", "altitude", "rwy", "position"] as const;
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

/** A YYYY-MM-DD string naming a day that exists on the calendar. */
const isCalendarDate = (raw: string): boolean => {
  if (!DATE_RE.test(raw)) return false;
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const isMalformedNumber = (v: unknown) =>
  v !== null && v !== undefined && !(typeof v === "number" && Number.isFinite(v));

const notANumber = (subject: Subject, raw: unknown): Notification => {
  const field = subject.kind === "field" ? subject.field : undefined;
  return {
    level: "warning",
    subject,
    message: `The link's ${LABEL[field!] ?? field} value "${String(
      raw,
    )}" isn't a number; it was cleared. Enter it again.`,
  };
};

const outOfLimits = (
  subject: Subject,
  label: string,
  value: number,
  range: string,
): Notification => ({
  level: "warning",
  subject,
  message: `The link's ${label} value ${value} isn't valid (enter ${range}); it was cleared. Enter it again.`,
});

export function sanitizeWorksheetUrlState(
  state: WorksheetData,
  query: string | URLSearchParams | null,
  initialState: WorksheetData,
): UrlLoadResult {
  const params = new URLSearchParams(
    query instanceof URLSearchParams ? query.toString() : (query ?? ""),
  );
  const next: WorksheetData = { ...state };
  const notifications: Notification[] = [];
  const cells: UrlCell[] = [];
  const warn = (cell: UrlCell, notification: Notification) => {
    notifications.push(notification);
    cells.push(cell);
  };

  for (const key of NUMERIC_SCALARS) {
    const v = next[key] as unknown;
    if (isMalformedNumber(v)) {
      warn({ field: key }, notANumber(fieldSubject(key), v));
      (next as unknown as Record<string, unknown>)[key] = null;
    }
  }

  for (const key of NUMERIC_ARRAYS) {
    // Each list has a fixed slot per airport/column; pad or cut it to fit, or
    // clear it if it isn't a list, so nothing downstream reads a missing slot.
    const size = (initialState[key] as unknown[]).length;
    const shapeSubject = key === "position" ? fieldSubject(key) : fieldSubject(key, 0);
    const raw = next[key] as unknown;
    let arr: unknown[];
    if (!Array.isArray(raw)) {
      arr = Array(size).fill(null);
      if (raw !== null && raw !== undefined) {
        warn(
          { field: key },
          {
            level: "warning",
            subject: shapeSubject,
            message: `The link's ${LABEL[key]} value isn't a list; it was cleared. Enter it again.`,
          },
        );
      }
    } else {
      arr = Array.from({ length: size }, (_, i) => raw[i] ?? null);
      const hasValue = raw.some((v) => v !== null && v !== undefined && v !== "");
      if (raw.length !== size && hasValue) {
        warn(
          { field: key },
          {
            level: "warning",
            subject: shapeSubject,
            message: `The link's ${LABEL[key]} list has ${raw.length} value${
              raw.length === 1 ? "" : "s"
            } instead of ${size}; ${
              raw.length < size ? "missing entries were left blank" : "extra entries were dropped"
            }. Check it.`,
          },
        );
      }
    }
    const cleaned = arr.map((v, i) => {
      if (key === "altimeter" && typeof v === "number" && !isValidAltimeterEntry(v)) {
        warn(
          { field: key, index: i },
          outOfLimits(fieldSubject(key, i), LABEL[key]!, v, ALTIMETER_RANGE_TEXT),
        );
        return null;
      }
      if (!isMalformedNumber(v)) return v ?? null;
      // The position is shown and edited as one Area of Operations entry,
      // so its notifications are on the whole field, not one coordinate.
      const subject = key === "position" ? fieldSubject(key) : fieldSubject(key, i);
      warn({ field: key, index: i }, notANumber(subject, v));
      return null;
    });
    (next as unknown as Record<string, unknown>)[key] = cleaned;
  }

  if (Array.isArray(next.wind)) {
    next.wind = next.wind.map((row, r) =>
      Array.isArray(row)
        ? row.map((v, col) => {
            if (typeof v === "number" && r <= 2 && !isValidWindEntry(r as WindRow, v)) {
              warn(
                { field: "wind", row: r, index: col },
                outOfLimits(fieldSubject("wind", col), WIND_ROW_LABEL[r], v, WIND_RANGE_TEXT[r]),
              );
              return null;
            }
            if (!isMalformedNumber(v)) return v ?? null;
            warn({ field: "wind", row: r, index: col }, notANumber(fieldSubject("wind", col), v));
            return null;
          })
        : row,
    ) as WorksheetData["wind"];
  }

  // The winds-aloft table is read as fixed rows (direction, speed,
  // temperature) by altitude column; any other shape is padded or cut to fit.
  const rows = initialState.wind.length;
  const cols = initialState.wind[0].length;
  const wind = next.wind as unknown;
  const wellShaped =
    Array.isArray(wind) &&
    wind.length === rows &&
    wind.every((row) => Array.isArray(row) && row.length === cols);
  if (!wellShaped) {
    const source = Array.isArray(wind) ? wind : [];
    next.wind = Array.from({ length: rows }, (_, r) => {
      const row = Array.isArray(source[r]) ? (source[r] as unknown[]) : [];
      return Array.from({ length: cols }, (_, c) =>
        typeof row[c] === "number" ? (row[c] as number) : null,
      );
    }) as WorksheetData["wind"];
    warn(
      { field: "wind" },
      {
        level: "warning",
        subject: fieldSubject("wind"),
        message:
          "The link's winds aloft table doesn't have a direction, speed and temperature row for every altitude; missing entries were left blank. Check it.",
      },
    );
  }

  for (const key of FLAGS) {
    const raw = params.get(key);
    if (raw === null || ["0", "1", "true", "false"].includes(raw)) continue;
    warn(
      { field: key },
      {
        level: "warning",
        subject: fieldSubject(key),
        message: `The link's ${LABEL[key]} value "${raw}" isn't on or off; it was read as ${
          next[key] ? "on" : "off"
        }. Check it.`,
      },
    );
  }

  (
    [
      ["date", isCalendarDate, "YYYY-MM-DD"],
      ["time", (raw: string) => TIME_RE.test(raw), "HH:MM UTC"],
    ] as const
  ).forEach(([key, isValid, format]) => {
    const raw = params.get(key);
    if (raw === null || isValid(raw)) return;
    next[key] = initialState[key];
    warn(
      { field: key },
      {
        level: "warning",
        subject: fieldSubject(key),
        message: `The link's ${key} "${raw}" isn't a valid ${format} ${key}; using ${initialState[key]} instead. Check it.`,
      },
    );
  });

  return { state: next, notifications, cells };
}

/**
 * The link notifications still in force: each holds while the value it is
 * about (its cell, not its whole Subject) still holds what the link load left
 * there, and clears once that value changes.
 */
export function deriveUrlNotifications(
  state: WorksheetData,
  load: UrlLoadResult | null,
): Notification[] {
  if (!load) return [];
  return load.notifications.filter((_, i) =>
    sameValue(readCell(state, load.cells[i]), readCell(load.state, load.cells[i])),
  );
}

/**
 * The link load with notifications retired for good once superseded: the
 * value each is about has changed in `next`, or a weather fetch filled it
 * (`replaced`, even with the same value). A retired notification never
 * comes back, even if the value later returns to what the link left.
 */
export function retireUrlNotifications(
  load: UrlLoadResult,
  next: WorksheetData,
  replaced?: Partial<WorksheetData>,
): UrlLoadResult {
  const keep = load.cells.map(
    (cell) =>
      sameValue(readCell(next, cell), readCell(load.state, cell)) &&
      (!replaced || readCell(replaced, cell) === undefined),
  );
  if (keep.every(Boolean)) return load;
  return {
    state: load.state,
    notifications: load.notifications.filter((_, i) => keep[i]),
    cells: load.cells.filter((_, i) => keep[i]),
  };
}
