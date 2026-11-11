# Notification model: FAA alert levels, derived from state, inline, never blocking

Pilots were not being told when the worksheet used substitute data or failed to get it (#216): weather warnings were collected but never rendered, several failures were only logged to the console, and the few visible messages were split across blocking modals, a weather panel, and a separate TOLD error display, each with its own idea of severity. We adopted one notification model for the whole worksheet, using the terms defined in `GLOSSARY.md`:

- **Three levels named and colored after FAA cockpit alerting** (AC 25.1322): Warning (red; a result can't be trusted or wasn't produced), Caution (amber; a result was produced from substitute, stale, or extrapolated data), Advisory (neutral; worth knowing, no action needed). We borrow the FAA level names, colors, and order of urgency because pilots already recognize them, but the definitions here are the worksheet's own: they classify the trustworthiness of worksheet data, not crew response time as AC 25.1322 does. In particular, an FAA Advisory may still call for a later crew response, while a worksheet Advisory needs none.
- **No silent substitution.** Any displayed value that doesn't come from the pilot's input or from data for the requested airport, time, and position raises a Caution, and values computed from it carry a marker pointing back to it, both on screen and on the printed Briefing. A model point forecast at the requested airport's own position and elevation, for the requested time, counts as data for that airport, time and position: it is not a Substitution, and its source is announced with an Advisory (#301).
- **Derived from current state, never dismissable.** A notification exists exactly while its cause does, and disappears when the cause is fixed. This follows the project's derived-state rule for displayed values. We rejected dismissal because a dismissed Warning that still applies is worse than a persistent one.
- **Shown inline next to its Subject, summarized on the step header.** There are no blocking modals for data problems: the pilot fixes a problem in the field where it appears, and modals hid context.
- **A notification can cover more inputs than its Subject.** It is still shown at its Subject, but it may declare the inputs it is about (`covers`). Unverified weather, for example, sits on the weather step and covers every weather field. A value rests on a Caution when the Caution is on one of the value's inputs or covers one of them (`substitutionsFor` in `src/utils/provenance.ts`, #283). That one rule decides the markers on screen, on the Briefing and on Limit checks. Nothing matches a notification by its message text.
- **Warnings mark a step but never block the worksheet.** Destinations are often non-reporting or private fields, so a missing value must not hold up fetching, the other steps, unaffected results, or printing. Only values that depend on a Warned input are withheld. There is no Go/No-Go verdict: the worksheet reports Limit checks and the pilot and Flight Release Officer make the Go/No-Go decision ([ADR 0002](0002-limit-checks-separate-from-notifications.md)).

## Classification

| What happened | Level |
|---|---|
| Couldn't fetch or compute something; input invalid, outside an entry range, or beyond an aircraft limitation (such as maximum gross weight) | Warning |
| Fetched weather no longer matches the inputs it was fetched for (an airport, date, time or duration changed); raised on each fetched field still holding the fetched value, kept alongside that field's Caution, and cleared by a refetch or the pilot's own value. The data is not blanked | Warning |
| A Substitution: stale or nearest forecast, snapped time or altitude, midpoint position, averaged table gaps, extrapolation beyond tables, an auto-flag computed with a weaker threshold, an Unknown airport. This includes an airport temperature taken from an observation because its model forecast was unavailable, and an altimeter setting persisted from an observation more than 12 hours from the requested time | Caution |
| An announced auto-correction; a Non-reporting airport; an airport temperature from a model point forecast for that airport; an altimeter setting persisted from the airport's own observation within 12 hours of the requested time, when no forecast provides one | Advisory |

Generic advice that would fire on any mountain sortie ("high altitude operations require careful planning") is not a notification and is removed. A blank field the pilot is expected to fill shows a needs-input prompt, not a notification.

A value that fails or nears one of the worksheet's own mountain-flying limits is not a notification; it is a Limit check ([ADR 0002](0002-limit-checks-separate-from-notifications.md)).

## Routine TAF gaps (#301)

US civil TAFs never forecast an altimeter and almost never a temperature, so for any sortie more than 90 minutes away the old rule put a Caution on nearly every airport's temperature and altimeter. Amber that shows up on every sortie teaches pilots to ignore it. Two changes keep Cautions for real Substitutions:

- **Temperature comes from a model point forecast for the field.** It is the model's best estimate for the requested airport, time and position, which a 9-hour-old observation is not (overnight low vs. afternoon takeoff). It replaces the observation and raises an Advisory naming the source. If the forecast is unavailable, the observation is still used, with a Caution.
- **Persisting the airport's own observed altimeter is an Advisory within 12 hours.** That is standard practice, since no forecast will supply one, and a few hours typically moves the setting a few hundredths of an inch. Beyond 12 hours a front could have passed, so it stays a Caution. We kept rejecting a model `pressure_msl` for the altimeter ([ADR 0003](0003-weather-for-non-reporting-airports.md)).
