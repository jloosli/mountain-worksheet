const positionFormats: Array<{
  format: string;
  example: string;
  entry: string;
  decimal: string;
}> = [
  { format: "DD.dd (with letters)", example: "36°00'36\"N / 75°30'00\"W", entry: "36.01N/75.50W", decimal: "36.01/-75.50" },
  { format: "DD.dd (with a minus)", example: "36°00'36\"N / 75°30'00\"W", entry: "36.01/-75.50", decimal: "36.01/-75.50" },
  { format: "DD°MM'SS\" (with letters)", example: "36°00'51\"N / 75°30'04\"W", entry: "360051N/0753004W", decimal: "36.01/-75.50" },
  { format: "DD°MM'SS\" (with a minus)", example: "36°00'51\"N / 75°30'04\"W", entry: "360051/-0753004", decimal: "36.01/-75.50" },
  { format: "DD°MM.mm (with letters)", example: "36°00.86'N / 75°30.07'W", entry: "3600.86N/07530.07W", decimal: "36.01/-75.50" },
  { format: "DD°MM.mm (with a minus)", example: "36°00.86'N / 75°30.07'W", entry: "3600.86/-07530.07", decimal: "36.01/-75.50" },
  { format: "Airport ID / Radial / Distance", example: "41°25'48\"N / 112°42'00\"W", entry: "KOGD/285/34", decimal: "41.43/-112.70" },
  { format: "VOR ID / Radial / Distance", example: "41°30'00\"N / 112°45'36\"W", entry: "OGD/285/34", decimal: "41.50/-112.76" },
];

const usingTheToolNotes: string[] = [
  "All times are entered in UTC. The local-time conversion shows below the time selector.",
  "Sortie date and time drive the weather lookup — departure and arrival METAR/TAF are matched to your sortie time, not the current time.",
  "Use Copy Link to save or share the worksheet — the URL captures the worksheet inputs and fetched weather/performance values. UI preferences such as the °C/°F unit are stored locally in your browser and are not shared via the link.",
  "Reset Worksheet clears the worksheet inputs from the URL and reloads with defaults — the date and time reset to the next top-of-hour in UTC, and the °C/°F preference is preserved. Copy the link first if you want to keep the current state.",
  "Toggle °C/°F at any time using the temperature unit button in the header. The setting is saved locally in your browser so it persists across sessions on the same device.",
  "Operating Altitude drives the in-flight density-altitude and maneuvering-speed calculations. Set it to the planned altitude you'll be operating at over the area.",
  "Review the Mountain Flying Checklist (Checklist button in the action bar) before flight in addition to the worksheet values.",
];

type OperationalNote = string | { emphasis: string; body: string };

const operationalNotes: OperationalNote[] = [
  {
    emphasis: "This tool is for reference purposes only.",
    body: " It is up to the PIC and FRO to responsibly evaluate risks prior to release or departure. If risks cannot be reduced to an acceptable level, a no-go decision should be considered.",
  },
  "Warnings are highlighted in red/yellow, but the worksheet does not cover all the risks involved.",
  "Complete and upload this document to 'Sortie Files' for a mountain flight.",
  "If computations reveal that a particular performance item is marginal, consult the POH prior to flight.",
  "C206: 16,000' altitude limit is based on aircraft operations below critical altitude. See POH for operations above this altitude.",
  "Some performance values may vary slightly from the POH for temperatures, altitudes, and weights.",
  "Rate of Climb (ROC) for actual weights is an estimate only. ROC at Max Gross Weights (MGW) are from the POH. Therefore, actual ROC and MGW ROC values may not match. If actual weight results are unexpected, use MGW or POH values. Remember, POH values are for a new aircraft with a test pilot. Your actual climb rates can, and probably will be, lower. ROC rates that are significantly lower than POH values may justify a Return to Base decision.",
  "Performance is computed from POH tables but may not be accurate outside the table range.",
  "A current CAPF 70-5 Mountain Flight Endorsement or qualified instructor is required to takeoff/land in airports located in mountainous terrain.",
  "A current Mountain Flying Certification SQTR and CAPF 70-91, Section V signoff, or qualified instructor is required to fly mountain search.",
  "Density altitude calculation uses a dry air approximation.",
];

export default function InstructionsPanel() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <p>
        Add sortie information in Step 1. Once that area is filled in, click the{" "}
        <span className="font-semibold">Fetch weather</span> button and the
        worksheet will fetch weather information from{" "}
        <a
          href="https://aviationweather.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          AviationWeather.gov
        </a>{" "}
        to fill out the weather and performance sections of the worksheet.
      </p>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Special Inputs
        </h3>
        <p>
          <span className="font-semibold">Departure / Arrival airports:</span>{" "}
          Enter the 4-letter ICAO code (e.g. KDEN) and the worksheet will
          populate the weather and runway information when clicking{" "}
          <span className="font-semibold">Fetch weather</span>.
        </p>
        <p>
          <span className="font-semibold">Area of Operations:</span> Enter
          latitude/longitude coordinates in decimal degrees DD.dddd format. You
          can also use other ways to indicate the area of operations — see the
          table below.
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse mt-2">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-semibold">Format</th>
                <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-semibold">How It Is Entered</th>
                <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-semibold">Equivalent Lat/Long</th>
                <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-semibold">Converted Decimal Format</th>
              </tr>
            </thead>
            <tbody>
              {positionFormats.map((row) => (
                <tr key={row.entry}>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1">{row.format}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-mono whitespace-nowrap">{row.entry}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1 whitespace-nowrap">{row.example}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1 font-mono whitespace-nowrap">{row.decimal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Using the Tool
        </h3>
        <ul className="list-disc list-outside ml-5 space-y-1">
          {usingTheToolNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Notes
        </h3>
        <ul className="list-disc list-outside ml-5 space-y-1">
          {operationalNotes.map((note) => {
            if (typeof note === "string") {
              return <li key={note}>{note}</li>;
            }
            return (
              <li key={note.emphasis}>
                <span className="font-semibold">{note.emphasis}</span>
                {note.body}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
