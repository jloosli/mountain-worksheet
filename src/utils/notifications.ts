/**
 * The worksheet notification model. See GLOSSARY.md (Notifications) and
 * docs/adr/0001-notification-model.md.
 *
 * Producers return structured `Notification`s; nothing parses message text.
 * What the pilot sees is derived during render from current worksheet state
 * plus the latest fetch result (`deriveNotifications`), so a notification
 * disappears exactly when its cause does. Nothing is dismissable.
 */
import type { WorksheetData } from "./types";
import { normalizeAirportCode } from "./airportCode";
import { enteredPosition } from "./areaOfOpsWeather";

/** FAA-style alert levels: Warning (red), Caution (amber), Advisory (neutral). */
export type NotificationLevel = "warning" | "caution" | "advisory";

export const NOTIFICATION_LEVELS: readonly NotificationLevel[] = [
  "warning",
  "caution",
  "advisory",
];

export type StepId = "sortie" | "weather" | "decision";

export type FieldName = keyof WorksheetData;

/**
 * The thing a notification is about.
 *
 * - `field`: an input field. `index` selects one slot of an array field
 *   (`temp`, `altimeter`, `altitude`, `rwy`, `airport`); for `wind` it selects
 *   an altitude column (dir/vel/temp at that altitude). Omit `index` for the
 *   whole field.
 * - `value`: a computed value, identified by a stable id, on a given step.
 * - `step`: a whole worksheet step.
 */
export type Subject =
  | { kind: "field"; field: FieldName; index?: number }
  | { kind: "value"; id: string; step: StepId }
  | { kind: "step"; step: StepId };

export interface Notification {
  level: NotificationLevel;
  subject: Subject;
  /** Pilot-facing text. Never parsed. */
  message: string;
}

/** A notification before its producer's caller has attached a Subject. */
export type NotificationDraft = Omit<Notification, "subject">;

export const fieldSubject = (field: FieldName, index?: number): Subject =>
  index === undefined ? { kind: "field", field } : { kind: "field", field, index };

export const stepSubject = (step: StepId): Subject => ({ kind: "step", step });

export const valueSubject = (id: string, step: StepId): Subject => ({
  kind: "value",
  id,
  step,
});

export const withSubject = (
  draft: NotificationDraft,
  subject: Subject
): Notification => ({ ...draft, subject });

export function subjectKey(subject: Subject): string {
  switch (subject.kind) {
    case "field":
      return subject.index === undefined
        ? `field:${subject.field}`
        : `field:${subject.field}.${subject.index}`;
    case "value":
      return `value:${subject.id}`;
    case "step":
      return `step:${subject.step}`;
  }
}

/** Stable identity of a notification, for removing duplicates. */
export const notificationKey = (n: Notification): string =>
  `${n.level}|${subjectKey(n.subject)}|${n.message}`;

/** The groups of computed values; a value Subject id starts with its group. */
export const VALUE_SUBJECT_GROUPS = ["told", "climb", "maneuvering"] as const;
export type ValueSubjectGroup = (typeof VALUE_SUBJECT_GROUPS)[number];

/**
 * The group of computed values a value Subject belongs to ("told" for
 * `told.arrival.landing`), or undefined for other Subjects and unknown ids.
 */
export function valueSubjectGroup(subject: Subject): ValueSubjectGroup | undefined {
  if (subject.kind !== "value") return undefined;
  const head = subject.id.split(".", 1)[0];
  return VALUE_SUBJECT_GROUPS.find((g) => g === head);
}

const SORTIE_FIELDS: ReadonlySet<FieldName> = new Set<FieldName>([
  "pilot",
  "date",
  "time",
  "duration",
  "acType",
  "tailN",
  "airport",
  "route",
  "position",
  "weight",
  "mtnEndorse",
  "mtnCert",
]);

/** The step on which a subject is shown and counted. */
export function stepOf(subject: Subject): StepId {
  if (subject.kind !== "field") return subject.step;
  if (SORTIE_FIELDS.has(subject.field)) return "sortie";
  // Operating altitude is entered in Sortie Details; field elevations are
  // shown on the weather step's airport cards.
  if (subject.field === "altitude" && subject.index === 1) return "sortie";
  return "weather";
}

export function notificationsFor(
  notifications: readonly Notification[],
  subject: Subject
): Notification[] {
  const key = subjectKey(subject);
  return notifications.filter((n) => subjectKey(n.subject) === key);
}

export function notificationsOnStep(
  notifications: readonly Notification[],
  step: StepId
): Notification[] {
  return notifications.filter((n) => stepOf(n.subject) === step);
}

export type LevelCounts = Record<NotificationLevel, number>;

export function countByLevel(notifications: readonly Notification[]): LevelCounts {
  const counts: LevelCounts = { warning: 0, caution: 0, advisory: 0 };
  for (const n of notifications) counts[n.level]++;
  return counts;
}

