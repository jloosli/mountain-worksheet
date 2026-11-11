/**
 * The weather session: the worksheet plus what this session remembers about
 * the events that changed it, as one pure reducer.
 *
 * Each piece of memory records an event (a weather fetch, an operating
 * temperature re-derivation, a rejected entry, the shared link it opened
 * from), is retired by later edits, and has notifications derived from it
 * plus the current worksheet (`sessionNotifications`). They clear when their
 * cause does (ADR 0001).
 */
import { canFetchWeather } from "./actionBarState";
import { normalizeAirportCode } from "./airportCode";
import {
  applyOpTempForAltitudeChange,
  describeOpTempChange,
  enteredPosition,
  opTempChangeNotifications,
  type OpTempChange,
} from "./areaOfOpsWeather";
import {
  readField,
  type Notification,
  type Subject,
  type WeatherFetchResult,
} from "./notifications";
import {
  rejectedEntryNotifications,
  retireRejectedEntries,
  updateRejectedEntries,
  type RejectedEntries,
  type RejectedEntry,
  type RejectedEntryKey,
} from "./rejectedEntries";
import type { WorksheetData } from "./types";
import { unverifiedWeatherNotifications } from "./unverifiedWeather";
import { hasWeatherData, type WeatherStatus } from "./weatherStatus";
import {
  deriveUrlNotifications,
  retireUrlNotifications,
  type UrlLoadResult,
} from "./worksheetUrlState";

export interface WeatherSession {
  worksheet: WorksheetData;
  /** The latest weather fetch this session, successful or not. */
  lastFetch: WeatherFetchResult | null;
  /**
   * The latest fetch this session that applied weather. Staleness is judged
   * against it, so a later failed fetch doesn't hide stale values.
   */
  lastApplied: WeatherFetchResult | null;
  /** When a fetch last applied weather this session; null if never. */
  lastUpdated: Date | null;
  /** The latest operating-temperature re-derivation (#117). */
  opTempChange: OpTempChange | null;
  /** Weather entries the pilot typed that were out of range and not applied. */
  rejected: RejectedEntries;
  /** The shared link's notifications still in force. */
  linkLoad: UrlLoadResult | null;
}

export type WeatherSessionEvent =
  /** The pilot changed worksheet values. */
  | { type: "edit"; updates: Partial<WorksheetData> }
  /**
   * A weather fetch finished. `data` is what it applies, or null when
   * nothing could be (a total failure); `result` carries its notifications.
   */
  | {
      type: "fetchApplied";
      data: Partial<WorksheetData> | null;
      result: WeatherFetchResult;
      at: Date;
    }
  /** The pilot typed an out-of-range entry (`entry`), or it was cleared (null). */
  | { type: "entryRejected"; key: RejectedEntryKey; entry: RejectedEntry | null };

export function initialWeatherSession(
  worksheet: WorksheetData,
  linkLoad: UrlLoadResult | null,
): WeatherSession {
  return {
    worksheet,
    lastFetch: null,
    lastApplied: null,
    lastUpdated: null,
    opTempChange: null,
    rejected: {},
    linkLoad,
  };
}

/**
 * Applies `updates` to the worksheet and retires the memory they supersede.
 * `fetched` marks values a weather fetch applied: rejected entries and link
 * notifications for the fields it filled are retired even when the value is
 * unchanged.
 */
function applyUpdates(
  session: WeatherSession,
  updates: Partial<WorksheetData>,
  fetched: boolean,
): WeatherSession {
  const prev = session.worksheet;
  const worksheet = { ...prev, ...updates } as WorksheetData;
  // #117: a new operating altitude re-derives temp[1] from the winds-aloft
  // temperatures, so it tracks the air at that altitude.
  const nextTemp = applyOpTempForAltitudeChange(prev, updates);
  if (nextTemp) worksheet.temp = nextTemp;
  const change = describeOpTempChange(prev, updates, {
    fetchedOpTemp: session.lastFetch?.applied.temp?.[1] ?? null,
    previous: session.opTempChange,
  });
  const replaced = fetched ? updates : undefined;
  return {
    ...session,
    worksheet,
    opTempChange: change ?? session.opTempChange,
    rejected: retireRejectedEntries(worksheet, session.rejected, replaced),
    linkLoad: session.linkLoad && retireUrlNotifications(session.linkLoad, worksheet, replaced),
  };
}

