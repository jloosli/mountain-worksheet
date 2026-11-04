# CAP Mountain Flying Worksheet

Helps Civil Air Patrol pilots plan a mountain flying sortie: gathers weather and aircraft data, computes performance, and supports a go/no-go decision.

## Language

### Notifications

**Notification**:
Anything the worksheet tells the pilot about a problem or caveat with their inputs, fetched data, or computed results. It is always about one Subject and exists only while its cause does; the pilot cannot dismiss it.
_Avoid_: Message, alert, error (as the umbrella term)

**Subject**:
The thing a notification is about: an input field, a computed value, or a whole worksheet step. A notification is shown next to its Subject and counted on that Subject's step.

**Warning**:
A notification that needs the pilot's immediate attention because a result can't be trusted or wasn't produced. Shown in red. It marks its step but never blocks the rest of the worksheet.
_Avoid_: Error

**Caution**:
A notification that a result was produced from substitute, stale, or extrapolated data and should be reviewed. Shown in amber.
_Avoid_: Warning (for this meaning)

**Advisory**:
A notification that is worth knowing but needs no action, such as an announced auto-correction or a value close to a limit. Shown in a neutral color.
_Avoid_: Info, notice

**Needs input**:
The state of a blank field the pilot is expected to fill in. It is a prompt, not a notification, and values that depend on it show what they are waiting for.

**Withheld value**:
A computed value that is not shown because one of its own inputs has a Warning or needs input. Values that don't depend on that input are still computed.

### Data provenance

**Substitution**:
Any displayed value that comes from something other than the pilot's own input or data for the requested airport, time, and position. Every substitution is announced with a Caution; there are no silent substitutions. Values computed from a substitution carry a marker pointing back to it.
_Avoid_: Fallback (as a user-facing term)

**Auto-correction**:
The worksheet changing what the pilot entered, either silently (normalization that cannot change meaning) or with an Advisory (one correction confirmed by data). An ambiguous or unconfirmed correction is never applied.

**Partial fetch**:
A weather fetch where some parts succeed and others fail. The successful parts are applied. A field that unexpectedly could not be filled is left blank with a Warning, which clears once the pilot enters a value.

**Unverified weather**:
Weather values on the worksheet that were not fetched during the current session, such as values opened from a shared link. They raise a Caution on the weather step until weather is fetched.

### Airports

**Unknown airport**:
An airport ID that matches nothing in the airport database, even after auto-correction. It may be a typo or a private strip, so it raises a Caution and the pilot enters its data manually.

**Non-reporting airport**:
An airport that exists in the airport database but publishes no METAR or TAF. It raises an Advisory, and its weather fields need input.
_Avoid_: Missing airport, airport not found

### Outputs

**Briefing**:
The printed record of the worksheet that the pilot takes on the sortie. It carries every Warning and Caution next to the value it concerns; Advisories are left off.
_Avoid_: Printout, report

**Go/No-Go verdict**:
The worksheet's conclusion about whether the sortie should proceed. It is a separate concept from notifications; whether it takes them into account is not yet decided.
