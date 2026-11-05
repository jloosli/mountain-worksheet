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
  /** The sortie inputs the fetch was made for. */
  fetchedFor: { airport: [string, string]; date: string; time: string };
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
 * Derives the notifications currently in force from worksheet state plus the
 * latest fetch result. Pure; call it during render.
 *
 * A fetch notification holds while its cause does:
 * - on a field, a Warning holds while the field is blank (the pilot clears it
 *   by entering a value); a Caution or Advisory holds while the field still
 *   holds the value the fetch applied (the pilot clears it by overriding);
 * - Warnings and step notifications also need the fetch's airports, date and
 *   time to be unchanged, since they describe that fetch. A field Caution
 *   follows the value it describes, so it survives an input change.
 */
export function deriveNotifications(
  state: WorksheetData,
  fetch: WeatherFetchResult | null
): Notification[] {
  if (!fetch) return [];
  const inputsUnchanged = fetchInputsUnchanged(state, fetch.fetchedFor);
  return fetch.notifications.filter((n) => {
    const { subject } = n;
    if (subject.kind !== "field") return inputsUnchanged;
    const current = readField(state, subject);
    if (n.level === "warning") {
      // A winds-aloft column needs all of dir/vel/temp, so its Warning holds
      // until every cell in the column is filled.
      const unresolved =
        subject.field === "wind" && subject.index !== undefined
          ? Array.isArray(current) && current.some(isBlank)
          : isBlank(current);
      return inputsUnchanged && unresolved;
    }
    return sameValue(current, readField(fetch.applied, subject));
  });
}
