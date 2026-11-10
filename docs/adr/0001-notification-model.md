# Notification model: FAA alert levels, derived from state, inline, never blocking

Pilots were not being told when the worksheet used substitute data or failed to get it (#216): weather warnings were collected but never rendered, several failures were only logged to the console, and the few visible messages were split across blocking modals, a weather panel, and a separate TOLD error display, each with its own idea of severity. We adopted one notification model for the whole worksheet, using the terms defined in `GLOSSARY.md`:

- **Three levels named and colored after FAA cockpit alerting** (AC 25.1322): Warning (red; a result can't be trusted or wasn't produced), Caution (amber; a result was produced from substitute, stale, or extrapolated data), Advisory (neutral; worth knowing, no action needed). We borrow the FAA level names, colors, and order of urgency because pilots already recognize them, but the definitions here are the worksheet's own: they classify the trustworthiness of worksheet data, not crew response time as AC 25.1322 does. In particular, an FAA Advisory may still call for a later crew response, while a worksheet Advisory needs none.
- **No silent substitution.** Any displayed value that doesn't come from the pilot's input or from data for the requested airport, time, and position raises a Caution, and values computed from it carry a marker pointing back to it, both on screen and on the printed Briefing.
- **Derived from current state, never dismissable.** A notification exists exactly while its cause does, and disappears when the cause is fixed. This follows the project's derived-state rule for displayed values. We rejected dismissal because a dismissed Warning that still applies is worse than a persistent one.
- **Shown inline next to its Subject, summarized on the step header.** There are no blocking modals for data problems: the pilot fixes a problem in the field where it appears, and modals hid context.
- **Warnings mark a step but never block the worksheet.** Destinations are often non-reporting or private fields, so a missing value must not hold up fetching, the other steps, unaffected results, or printing. Only values that depend on a Warned input are withheld. There is no Go/No-Go verdict: the worksheet reports Limit checks and the pilot and Flight Release Officer make the Go/No-Go decision ([ADR 0002](0002-limit-checks-separate-from-notifications.md)).

## Classification

| What happened | Level |
|---|---|
| Couldn't fetch or compute something; input invalid, outside an entry range, or beyond an aircraft limitation (such as maximum gross weight) | Warning |
| Fetched weather no longer matches the inputs it was fetched for (an airport, date, time or duration changed); raised on each fetched field still holding the fetched value, kept alongside that field's Caution, and cleared by a refetch or the pilot's own value. The data is not blanked | Warning |
| A Substitution: stale or nearest forecast, snapped time or altitude, midpoint position, averaged table gaps, extrapolation beyond tables, an auto-flag computed with a weaker threshold, an Unknown airport | Caution |
| An announced auto-correction; a Non-reporting airport | Advisory |

Generic advice that would fire on any mountain sortie ("high altitude operations require careful planning") is not a notification and is removed. A blank field the pilot is expected to fill shows a needs-input prompt, not a notification.

A value that fails or nears one of the worksheet's own mountain-flying limits is not a notification; it is a Limit check ([ADR 0002](0002-limit-checks-separate-from-notifications.md)).
