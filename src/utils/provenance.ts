/**
 * Substitution provenance (GLOSSARY.md, Substitution; ADR 0001): which
 * Cautions a computed value rests on. Values and Limit checks computed from a
 * Substitution carry a marker pointing back to its Caution. This is the one
 * rule behind the screen's value markers, the Briefing's references and the
 * substitutions on Limit check points, so the three always agree.
 */
import type { ComputedValue, ServiceCeiling } from "./derived";
import { subjectKey, type Notification, type Subject } from "./notifications";

/** A value that may record the input Subjects it was computed from. */
export type MarkableValue =
  | ComputedValue
  | ServiceCeiling
  | { status: "computed"; dependsOn: Subject[] };

/**
 * Whether `cover` takes in `subject`: the same Subject, or a whole field
 * (no index) taking in each of its slots.
 */
function covers(cover: Subject, subject: Subject): boolean {
  if (cover.kind === "field" && cover.index === undefined && subject.kind === "field") {
    return cover.field === subject.field;
  }
  return subjectKey(cover) === subjectKey(subject);
}

/**
 * The Cautions `value` rests on, in notification order: those on the inputs
 * it was computed from, those whose scope (`Notification.covers`) takes in
 * one of those inputs, and those on `own`, the value's own Subjects (an
 * extrapolated or averaged POH value). Withheld and unavailable values rest
 * on nothing.
 *
 * On screen a value's own Cautions are shown beside it, so `own` is for
 * surfaces that show the value away from them, like Limit check points.
 */
export function substitutionsFor(
  value: MarkableValue,
  notifications: readonly Notification[],
  own: readonly Subject[] = [],
): Notification[] {
  if (!("dependsOn" in value)) return [];
  const inputs = value.dependsOn;
  const ownKeys = new Set(own.map(subjectKey));
  const inputKeys = new Set(inputs.map(subjectKey));
  return notifications.filter(
    (n) =>
      n.level === "caution" &&
      (ownKeys.has(subjectKey(n.subject)) ||
        inputKeys.has(subjectKey(n.subject)) ||
        (n.covers ?? []).some((c) => inputs.some((s) => covers(c, s)))),
  );
}