export function weatherSessionReducer(
  session: WeatherSession,
  event: WeatherSessionEvent,
): WeatherSession {
  switch (event.type) {
    case "edit":
      return applyUpdates(session, event.updates, false);
    case "fetchApplied": {
      const applied = event.data ? applyUpdates(session, event.data, true) : session;
      return {
        ...applied,
        lastFetch: event.result,
        lastApplied: event.data ? event.result : session.lastApplied,
        lastUpdated: event.data ? event.at : session.lastUpdated,
      };
    }
    case "entryRejected":
      return {
        ...session,
        rejected: updateRejectedEntries(
          session.worksheet,
          session.rejected,
          event.key,
          event.entry,
        ),
      };
  }
}

/**
 * Every notification the session's memory raises against its worksheet.
 * Pass the session's `weatherStatus` when it is already computed.
 */
export function sessionNotifications(
  session: WeatherSession,
  status: WeatherStatus = weatherStatus(session),
): Notification[] {
  const { worksheet, lastFetch } = session;
  return [
    ...fetchNotifications(worksheet, lastFetch),
    ...staleFetchNotifications(worksheet, session.lastApplied),
    ...opTempChangeNotifications(worksheet, session.opTempChange),
    ...deriveUrlNotifications(worksheet, session.linkLoad),
    ...unverifiedWeatherNotifications(worksheet, status),
    ...rejectedEntryNotifications(worksheet, session.rejected),
  ];
}

/**
 * Whether the worksheet has weather, and where it came from: the one answer
 * step statuses, the action bar and Unverified weather read.
 *
 * Once a fetch applies weather this session, it is `fetched` while every
 * fetched value still matches the fetch's inputs, and `stale` while any
 * doesn't (`staleFetchNotifications`). Before that, weather values on the
 * worksheet are `unverified`; without any, `none`.
 */
export function weatherStatus(session: WeatherSession): WeatherStatus {
  const { worksheet, lastApplied, lastUpdated } = session;
  if (lastUpdated !== null) {
    return staleFetchNotifications(worksheet, lastApplied).length > 0 ? "stale" : "fetched";
  }
  return hasWeatherData(worksheet) ? "unverified" : "none";
}

/** Whether the worksheet holds what a weather fetch needs. */
export const canFetch = (session: WeatherSession): boolean => canFetchWeather(session.worksheet);

// ---------------------------------------------------------------------------
// Fetched fields and the fetch inputs they depend on
// ---------------------------------------------------------------------------

type FetchedFor = WeatherFetchResult["fetchedFor"];
type FieldSubject = Extract<Subject, { kind: "field" }>;

/** An input a weather fetch was made for. */
type FetchInput =
  | "departureAirport"
  | "arrivalAirport"
  /** Date and time: the departure time. */
  | "departureTime"
  /** Moves the arrival time and the area-of-ops midpoint time. */
  | "duration"
  /** The area-of-ops point: the entered position, or the airport midpoint. */
  | "areaPoint";

const ALL_INPUTS: readonly FetchInput[] = [
  "departureAirport",
  "arrivalAirport",
  "departureTime",
  "duration",
  "areaPoint",
];

type FetchedGroup = "departure" | "arrival" | "area";

interface FetchedFieldRow {
  subject: FieldSubject;
  /** Whose weather it is, which names it in a stale Warning. */
  group: FetchedGroup;
  dependsOn: readonly FetchInput[];
  /**
   * False for a field the fetch can warn on but never fills, so its value
   * is never stale.
   */
  filled?: false;
}