/** The latest weather fetch, as needed to derive its notifications. */
export interface WeatherFetchResult {
  /**
   * The sortie inputs the fetch was made for. `duration` sets the arrival
   * time (departure + duration) and the area-of-ops midpoint time.
   * `position` is the entered area-of-ops position (`[null, null]` when the
   * fetch used the airport midpoint).
   */
  fetchedFor: {
    airport: [string, string];
    date: string;
    time: string;
    duration: number | null;
    position: WorksheetData["position"];
  };
  /** The worksheet values the fetch applied (after merging). */
  applied: Partial<WorksheetData>;
  notifications: Notification[];
}

/**
 * Reads the value a field subject points at. For a `wind` column this is
 * `[dir, vel, temp]` at that altitude.
 */
export function readField(
  data: Partial<WorksheetData>,
  subject: Extract<Subject, { kind: "field" }>
): unknown {
  const value = data[subject.field];
  if (subject.index === undefined) return value;
  if (!Array.isArray(value)) return undefined;
  if (subject.field === "wind") {
    return (value as (number | null)[][]).map((row) => row?.[subject.index!]);
  }
  return value[subject.index];
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
 * Hours from departure to arrival as the weather fetch uses them: a blank,
 * zero or invalid duration all mean arrival at the departure time.
 */
function effectiveDuration(duration: number | null | undefined): number {
  return typeof duration === "number" && Number.isFinite(duration) && duration > 0
    ? duration
    : 0;
}

function durationChanged(
  state: WorksheetData,
  fetchedFor: WeatherFetchResult["fetchedFor"]
): boolean {
  return effectiveDuration(state.duration) !== effectiveDuration(fetchedFor.duration);
}

function positionChanged(
  state: WorksheetData,
  fetchedFor: WeatherFetchResult["fetchedFor"]
): boolean {
  return (
    state.position[0] !== fetchedFor.position[0] ||
    state.position[1] !== fetchedFor.position[1]
  );
}

/**
 * The fetch uses the airport midpoint for the area weather unless both
 * coordinates are entered, so the area then moves with either airport.
 */
function usesAirportMidpoint(position: WorksheetData["position"]): boolean {
  return enteredPosition(position) === null;
}

function describePosition(position: WorksheetData["position"]): string {
  const entered = enteredPosition(position);
  return entered
    ? `${entered[0].toFixed(4)}, ${entered[1].toFixed(4)}`
    : "the airport midpoint";
}

function fetchInputsUnchanged(
  state: WorksheetData,
  fetchedFor: WeatherFetchResult["fetchedFor"]
): boolean {
  return (
    normalizeAirportCode(state.airport[0]) ===
      normalizeAirportCode(fetchedFor.airport[0]) &&
    normalizeAirportCode(state.airport[1]) ===
      normalizeAirportCode(fetchedFor.airport[1]) &&
    state.date === fetchedFor.date &&
    state.time === fetchedFor.time
  );
}


/**
 * Fields fetched for the area-of-ops position rather than at an airport:
 * operating temperature and altimeter, winds aloft and the G-AIRMET flags.
 */
function isAreaField(subject: Extract<Subject, { kind: "field" }>): boolean {
  switch (subject.field) {
    case "wind":
    case "turb":
    case "cielVis":
    case "mtnObsc":
      return true;
    case "temp":
    case "altimeter":
      return subject.index === 1;
    default:
      return false;
  }
}

/**
 * Fields fetched for a time the duration moves: the arrival airport's
 * weather (departure + duration) and the area weather (the midpoint time).
 * Departure weather, elevations and runways don't depend on it.
 */
function isMovedByDuration(subject: Extract<Subject, { kind: "field" }>): boolean {
  if (subject.field === "temp" || subject.field === "altimeter") {
    if (subject.index === 2) return true;
  }
  return isAreaField(subject);
}

/**
 * Derives the notifications currently in force from worksheet state plus the
 * latest fetch result. Pure; call it during render.
 *
 * A fetch notification holds while its cause does:
 * - on a field, a Warning holds while the field is blank (the pilot clears it
 *   by entering a value); a Caution or Advisory holds while the field still
 *   holds the value the fetch applied (the pilot clears it by overriding);
 * - Warnings and step notifications also need the fetch's airports, date
 *   and time to be unchanged, since they describe that fetch. The duration
 *   also counts for step notifications and Warnings on arrival and area
 *   weather, which are fetched for times it moves. The area-of-ops position also counts for step
 *   notifications and Warnings on area fields, but not for airport fields,
 *   which are fetched at the airport. A field Caution follows the value it
 *   describes, so it survives an input change.
 */
export function deriveNotifications(
  state: WorksheetData,
  fetch: WeatherFetchResult | null
): Notification[] {
  if (!fetch) return [];
  const inputsUnchanged = fetchInputsUnchanged(state, fetch.fetchedFor);
  const durationMoved = durationChanged(state, fetch.fetchedFor);
  const positionMoved = positionChanged(state, fetch.fetchedFor);
  return fetch.notifications.filter((n) => {
    const { subject } = n;
    if (subject.kind !== "field") {
      return inputsUnchanged && !durationMoved && !positionMoved;
    }
    const current = readField(state, subject);
    if (n.level === "warning") {
      // A winds-aloft column needs all of dir/vel/temp, so its Warning holds
      // until every cell in the column is filled.
      const unresolved =
        subject.field === "wind" && subject.index !== undefined
          ? Array.isArray(current) && current.some(isBlank)
          : isBlank(current);
      return (
        inputsUnchanged &&
        !(durationMoved && isMovedByDuration(subject)) &&
        !(positionMoved && isAreaField(subject)) &&
        unresolved
      );
    }
    return sameValue(current, readField(fetch.applied, subject));
  });
}

type FieldSubject = Extract<Subject, { kind: "field" }>;

const AIRPORT_WEATHER_FIELDS = (slot: 0 | 2): FieldSubject[] => [
  { kind: "field", field: "temp", index: slot },
  { kind: "field", field: "altimeter", index: slot },
  { kind: "field", field: "altitude", index: slot },
];

/** Fetched fields that belong to the sortie area and time, not to one airport. */
const AREA_WEATHER_FIELDS: FieldSubject[] = [
  { kind: "field", field: "temp", index: 1 },
  { kind: "field", field: "altimeter", index: 1 },
  ...[0, 1, 2, 3, 4].map((index): FieldSubject => ({ kind: "field", field: "wind", index })),
  { kind: "field", field: "turb" },
  { kind: "field", field: "cielVis" },
  { kind: "field", field: "mtnObsc" },
];

/**
 * A Warning on each fetched weather field that still holds the fetched value
 * after the airport, date or time it was fetched for has changed. An
 * airport's fields (including its runway length) go stale when that airport
 * changes; every fetched weather field goes stale when the date or time
 * changes. A duration change moves the arrival time (departure + duration)
 * and the area-of-ops midpoint time, so it stales the arrival airport's
 * weather and the area weather, but not the departure's. An area-of-ops
 * position change stales the area weather only, as does an airport change
 * when the fetch used the airport midpoint. Each Warning clears once the
 * pilot enters their own value or weather is fetched for the current inputs.
 * Nothing is blanked. Field Cautions from the fetch still follow their values
 * (`deriveNotifications`).
 */
export function staleFetchNotifications(
  state: WorksheetData,
  fetch: WeatherFetchResult | null
): Notification[] {
  if (!fetch) return [];
  const { fetchedFor, applied } = fetch;
  const departureChanged =
    state.date !== fetchedFor.date || state.time !== fetchedFor.time;
  const durationMoved = durationChanged(state, fetchedFor);
  const fetchedDuration = effectiveDuration(fetchedFor.duration);
  const when =
    `${fetchedFor.date} ${fetchedFor.time}` +
    (durationMoved
      ? fetchedDuration > 0
        ? ` with a ${fetchedDuration} h duration`
        : " with no duration"
      : "");
  // Departure weather is for the departure time; arrival and area weather
  // are for times that also depend on the duration.
  const timeChanged = (i: 0 | 1) => departureChanged || (i === 1 && durationMoved);
  const areaTimeChanged = departureChanged || durationMoved;
  const positionMoved = positionChanged(state, fetchedFor);
  const airportChanged = (i: 0 | 1) =>
    normalizeAirportCode(state.airport[i]) !== normalizeAirportCode(fetchedFor.airport[i]);

  const stale: { subjects: FieldSubject[]; message: string }[] = [];
  ([0, 1] as const).forEach((i) => {
    if (!timeChanged(i) && !airportChanged(i)) return;
    stale.push({
      subjects: [
        ...AIRPORT_WEATHER_FIELDS(i === 0 ? 0 : 2),
        // A runway length belongs to the airport, not the time.
        ...(airportChanged(i) ? [{ kind: "field" as const, field: "rwy" as const, index: i }] : []),
      ],
      message: `Fetched for ${normalizeAirportCode(fetchedFor.airport[i])} at ${when}; refetch weather.`,
    });
  });
  const areaPointMoved =
    positionMoved ||
    (usesAirportMidpoint(fetchedFor.position) && (airportChanged(0) || airportChanged(1)));
  if (areaTimeChanged || areaPointMoved) {
    const where = areaPointMoved ? `${describePosition(fetchedFor.position)} at ` : "";
    stale.push({
      subjects: AREA_WEATHER_FIELDS,
      message: `Fetched for ${where}${when}; refetch weather.`,
    });
  }

  return stale.flatMap(({ subjects, message }) =>
    subjects
      .filter((subject) => {
        const fetchedValue = readField(applied, subject);
        return (
          fetchedValue !== undefined &&
          fetchedValue !== -1 &&
          !isBlank(fetchedValue) &&
          sameValue(readField(state, subject), fetchedValue)
        );
      })
      .map((subject): Notification => ({ level: "warning", subject, message }))
  );
}
