# Notification model: FAA alert levels, derived from state, inline, never blocking

Pilots were not being told when the worksheet used substitute data or failed to get it (#216): weather warnings were collected but never rendered, several failures were only logged to the console, and the few visible messages were split across blocking modals, a weather panel, and a separate TOLD error display, each with its own idea of severity. We adopted one notification model for the whole worksheet, using the terms defined in `GLOSSARY.md`:

- **Three levels with FAA cockpit-alerting meanings** (AC 25.1322): Warning (red; a result can't be trusted or wasn't produced), Caution (amber; a result was produced from substitute, stale, or extrapolated data), Advisory (neutral; worth knowing, no action needed). Pilots already know these meanings, so we use them instead of inventing our own.
- **No silent substitution.** Any displayed value that doesn't come from the pilot's input or from data for the requested airport, time, and position raises a Caution, and values computed from it carry a marker pointing back to it, both on screen and on the printed Briefing.
- **Derived from current state, never dismissable.** A notification exists exactly while its cause does, and disappears when the cause is fixed. This follows the project's derived-state rule for displayed values. We rejected dismissal because a dismissed Warning that still applies is worse than a persistent one.
- **Shown inline next to its Subject, summarized on the step header.** There are no blocking modals for data problems: the pilot fixes a problem in the field where it appears, and modals hid context.
- **Warnings mark a step but never block the worksheet.** Destinations are often non-reporting or private fields, so a missing value must not hold up fetching, the other steps, unaffected results, or printing. Only values that depend on a Warned input are withheld. Whether the future Go/No-Go verdict takes notifications into account is left to that design.

## Classification

| What happened | Level |
|---|---|
| Couldn't fetch or compute something; input invalid or beyond a hard limit | Warning |
| A Substitution: stale or nearest forecast, snapped time or altitude, midpoint position, averaged table gaps, extrapolation beyond tables, an auto-flag computed with a weaker threshold, an Unknown airport | Caution |
| An announced auto-correction; a value within limits but close to one; a Non-reporting airport | Advisory |

Generic advice that would fire on any mountain sortie ("high altitude operations require careful planning") is not a notification and is removed. A blank field the pilot is expected to fill shows a needs-input prompt, not a notification.
