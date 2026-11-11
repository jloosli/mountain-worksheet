/**
 * The Briefing's view of the notifications in force (GLOSSARY.md, Briefing):
 * every Warning and Caution, numbered so a value can point at the note that
 * concerns it; Advisories are left off. Built from the same derived
 * notifications the screen shows.
 */
import { inputCautions, type MarkableValue } from "./markers";
import {
  notificationKey,
  subjectKey,
  valueSubjectGroup,
  type Notification,
  type Subject,
} from "./notifications";

/** The Briefing sections a note can be printed under, in print order. */
export const BRIEFING_SECTIONS = [
  "sortie",
  "conditions",
  "environment",
  "told",
  "climb",
  "maneuvering",
  "general",
] as const;
export type BriefingSection = (typeof BRIEFING_SECTIONS)[number];

export interface BriefingNote {
  /** Reference number printed next to the value(s) the note concerns. */
  ref: number;
  level: "warning" | "caution";
  subject: Subject;
  message: string;
  section: BriefingSection;
}

export interface BriefingNotes {
  notes: BriefingNote[];
  /** The notes printed under one section. */
  inSection(section: BriefingSection): BriefingNote[];
  /** Reference numbers of the notes about any of `subjects`. */
  refsOn(...subjects: Subject[]): number[];
  /** Reference numbers of the Cautions on the inputs `value` was computed from. */
  markersOn(value: MarkableValue): number[];
  /** Reference numbers of `notifications`, ascending, for those the Briefing prints. */
  refsFor(notifications: readonly Notification[]): number[];
}

const CONDITION_FIELDS = new Set(["wind", "turb", "cielVis", "mtnObsc"]);
const ENVIRONMENT_FIELDS = new Set(["altitude", "temp", "altimeter"]);

/** Where on the Briefing a note about `subject` is printed. */
export function briefingSection(subject: Subject): BriefingSection {
  switch (subject.kind) {
    case "field":
      if (CONDITION_FIELDS.has(subject.field)) return "conditions";
      if (ENVIRONMENT_FIELDS.has(subject.field)) return "environment";
      if (subject.field === "rwy") return "told";
      return "sortie";
    case "step":
      if (subject.step === "sortie") return "sortie";
      if (subject.step === "weather") return "conditions";
      return "general";
    case "value":
      return valueSubjectGroup(subject) ?? "general";
  }
}

export function briefingNotes(notifications: readonly Notification[]): BriefingNotes {
  const seen = new Set<string>();
  const kept: Omit<BriefingNote, "ref">[] = [];
  for (const n of notifications) {
    if (n.level === "advisory") continue;
    const key = notificationKey(n);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ level: n.level, subject: n.subject, message: n.message, section: briefingSection(n.subject) });
  }
  const order = (s: BriefingSection) => BRIEFING_SECTIONS.indexOf(s);
  // Stable sort: within a section, notes keep the order they were raised in.
  const notes: BriefingNote[] = kept
    .map((n, i) => ({ n, i }))
    .sort((a, b) => order(a.n.section) - order(b.n.section) || a.i - b.i)
    .map(({ n }, i) => ({ ...n, ref: i + 1 }));

  const refByKey = new Map<string, number>();
  for (const note of notes) refByKey.set(notificationKey(note), note.ref);

  const refsFor = (ns: readonly Notification[]) =>
    [...new Set(ns.map((n) => refByKey.get(notificationKey(n))))]
      .filter((r): r is number => r !== undefined)
      .sort((a, b) => a - b);

  return {
    notes,
    inSection: (section) => notes.filter((n) => n.section === section),
    refsOn: (...subjects) => {
      const keys = new Set(subjects.map(subjectKey));
      return notes.filter((n) => keys.has(subjectKey(n.subject))).map((n) => n.ref);
    },
    markersOn: (value) => {
      const refs = inputCautions(notifications, value)
        .map((n) => refByKey.get(notificationKey(n)))
        .filter((r): r is number => r !== undefined);
      return [...new Set(refs)];
    },
    refsFor,
  };
}
