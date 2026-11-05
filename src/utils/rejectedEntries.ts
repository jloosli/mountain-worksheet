/**
 * Weather entries the pilot typed that were not applied because they are out
 * of range. Each keeps the raw text (still shown in its field) and a Warning
 * on the field. An entry is in force while the stored value is unchanged
 * from when it was rejected and no weather fetch has filled the field since;
 * a retired entry never comes back (`retireRejectedEntries`).
 *
 * The entries are held where notifications are derived (AppContainer), so
 * their Warnings reach step statuses, badges and the Briefing like any other.
 */
import type { Notification } from "./notifications";
import type { WorksheetData } from "./types";

/** A winds-aloft cell (`wind:<row>:<col>`) or an airport altimeter (`altimeter:<slot>`). */
export type RejectedEntryKey = `wind:${number}:${number}` | `altimeter:${number}`;

export interface RejectedEntry {
  /** What the pilot typed. */
  raw: string;
  /** The stored value when the entry was rejected. */
  storedValue: number | null;
  notification: Notification;
}

export type RejectedEntries = Partial<Record<RejectedEntryKey, RejectedEntry>>;

export const windEntryKey = (row: number, col: number): RejectedEntryKey =>
  `wind:${row}:${col}`;
export const altimeterEntryKey = (slot: number): RejectedEntryKey =>
  `altimeter:${slot}`;

function cellValue(
  data: Partial<WorksheetData>,
  key: RejectedEntryKey
): number | null | undefined {
  const [field, a, b] = key.split(":");
  return field === "wind"
    ? data.wind?.[Number(a)]?.[Number(b)]
    : data.altimeter?.[Number(a)];
}

function storedValue(state: WorksheetData, key: RejectedEntryKey): number | null {
  return cellValue(state, key) ?? null;
}

function activeEntries(
  state: WorksheetData,
  entries: RejectedEntries
): [RejectedEntryKey, RejectedEntry][] {
  return (Object.entries(entries) as [RejectedEntryKey, RejectedEntry | undefined][])
    .filter((pair): pair is [RejectedEntryKey, RejectedEntry] => pair[1] !== undefined)
    .filter(([key, entry]) => storedValue(state, key) === entry.storedValue);
}

/** The Warnings of the rejected entries still in force. */
export function rejectedEntryNotifications(
  state: WorksheetData,
  entries: RejectedEntries
): Notification[] {
  return activeEntries(state, entries).map(([, entry]) => entry.notification);
}

/** The raw text to show in a field whose entry was rejected, if one is in force. */
export function rejectedEntryText(
  state: WorksheetData,
  entries: RejectedEntries,
  key: RejectedEntryKey
): string | undefined {
  const entry = entries[key];
  return entry && storedValue(state, key) === entry.storedValue ? entry.raw : undefined;
}

/**
 * Records (`entry`) or clears (`null`) a rejected entry. Returns a new
 * object without entries that are no longer in force, so a cleared one can't
 * come back if the stored value later returns to what it was.
 */
export function updateRejectedEntries(
  state: WorksheetData,
  entries: RejectedEntries,
  key: RejectedEntryKey,
  entry: RejectedEntry | null
): RejectedEntries {
  const next: RejectedEntries = Object.fromEntries(
    activeEntries(state, entries).filter(([k]) => k !== key)
  );
  if (entry) next[key] = entry;
  return next;
}

/**
 * The entries that survive a worksheet update. An entry is retired for good
 * once its stored value has changed (so it can't reappear if the value later
 * returns), and an entry whose field a weather fetch filled (`replaced`) is
 * retired even when the fetch wrote the same number: the fetched value
 * supersedes what the pilot typed.
 */
export function retireRejectedEntries(
  next: WorksheetData,
  entries: RejectedEntries,
  replaced?: Partial<WorksheetData>
): RejectedEntries {
  const kept = activeEntries(next, entries).filter(
    ([key]) => !replaced || cellValue(replaced, key) === undefined
  );
  return kept.length === Object.keys(entries).length
    ? entries
    : Object.fromEntries(kept);
}
