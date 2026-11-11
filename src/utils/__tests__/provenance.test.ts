import {
  fieldSubject,
  stepSubject,
  valueSubject,
  type Notification,
  type Subject,
} from "../notifications";
import { substitutionsFor, type MarkableValue } from "../provenance";

const caution = (
  subject: Notification["subject"],
  message: string,
  covers?: Notification["covers"],
): Notification =>
  covers ? { level: "caution", subject, message, covers } : { level: "caution", subject, message };

const arrivalTemp = caution(fieldSubject("temp", 2), "KXYZ: using current observation");
const departureTemp = caution(fieldSubject("temp", 0), "KABC: nearest forecast");
const extrapolated = caution(
  valueSubject("climb.rateOfClimb.2", "decision"),
  "Extrapolated beyond the POH table",
);
/** Unverified weather: a Caution on the weather step that covers the weather fields. */
const unverified = caution(stepSubject("weather"), "Weather values came from a shared link", [
  fieldSubject("temp"),
  fieldSubject("altimeter"),
  fieldSubject("wind"),
  fieldSubject("cielVis"),
]);
/** A weather-step Caution that covers no input. */
const stepOnly = caution(stepSubject("weather"), "Something about the weather step");

const computed = (...dependsOn: Subject[]): MarkableValue => ({
  status: "computed",
  value: 1,
  dependsOn,
});

const arrivalLanding = computed(
  fieldSubject("acType"),
  fieldSubject("altimeter", 2),
  fieldSubject("temp", 2),
);
const weightOnly = computed(fieldSubject("acType"), fieldSubject("weight"));
const windColumn = computed(fieldSubject("wind"), fieldSubject("wind", 3));

const all = [departureTemp, arrivalTemp, extrapolated, unverified, stepOnly];

describe("substitutionsFor", () => {
  const rocOwn = [valueSubject("climb.rateOfClimb.2", "decision")];
  it.each<{
    name: string;
    value: MarkableValue;
    notifications: Notification[];
    own?: Subject[];
    markers: Notification[];
  }>([
    {
      name: "a Caution on an input the value was computed from",
      value: arrivalLanding,
      notifications: [arrivalTemp],
      markers: [arrivalTemp],
    },
    {
      name: "nothing for a Caution on another input",
      value: arrivalLanding,
      notifications: [departureTemp],
      markers: [],
    },
    {
      name: "a covering Caution whose whole field takes in an indexed input",
      value: arrivalLanding,
      notifications: [unverified],
      markers: [unverified],
    },
    {
      name: "a covering Caution on a column the value reads",
      value: windColumn,
      notifications: [unverified],
      markers: [unverified],
    },
    {
      name: "nothing for a covering Caution that covers none of its inputs",
      value: weightOnly,
      notifications: [unverified],
      markers: [],
    },
    {
      name: "nothing for a weather-step Caution that declares no scope",
      value: arrivalLanding,
      notifications: [stepOnly],
      markers: [],
    },
    {
      name: "nothing for the value's own Caution unless asked",
      value: arrivalLanding,
      notifications: [extrapolated],
      markers: [],
    },
    {
      name: "the value's own Caution when its Subject is given",
      value: arrivalLanding,
      notifications: [extrapolated],
      own: rocOwn,
      markers: [extrapolated],
    },
    {
      name: "every kind together, in notification order",
      value: arrivalLanding,
      notifications: all,
      own: rocOwn,
      markers: [arrivalTemp, extrapolated, unverified],
    },
    {
      name: "nothing on a withheld value",
      value: { status: "withheld", reason: "needs weight" },
      notifications: all,
      own: rocOwn,
      markers: [],
    },
    {
      name: "nothing on an unavailable value",
      value: { status: "unavailable" },
      notifications: all,
      own: rocOwn,
      markers: [],
    },
  ])("$name", ({ value, notifications, own, markers }) => {
    expect(substitutionsFor(value, notifications, own)).toEqual(markers);
  });

  it("ignores Warnings and Advisories, even on inputs or with a scope", () => {
    const others: Notification[] = [
      { ...arrivalTemp, level: "warning" },
      { ...arrivalTemp, level: "advisory" },
      { ...unverified, level: "warning" },
    ];
    expect(substitutionsFor(arrivalLanding, others)).toEqual([]);
  });

  it("doesn't let an indexed scope take in another slot", () => {
    const departureOnly = caution(stepSubject("weather"), "Departure only", [
      fieldSubject("temp", 0),
    ]);
    expect(substitutionsFor(arrivalLanding, [departureOnly])).toEqual([]);
  });
});
