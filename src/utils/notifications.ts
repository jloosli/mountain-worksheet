/**
 * The worksheet notification model. See GLOSSARY.md (Notifications) and
 * docs/adr/0001-notification-model.md.
 *
 * Producers return structured `Notification`s; nothing parses message text.
 * What the pilot sees is derived during render from current worksheet state
 * plus what the session remembers (`sessionNotifications` in
 * weatherSession.ts), so a notification disappears exactly when its cause
 * does. Nothing is dismissable.
 */
import type { WorksheetData } from "./types";

/** FAA-style alert levels: Warning (red), Caution (amber), Advisory (neutral). */
export type NotificationLevel = "warning" | "caution" | "advisory";

export const NOTIFICATION_LEVELS: readonly NotificationLevel[] = ["warning", "caution", "advisory"];

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
  /**
   * The inputs this notification is about when its Subject is wider, such as
   * a Caution on the weather step about every weather field. A value computed
   * from one of them rests on it (`substitutionsFor`). A field Subject
   * without an index covers every slot of that field.
   */
  covers?: Subject[];
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

export const withSubject = (draft: NotificationDraft, subject: Subject): Notification => ({
  ...draft,
  subject,
});

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
  subject: Subject,
): Notification[] {
  const key = subjectKey(subject);
  return notifications.filter((n) => subjectKey(n.subject) === key);
}

export function notificationsOnStep(
  notifications: readonly Notification[],
  step: StepId,
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
   * `position` is the area-of-ops position as entered; when it isn't fully
   * entered (either coordinate null) the fetch used the airport midpoint.
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
  subject: Extract<Subject, { kind: "field" }>,
): unknown {
  const value = data[subject.field];
  if (subject.index === undefined) return value;
  if (!Array.isArray(value)) return undefined;
  if (subject.field === "wind") {
    return (value as (number | null)[][]).map((row) => row?.[subject.index!]);
  }
  return value[subject.index];
}
