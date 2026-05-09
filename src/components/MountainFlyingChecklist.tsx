const sections = [
  {
    title: "Basic Preflight",
    items: [
      "Ensure attire, safety, oxygen, and survival equipment are appropriate for the flight",
      "Ensure adequate fuel reserves exist for mountain flight.",
      "File flight plan, if necessary",
      "Conduct a good aircraft preflight",
      "Ensure inoperative equipment and discrepancies are appropriate for mountain flight",
      "Discuss crew responsibilities, Crew Resource Management and mission briefing",
    ],
  },
  {
    title: "Weather Preflight",
    items: [
      "Verify all weather, especially winds and turbulence, remains within release limits 2 hours prior to flight. If not, consult with the Flight Release Officer",
      "Determine where updraft, downdraft and turbulent areas are likely to occur",
      "Verify ceilings and visibility are much greater than marginal VFR all along route (2000'/10 SM or better is ideal). If not, consider aborting mission or consult with the Flight Release Officer",
    ],
  },
  {
    title: "Weight and Balance Preflight",
    items: [
      "Ensure weight and balance within limits for actual loading; weight from ForeFlight or POH",
      "Attempt to maintain weight less than 90% of Maximum Gross Weight for mountain flight",
    ],
  },
  {
    title: "Aircraft Performance Preflight",
    items: [
      "Verify Rate of Climb is greater than 300 feet/minute all along route and in area of operations. If not, consider aborting mission or consult with the Flight Release Officer",
      "Verify Take Off plus Landing Ground Roll is less than Runway length. If not, consider aborting mission or consult with the Flight Release Officer",
    ],
  },
  {
    title: "Departure",
    items: [
      "Define runway abort point (75% of indicated takeoff airspeed at runway midpoint)",
      "Mixture set for max power or POH",
      "Execute short field take off techniques to clear actual or simulated obstacles",
    ],
  },
  {
    title: "Enroute",
    items: [
      "Remain at or above 2000 feet AGL unless descending to land if MFE qualified (Note 13)",
      "Remain at or above 1000 feet AGL unless descending to land or conducting a mission as a Mountain qualified Mission Pilot (Note 14)",
    ],
  },
  {
    title: "Arrival",
    items: [
      "Verify 300 feet/minute Rate of Climb possible. If not, divert.",
      "Verify go around possible at airport. If not, divert.",
      "Set runway go around point to stop safely",
      "Mixture set for max power or POH",
      "Use short field landing techniques",
    ],
  },
];

export default function MountainFlyingChecklist() {
  return (
    <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <details>
        <summary className="text-2xl font-bold p-6 cursor-pointer list-none flex items-center justify-between select-none">
          Mountain Flying Checklist
          <span className="text-gray-400 dark:text-gray-500 text-base font-normal ml-2">
            ▼
          </span>
        </summary>
        <div className="px-6 pb-6 space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
                {section.title}
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
