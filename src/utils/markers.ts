/**
 * Markers on computed values that rest on a Substitution (GLOSSARY.md,
 * ADR 0001): a computed value whose inputs carry a Caution shows a compact
 * marker pointing back to that Caution instead of repeating its message.
 */
import { subjectKey, type Notification, type Subject } from "./notifications";
import type { ComputedValue, ServiceCeiling } from "./derived";

/** A value that may record the input Subjects it was computed from. */
export type MarkableValue =
  | ComputedValue
  | ServiceCeiling
  | { status: "computed"; dependsOn: Subject[] };

/** The Cautions on the inputs `value` was computed from, in notification order. */
export function inputCautions(
  notifications: readonly Notification[],
  value: MarkableValue
): Notification[] {
  if (!("dependsOn" in value) || value.dependsOn.length === 0) return [];
  const inputs = new Set(value.dependsOn.map(subjectKey));
  return notifications.filter(
    (n) => n.level === "caution" && inputs.has(subjectKey(n.subject))
  );
}
