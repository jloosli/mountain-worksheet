import { notificationsDomId } from "@/components/InlineNotifications";
import { inputCautions, type MarkableValue } from "@/utils/markers";
import { subjectKey, type Notification } from "@/utils/notifications";

interface ValueMarkersProps {
  /** All notifications in force. */
  notifications: readonly Notification[];
  value: MarkableValue;
}

/**
 * A compact marker per input Caution a computed value rests on. Each links to
 * the Caution shown at the input and carries its message as a tooltip; the
 * message itself is not repeated here.
 */
export default function ValueMarkers({ notifications, value }: ValueMarkersProps) {
  const bySubject = new Map<string, Notification[]>();
  for (const n of inputCautions(notifications, value)) {
    const key = subjectKey(n.subject);
    bySubject.set(key, [...(bySubject.get(key) ?? []), n]);
  }
  if (bySubject.size === 0) return null;
  return (
    <>
      {[...bySubject.values()].map((cautions) => {
        const text = cautions.map((c) => c.message).join("\n");
        return (
          <a
            key={subjectKey(cautions[0].subject)}
            href={`#${notificationsDomId(cautions[0].subject)}`}
            title={`Caution on an input: ${text}`}
            aria-label={`Computed from an input with a Caution: ${text}`}
            data-marker="caution"
            className="ml-1 align-super text-[0.65em] font-semibold text-amber-700 no-underline hover:underline dark:text-amber-400"
          >
            △
          </a>
        );
      })}
    </>
  );
}
