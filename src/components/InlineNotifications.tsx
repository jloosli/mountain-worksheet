import {
  notificationsFor,
  subjectKey,
  type Notification,
  type NotificationLevel,
  type Subject,
} from "@/utils/notifications";

const LEVEL_LABEL: Record<NotificationLevel, string> = {
  warning: "Warning",
  caution: "Caution",
  advisory: "Advisory",
};

// Red / amber / neutral, after FAA cockpit alerting (ADR 0001).
const LEVEL_STYLE: Record<NotificationLevel, string> = {
  warning:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
  caution:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  advisory:
    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const LEVEL_ORDER: Record<NotificationLevel, number> = {
  warning: 0,
  caution: 1,
  advisory: 2,
};

/** DOM id of the inline list for a Subject; one list per Subject on the page. */
export function notificationsDomId(subject: Subject): string {
  return `notifications-${subjectKey(subject).replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

/**
 * ARIA props for the input a Subject belongs to: `aria-describedby` points at
 * its inline notifications, and `aria-invalid` is set while it has a Warning.
 */
export function notificationA11yProps(
  notifications: readonly Notification[],
  subject: Subject
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  const mine = notificationsFor(notifications, subject);
  if (mine.length === 0) return {};
  return {
    ...(mine.some((n) => n.level === "warning") ? { "aria-invalid": true } : {}),
    "aria-describedby": notificationsDomId(subject),
  };
}

interface InlineNotificationsProps {
  /** All notifications in force; only those about `subject` are shown. */
  notifications: readonly Notification[];
  subject: Subject;
  className?: string;
}

/** The notifications about one Subject, shown next to it, most urgent first. */
export default function InlineNotifications({
  notifications,
  subject,
  className = "",
}: InlineNotificationsProps) {
  const mine = notificationsFor(notifications, subject).sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
  );
  if (mine.length === 0) return null;
  return (
    <ul id={notificationsDomId(subject)} className={`space-y-1 ${className}`}>
      {mine.map((n, i) => (
        <li
          key={i}
          data-level={n.level}
          className={`rounded border px-2 py-1 text-xs ${LEVEL_STYLE[n.level]}`}
        >
          <span className="font-semibold">{LEVEL_LABEL[n.level]}:</span>{" "}
          {n.message}
        </li>
      ))}
    </ul>
  );
}