const field = (f: FieldSubject["field"], index?: number): FieldSubject =>
  index === undefined ? { kind: "field", field: f } : { kind: "field", field: f, index };

const airportRows = (
  slot: 0 | 2,
  group: "departure" | "arrival",
  airport: FetchInput,
  time: readonly FetchInput[],
): FetchedFieldRow[] => [
  ...(["temp", "altimeter"] as const).map((f) => ({
    subject: field(f, slot),
    group,
    dependsOn: [airport, ...time],
  })),
  // The field elevation and runway length belong to the airport, not the time.
  { subject: field("altitude", slot), group, dependsOn: [airport] },
  { subject: field("rwy", slot === 0 ? 0 : 1), group, dependsOn: [airport] },
];

const AREA_INPUTS: readonly FetchInput[] = ["areaPoint", "departureTime", "duration"];

const areaRow = (subject: FieldSubject): FetchedFieldRow => ({
  subject,
  group: "area",
  dependsOn: AREA_INPUTS,
});

/**
 * Every field a weather fetch fills, with the fetch inputs it depends on.
 * Departure weather is for the departure time; arrival weather for
 * departure + duration; area weather (operating temperature and altimeter,
 * winds aloft, the G-AIRMET flags) for the area-of-ops point at the midpoint
 * time. A field's value goes stale, and a fetch Warning on it retires, when
 * one of its inputs changes.
 *
 * The area-of-ops position isn't fetched, but a fetch can warn on it (no
 * position and no airport coordinates for a midpoint); that Warning is about
 * the area point alone.
 */
const FETCHED_FIELDS: readonly FetchedFieldRow[] = [
  ...airportRows(0, "departure", "departureAirport", ["departureTime"]),
  ...airportRows(2, "arrival", "arrivalAirport", ["departureTime", "duration"]),
  areaRow(field("temp", 1)),
  areaRow(field("altimeter", 1)),
  ...[0, 1, 2, 3, 4].map((i) => areaRow(field("wind", i))),
  ...(["turb", "cielVis", "mtnObsc"] as const).map((f) => areaRow(field(f))),
  { subject: field("position"), group: "area", dependsOn: ["areaPoint"], filled: false },
];

/**
 * The fetch inputs a field depends on. A whole-field Subject (such as the
 * whole winds-aloft table) depends on what any of its slots does; a field
 * the fetch doesn't fill, like a step, depends on every input.
 */
function inputsOf(subject: Subject): readonly FetchInput[] {
  if (subject.kind !== "field") return ALL_INPUTS;
  const rows = FETCHED_FIELDS.filter(
    (row) =>
      row.subject.field === subject.field &&
      (subject.index === undefined ||
        row.subject.index === undefined ||
        row.subject.index === subject.index),
  );
  if (rows.length === 0) return ALL_INPUTS;
  return [...new Set(rows.flatMap((row) => row.dependsOn))];
}

/**
 * Hours from departure to arrival as the weather fetch uses them: a blank,
 * zero or invalid duration all mean arrival at the departure time.
 */
function effectiveDuration(duration: number | null | undefined): number {
  return typeof duration === "number" && Number.isFinite(duration) && duration > 0 ? duration : 0;
}

/**
 * The fetch inputs that differ between the worksheet and the fetch. A
 * position that isn't fully entered means the airport midpoint, so typing or
 * clearing one coordinate of it is no change; the midpoint moves with
 * either airport.
 */
