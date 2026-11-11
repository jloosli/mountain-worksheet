# CAP Mountain Flying Worksheet

Helps Civil Air Patrol pilots plan a mountain flying sortie: gathers weather and aircraft data, computes performance, and checks the worksheet's limits to inform the Go/No-Go decision.

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
A notification that is worth knowing but needs no action, such as an announced auto-correction. Shown in a neutral color. A value close to a worksheet limit is shown by a Limit check that is Near limit, not by an Advisory.
_Avoid_: Info, notice

**Needs input**:
The state of a blank field the pilot is expected to fill in. It is a prompt, not a notification, and values that depend on it show what they are waiting for.

**Withheld value**:
A computed value that is not shown because one of its own inputs has a Warning or needs input. Values that don't depend on that input are still computed.

### Data provenance

**Substitution**:
Any displayed value that comes from something other than the pilot's own input or data for the requested airport, time, and position. Every substitution is announced with a Caution; there are no silent substitutions. Values and Limit checks computed from a substitution carry a marker pointing back to it, and a Limit check's state counts the same as one from the pilot's own data.
_Avoid_: Fallback (as a user-facing term)

**Auto-correction**:
The worksheet changing what the pilot entered, either silently (normalization that cannot change meaning) or with an Advisory (one correction confirmed by data). An ambiguous or unconfirmed correction is never applied.

**Partial fetch**:
A weather fetch where some parts succeed and others fail. The successful parts are applied. A field that unexpectedly could not be filled is left blank with a Warning, which clears once the pilot enters a value.

**Unverified weather**:
Weather values on the worksheet that were not fetched during the current session, such as values opened from a shared link. They raise a Caution on the weather step until weather is fetched. The Caution covers every weather field, so values and Limit checks computed from weather carry its marker.

### Airports

**Unknown airport**:
An airport ID that matches nothing in the airport database, even after auto-correction. It may be a typo or a private strip, so it raises a Caution and the pilot enters its data manually.

**Non-reporting airport**:
An airport that exists in the airport database but publishes no METAR or TAF. It raises an Advisory. Its weather is filled by Substitution: altimeter from a Substitute station, temperature from a model forecast at the field's own position and elevation.
_Avoid_: Missing airport, airport not found

**Substitute station**:
The nearest reporting airport whose weather is used for a Non-reporting airport. Every value taken from it is a Substitution, and its Caution names the station.
_Avoid_: Proxy station, reference station, nearest station

### Limit checks

**Limit check**:
A comparison of trustworthy values against one of the Mountain Flight Worksheet's own mountain-flying limits, such as mountain winds under 30 kt. There is one per limit, covering every altitude or airport the limit applies to. Its state is the worst among them, in the order Exceeded, Not checked, Near limit, Within limit, and it names the ones that fail. It is not a notification: it never withholds a value and says nothing about whether the data can be trusted. Values outside an entry range or an aircraft limitation, such as weight above maximum gross, are Warnings, not Limit checks.
_Avoid_: Limit warning, violation

**Within limit**:
The state of a Limit check whose values all meet the limit.

**Near limit**:
The state of a Limit check whose values meet the limit but cross a caution threshold that authoritative guidance gives for it. Only limits with such a threshold have this state.
_Avoid_: Marginal (MVFR already uses it)

**Exceeded**:
The state of a Limit check where at least one value fails the limit.
_Avoid_: Failed, no-go

**Not checked**:
The state of a Limit check that has no known failure but can't be fully evaluated, because a value it needs is missing or can't be trusted: blank, withheld, unavailable, or outdated by a changed input. It names what it is waiting for. A value that is trusted but beyond an aircraft limitation, such as weight above maximum gross, can still be checked.

### Outputs

**Briefing**:
The printed record of the worksheet that the pilot takes on the sortie. It opens with a Worksheet limits table, one row per Limit check, and carries every Warning and Caution next to the value it concerns; Advisories are left off.
_Avoid_: Printout, report

**Go/No-Go decision**:
The decision by the pilot in command and the Flight Release Officer on whether the sortie proceeds. The worksheet informs it with Limit checks but never states it.
_Avoid_: Verdict, Go/No-Go result
