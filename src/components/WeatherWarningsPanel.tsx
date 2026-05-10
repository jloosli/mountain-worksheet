import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface WeatherWarningsPanelProps {
  warnings?: string[];
}

export default function WeatherWarningsPanel({
  warnings,
}: WeatherWarningsPanelProps) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div
      role="alert"
      className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg"
    >
      <div className="flex items-start gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Weather Data Warnings
          </h4>
          <ul className="mt-1 text-xs text-amber-800 dark:text-amber-200 list-disc list-inside space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