function changedInputs(state: WorksheetData, fetchedFor: FetchedFor): Set<FetchInput> {
  const changed = new Set<FetchInput>();
  const airportChanged = (i: 0 | 1) =>
    normalizeAirportCode(state.airport[i]) !== normalizeAirportCode(fetchedFor.airport[i]);
  if (airportChanged(0)) changed.add("departureAirport");
  if (airportChanged(1)) changed.add("arrivalAirport");
  if (state.date !== fetchedFor.date || state.time !== fetchedFor.time)
    changed.add("departureTime");
  if (effectiveDuration(state.duration) !== effectiveDuration(fetchedFor.duration)) {
    changed.add("duration");
  }
  const now = enteredPosition(state.position);
  const then = enteredPosition(fetchedFor.position);
  const positionMoved = !now || !then ? now !== then : now[0] !== then[0] || now[1] !== then[1];
  if (positionMoved || (then === null && (airportChanged(0) || airportChanged(1)))) {
    changed.add("areaPoint");
  }
  return changed;
}

function describePosition(position: WorksheetData["position"]): string {
  const entered = enteredPosition(position);
  return entered ? `${entered[0].toFixed(4)}, ${entered[1].toFixed(4)}` : "the airport midpoint";
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.every(isBlank);
  return false;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The latest fetch's own notifications still in force. Pure; call it during
 * render.
 *
 * - A Warning (on a field or a step) holds while none of the fetch inputs it
 *   depends on has changed (`FETCHED_FIELDS`), and, on a field, while the
 *   field is blank: the pilot clears it by entering a value.
 * - A field Caution or Advisory holds while the field still holds the value
 *   the fetch applied: it follows the value it describes, so it survives an
 *   input change. A step Caution or Advisory describes the fetch, so it
 *   holds while no fetch input has changed.
 */
export function fetchNotifications(
  state: WorksheetData,
  fetch: WeatherFetchResult | null,
): Notification[] {
  if (!fetch) return [];
  const changed = changedInputs(state, fetch.fetchedFor);
  const inputsHold = (subject: Subject) => !inputsOf(subject).some((i) => changed.has(i));
  return fetch.notifications.filter((n) => {
    const { subject } = n;
    if (subject.kind !== "field") return inputsHold(subject);
    const current = readField(state, subject);
    if (n.level === "warning") {
      // A winds-aloft column needs all of dir/vel/temp, so its Warning holds
      // until every cell in the column is filled.
      const unresolved =
        subject.field === "wind" && subject.index !== undefined
          ? Array.isArray(current) && current.some(isBlank)
          : isBlank(current);
      return inputsHold(subject) && unresolved;
    }
    return sameValue(current, readField(fetch.applied, subject));
  });
}

/**
 * A Warning on each fetched field that still holds the fetched value after
 * a fetch input it depends on has changed (`FETCHED_FIELDS`). Each clears
 * once the pilot enters their own value or weather is fetched for the
 * current inputs. Nothing is blanked.
 */
export function staleFetchNotifications(
  state: WorksheetData,
  fetch: WeatherFetchResult | null,
): Notification[] {
  if (!fetch) return [];
  const { fetchedFor, applied } = fetch;
  const changed = changedInputs(state, fetchedFor);
  const fetchedDuration = effectiveDuration(fetchedFor.duration);
  const when =
    `${fetchedFor.date} ${fetchedFor.time}` +
    (changed.has("duration")
      ? fetchedDuration > 0
        ? ` with a ${fetchedDuration} h duration`
        : " with no duration"
      : "");
  const where: Record<FetchedGroup, string> = {
    departure: `${normalizeAirportCode(fetchedFor.airport[0])} at `,
    arrival: `${normalizeAirportCode(fetchedFor.airport[1])} at `,
    area: changed.has("areaPoint") ? `${describePosition(fetchedFor.position)} at ` : "",
  };

  return FETCHED_FIELDS.filter(({ subject, dependsOn, filled }) => {
    if (filled === false || !dependsOn.some((i) => changed.has(i))) return false;
    const fetchedValue = readField(applied, subject);
    return (
      fetchedValue !== undefined &&
      fetchedValue !== -1 &&
      !isBlank(fetchedValue) &&
      sameValue(readField(state, subject), fetchedValue)
    );
  }).map(({ subject, group }): Notification => ({
    level: "warning",
    subject,
    message: `Fetched for ${where[group]}${when}; refetch weather.`,
  }));
}
