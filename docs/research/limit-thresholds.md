# Numeric thresholds for the worksheet's qualitative limits

Research for [#247](https://github.com/jloosli/mountain-worksheet/issues/247) (map: #245). Researched 2026-11-09.

The CAP Mountain Flight Worksheet (`docs/reference/mountain-flight-worksheet-v2.pdf`, same text as the NHQ copy
[Mountain_Flight_Worksheet_FINAL](https://www.gocivilairpatrol.com/media/cms/Mountain_Flight_Worksheet_FINAL_b305c86ccb003.pdf))
states two weather limits only in words:

1. "Verify ceilings and visibility are much greater than marginal VFR all along route"
2. "Verify wind speed in mountains is less than 30 knots in any direction". On the form this sits directly under a
   wind row with columns **Surface / 3000' / 6000' / 9000' / 12000'** (the winds-aloft forecast levels).

The app's checklist (`src/components/ChecklistPanel.tsx`) adds "(2000'/10 SM or better is ideal)" to the first item.

## TL;DR: recommended thresholds

| Limit | Hard limit (fail) | Advisory ("ideal" / caution) | Basis |
|---|---|---|---|
| Ceiling | Must be **VFR category: ceiling > 3,000 ft AGL** at every reporting point on the route (MVFR or worse = fail) | Ceiling **≥ 2,000 ft above the highest ridge/pass** on the route | AIM 7-1-7 (MVFR definition); CAP TXWG kneeboard ("Marginal VFR = no-go"); FAA Tips on Mountain Flying; FAA GA JSC "Mountain Flying" sheet |
| Visibility | **VFR category: visibility > 5 SM** (MVFR or worse = fail). Regulatory floor for any CAP VFR flight: **3 SM** | **≥ 10 SM** (FAA GA JSC sheet); some experienced pilots recommend 15 SM (FAA Tips) | AIM 7-1-7; CAPR 70-1 §9.11.7.2; FAA safety material |
| Wind | **Any entered wind ≥ 30 kt** (surface sustained or gust, or forecast winds aloft at any listed level) = fail | **≥ 20 kt at ridge/peak level** = caution (cross ridges ≥ 2,000 ft above); FAA safety material would make **> 25 kt at mountain-top level** a no-go | Worksheet; CAP Mountain Flying Techniques; CAP Mountain Fury; CAP MFQC Module 3; CAPR 70-1 §9.11.7.5.1.1; AIM 7-6-7; FAA Tips |

**No authoritative number exists for "much greater than marginal VFR".** No CAP or FAA source found quantifies
"much greater". Treating "not MVFR" (that is, VFR category) as the hard floor is the most defensible reading.
The "2,000 ft / 10 SM" figure the app shows as "ideal" does have an FAA-published source, but there the 2,000 ft is
measured **above the ridges and passes**, not AGL at the reporting station (see below). The app's current wording
blurs that.

## 1. Marginal VFR: the official definition

**AIM 7-1-7, "Categorical Ceiling and Visibility Conditions"**
([FAA AIM ch. 7 §1](https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap7_section_1.html)), verbatim:

> - LIFR (Low IFR). Ceiling less than 500 feet and/or visibility less than 1 mile.
> - IFR. Ceiling 500 to less than 1,000 feet and/or visibility 1 to less than 3 miles.
> - MVFR (Marginal VFR). Ceiling 1,000 to 3,000 feet and/or visibility 3 to 5 miles inclusive.
> - VFR. Ceiling greater than 3,000 feet and visibility greater than 5 miles; includes sky clear.
>
> The cause of LIFR, IFR, or MVFR is indicated by either ceiling or visibility restrictions or both. […] If winds or
> gusts of 25 knots or greater are forecast for the outlook period, the word "WIND" is also included for all
> categories including VFR.

Implications for a check:

- The category comes from whichever is worse: VFR requires **both** ceiling > 3,000 ft **and** visibility > 5 SM.
  Exactly 3,000 ft or exactly 5 SM is still MVFR ("inclusive").
- Ceiling is the lowest broken/overcast layer (or vertical visibility) and is reported **AGL at the station**.
  In the mountains, stations sit in valleys, so a VFR ceiling at a valley airport can still put cloud on the ridges.
  CAP's Mountain Flying Qualification Course module 3 makes the same point
  ([mod 3, Mountain Weather](https://kerrville.cap.gov/media/cms/mod_3_mountain_flying_weather_A0698CCA95B28.pdf)).
  FAA's *Tips on Mountain Flying* says "Reported ceilings at a mountain valley airport may have to be 8,000 feet or
  higher to give 2,000 feet ceilings at the passes."
- The NWS glossary gives the same MVFR range
  ([forecast.weather.gov glossary: MVFR](https://forecast.weather.gov/glossary.php?word=MVFR)). The Aviation Weather
  Center's flight-category table matches as well (see the
  [archived AWC page](https://webarchive.library.unt.edu/eot2008/20090114022036/http://aviationweather.gov/static/info/afc.html)).

## 2. CAP regulation: CAPR 70-1, *CAP Flight Management*

Source: the current NHQ copy, [CAPR 70-1 (31 Mar 2020) with ICL 20-08, 24-01 and 25-03 incorporated](https://www.gocivilairpatrol.com/media/cms/R_701_with_ICL_2008_Incorporated_1AE7DBFB50E71.pdf),
linked from the [NHQ regulations index](https://www.gocivilairpatrol.com/members/publications/indexes-regulations-and-manuals-1700).

- **§9.11.7.2:** "Minimum flight visibility of three statute miles is required for all VFR flights unless the pilot
  in command (PIC) is a qualified and current […] instrument pilot or authorized by CAP/DO after risk mitigation."
- **No CAP VFR ceiling minimum.** The current CAPR 70-1 has no general VFR ceiling minimum. Its only ceiling numbers
  are IFR release tiers: 800 ft / 2 SM for SFRO release, 500 ft / 1 SM for Wing CC/CV/DO approval (§9.11.3.4.8,
  §9.11.7.4.1). CAP MFQC module 3 says "CAP minimum ceiling for VFR flight is 1,000 feet AGL", but that text does
  **not** appear in the current CAPR 70-1. It probably comes from an older regulation, so don't cite it as current.
- **§9.11.7.5.1.1 (wind):** "Aircraft operations with surface winds greater than 30 knots in any direction (including
  gusts) are not allowed unless approved first by an SFRO and then by the Wing Commander, Vice Commander, or Director
  of Operations (or higher command level)."
  - This is the probable origin of the worksheet's "30 knots **in any direction**" wording. In CAPR 70-1, "in any
    direction" means *regardless of wind direction* (headwind, crosswind or tailwind), not "at any altitude".
  - It covers **surface** winds, **including gusts**, for **all** CAP airplane operations, not just mountain flying.
  - Its boundary is **> 30 kt** (30 kt itself is allowed). The worksheet's "< 30 kt" fails at exactly 30 kt.
- **§9.11.7.5.1.3:** no flight when turbulence is forecast or reported severe or extreme in the area of operations.
- The text contains no mountain-specific limits. A search for "mountain" in CAPR 70-1 finds nothing. Mountain limits
  come from CAP training material, region programs and wing supplements.

## 3. CAP mountain-flying training material

| Source | Wind | Ceiling / visibility |
|---|---|---|
| CAP NHQ, [*Mountain Flying Techniques*](https://www.gocivilairpatrol.com/media/cms/Mountain_Flying_Techniques_FINAL_d19013e7fd0e6.pdf) (companion to the worksheet) | "If flying above the ridgeline, fly over 1000' for every 10 knots of wind speed (2000' for 20 knots)". "**Do not fly in mountains if winds are 30 knots or greater**" | — |
| CAP *Mountain Search Pilot Course Guide* ("Mountain Fury"; CAP authors with S. Imeson, ©1998; [hosted by FAASafety](https://www.faasafety.gov/files/events/WP/WP11/2022/WP11111697/Mountain_Fury.pdf)). RMR says its current course is based on this ([RMR Mountain Training](https://rmr.cap.gov/missions/mission-support/operations/mountain-training)) | "**Winds aloft greater than 30 knots at operating altitude** usually denotes that the flight should be delayed or postponed." "If wind is > 30 knots **at peaks**, don't go unless absolutely necessary." Mountain wave (avoid): "Forecast winds aloft at alt of peaks > 30 kts" and direction within ±30° of perpendicular. Ridge-crossing winds above 20 kt: avoid. "For each 10 knots wind speed, fly 1000 feet above terrain" | "Stay out of marginal weather areas." No number given |
| CAP Mountain Flying Qualification Course, [Module 3, *Mountain Weather*](https://kerrville.cap.gov/media/cms/mod_3_mountain_flying_weather_A0698CCA95B28.pdf) (hosted on a squadron site) | "Ridgeline winds in excess of **20 knots** indicate that the pilot should proceed with caution." "Winds aloft **at the mountain peak level** that are **thirty knots or greater** produce severe turbulence and are a good indicator that a flight should be postponed." | "CAP minimum ceiling for VFR flight is 1,000 feet AGL. A higher ceiling may be appropriate" (not in the current CAPR 70-1, see §2). "CAP minimum for VFR flight is three miles. Greater visibility appropriate in unfamiliar terrain." |
| TXWG, [*CAP Mountain Endorsement Kneeboard*](https://txwg.cap.gov/media/cms/CAP_Mountain_Endorsement_Kneeboard_4A8B6BE90FB26.pdf) (wing-level aid) | "No-go if: **Winds ≥30 kt**" | "No-go if: … **Marginal VFR** [in mountains]" |
| CAP NHQ, [*Mountain Flying Training Syllabus*](https://www.gocivilairpatrol.com/media/cms/Mountain_Flying_Training_Syllabus_FINAL_fcf52814ef0ae.pdf) | "Discuss weather for the sortie, especially winds and visibility". No number given; points to the Absorb course | — |

The Rocky Mountain Region and NHQ mountain courses (Mountain Flying Training / Certification) are in Absorb, which
is members-only, so I could not read them. A CAP News item says regions and wings have been free to build their own
mountain programs, with "little standardization"
([CAP News](https://www.cap.news/meeting-focuses-on-possible-changes-in-mountain-flying-practices/)). A wing
supplement could add stricter numbers that are not captured here.

## 4. FAA guidance

| Source | Wind | Ceiling / visibility |
|---|---|---|
| **AIM 7-6-7, "Mountain Flying"** ([AIM ch. 7 §6](https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap7_section_6.html)) | "Don't fly a light aircraft when the winds aloft, **at your proposed altitude**, exceed **35 miles per hour**." 35 mph ≈ **30.4 kt**, so this is very likely the origin of the 30 kt rule of thumb. "Expect the winds to be of much greater velocity over mountain passes than reported a few miles from them." | No number given |
| **FAA-P-8740-60, *Tips on Mountain Flying*** (AFS-803, 1999; [PDF via FAASafety](https://www.faasafety.gov/files/events/NM/NM03/2018/NM0381357/tips_on_mountain_flying_FAA_safety_pamphlet.pdf)) | "Mountain flying should not be attempted if the **winds aloft forecast at mountain top levels are greater than 25 knots**." "In the west, that usually means the **9,000 and 12,000 foot** forecasts. In the east, you will look at lower winds." Mountain wave above ~25 kt perpendicular to ridges. Above ~20 kt, expect turbulence in passes. Cross ridges at +1,000 ft, or **+2,000 ft if mountain-top winds > 20 kt** | "You should make sure that you have at least a **2,000 foot ceiling over the highest pass** you will cross." Visibility: "Many experienced mountain pilots recommend having at least **15 miles**" |
| **GA Joint Steering Committee / FAA Safety Briefing, *Mountain Flying*** fact sheet (AFS-850 17_04; [faa.gov PDF](https://www.faa.gov/sites/faa.gov/files/2022-01/Mountain%20Flying.pdf)), relaying the Colorado Pilots Association's minimums for **inexperienced** pilots | "Maximum winds aloft at **9,000 and 12,000 feet** less than **25 knots**." | "Ceiling at least **2,000 feet above all ridges and passes** along the route … should be increased as the wind speed increases." "Visibility of at least **10 miles**." This is the source of the app's "2000'/10 SM" |
| FAA Safety Briefing, May/June 2012, [*The Zen of Mountain Flying*](https://www.faa.gov/sites/faa.gov/files/2022-11/The%20Zen%20of%20Mountain%20Flying.pdf) | Repeats the 25 kt mountain-top-level rule and the 9,000 / 12,000 ft forecasts | — |
| AC 61-134, *GA CFIT Awareness* ([PDF](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC61-134.pdf)) | Reprints the older AIM mountain-flying text. No new wind number | "Fly a minimum of 2,000 feet [above terrain] in mountainous areas" (en-route altitude, not a ceiling) |

The FAA *Pilot's Handbook of Aeronautical Knowledge* and *Airplane Flying Handbook* discuss mountain wave and
turbulence qualitatively. Neither publishes a go/no-go wind or ceiling number for mountain flying. AC 91-79 covers
runway overruns and has no mountain weather limits.

## 5. Where sources disagree or are silent

1. **25 vs 30 kt.** FAA safety-program material (FAA-P-8740-60, GA JSC sheet, FAA Safety Briefing) says **25 kt** at
   mountain-top level. CAP material (worksheet, Techniques, Mountain Fury, MFQC module 3, TXWG kneeboard), AIM 7-6-7
   (35 mph ≈ 30 kt) and CAPR 70-1 (surface) all say **30 kt**. The worksheet is a CAP form, so 30 kt is the hard
   limit. 25 kt is a reasonable advisory value. *None of these numbers is regulatory except CAPR 70-1's surface-wind
   rule, which can be waived through the approval chain.*
2. **The boundary at exactly 30 kt.** Under the worksheet ("less than 30"), CAP Techniques ("30 knots or greater"),
   MFQC module 3 ("thirty knots or greater") and the TXWG kneeboard ("≥30 kt"), 30 kt is a **fail**. Under CAPR 70-1
   ("greater than 30") and AIM / Mountain Fury ("exceed" / "greater than"), 30 kt is **allowed**. Recommendation:
   fail at **≥ 30 kt**, to match the form being implemented.
3. **Which altitude.** The sources disagree:
   - CAPR 70-1 applies to the **surface**.
   - CAP training material says **peak/ridge level** or **operating altitude**.
   - AIM says **proposed altitude**.
   - FAA Tips / JSC say **mountain-top level**, which in the West means the **9,000 and 12,000 ft** forecasts.

   The worksheet lists Surface, 3,000, 6,000, 9,000 and 12,000 ft under the check, and its "in any direction" phrase
   comes from CAPR 70-1's direction-agnostic surface rule. The simplest check that honours both is to **fail if any
   entered level is ≥ 30 kt**. A more targeted alternative is surface plus the levels at or above the route's ridge
   elevation, but that needs terrain data and no source requires it.
4. **Sustained vs gusts.** Only CAPR 70-1 says explicitly that **gusts are included**, and only for **surface** wind.
   Winds-aloft (FB) forecasts have no gust value, so gusts can only apply to the surface row. Recommendation: test
   surface wind as max(sustained, gust) ≥ 30 kt. AIM 7-1-7 also flags any forecast with "winds or gusts of 25 knots or
   greater" with "WIND".
5. **Caution band.** CAP MFQC module 3 ("ridgeline winds in excess of 20 knots … proceed with caution") and FAA Tips
   (> 20 kt at mountain-top level: cross ridges at +2,000 ft; pass turbulence) agree on **20 kt** as a caution level.
   CAP Techniques and Mountain Fury give a related clearance rule of **1,000 ft above the ridge per 10 kt of wind**.
6. **"Much greater than marginal VFR".** No source quantifies "much greater". Sources that give numbers:
   - **"Not MVFR."** AIM definition, TXWG kneeboard. Ceiling > 3,000 ft AGL **and** visibility > 5 SM.
   - **2,000 ft above ridges/passes and 10 SM.** FAA GA JSC / Colorado Pilots Association, for inexperienced pilots.
   - **2,000 ft over the highest pass and 15 SM.** FAA Tips.
   - **3 SM.** CAPR 70-1 regulatory floor for any CAP VFR flight.

   The app's "2000'/10 SM ideal" is sourced, but the 2,000 ft is **above the highest ridge/pass**, not a station's
   AGL ceiling. Checked against a METAR ceiling (AGL, valley station), 2,000 ft would actually be **below** the
   3,000 ft MVFR/VFR boundary, which contradicts "much greater than marginal VFR". A check that uses the 2,000 ft
   figure must convert it: ceiling MSL = station elevation + reported ceiling AGL, which must be ≥ highest
   ridge/pass elevation + 2,000 ft.
7. **CAP VFR ceiling minimum.** CAP MFQC module 3 cites a CAP VFR ceiling minimum of 1,000 ft AGL that the current
   CAPR 70-1 (with ICLs through 25-03) does not contain. Treat it as outdated.

## 6. Suggested wording for the limit checks

- **Ceiling/visibility (fail):** "Ceiling or visibility is MVFR or worse (ceiling ≤ 3,000 ft AGL or visibility
  ≤ 5 SM) at <station>. The worksheet requires much better than marginal VFR all along the route." Cite AIM 7-1-7.
- **Ceiling/visibility (advisory, needs terrain data):** "Ideal: ceiling ≥ 2,000 ft above the highest ridge or pass
  and visibility ≥ 10 SM." Cite the FAA GA JSC *Mountain Flying* sheet and FAA-P-8740-60.
- **Wind (fail):** "Wind ≥ 30 kt at <level> (surface includes gusts). The worksheet limit is less than 30 kt in any
  direction." Cite the worksheet, CAP *Mountain Flying Techniques*, CAPR 70-1 §9.11.7.5.1.1 (surface, gusts; > 30 kt
  needs SFRO + Wing CC/CV/DO approval) and AIM 7-6-7.
- **Wind (caution):** "Wind ≥ 20 kt at ridge level: expect turbulence and downdrafts; cross ridges at least 2,000 ft
  above." Cite CAP MFQC module 3, FAA-P-8740-60 and CAP *Techniques* (1,000 ft per 10 kt). Optionally add "FAA
  safety guidance recommends against mountain flight above 25 kt at mountain-top level (9,000 / 12,000 ft in the
  West)."
