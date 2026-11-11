import { briefingNotes } from "../briefingNotes";
import { fieldSubject, stepSubject, valueSubject, type Notification } from "../notifications";
import { toldSubject, type ComputedValue } from "../derived";

const arrivalTemp: Notification = {
  level: "caution",
  subject: fieldSubject("temp", 2),
  message: "KXYZ: forecast period has no temperature; using current observation",
};
const weightWarning: Notification = {
  level: "warning",
  subject: fieldSubject("weight"),
  message: "Weight 3,400 lbs is above the maximum gross weight.",
};
const nearLimit: Notification = {
  level: "advisory",
  subject: fieldSubject("weight"),
  message: "Weight is within 5% of maximum gross weight.",
};
const landingExtrapolated: Notification = {
  level: "caution",
  subject: toldSubject("arrival", "landing"),
  message: "Arrival (KXYZ) landing distances are extrapolated beyond the POH table.",
};
const fetchFailed: Notification = {
  level: "warning",
  subject: stepSubject("weather"),
  message: "TAF request for KXYZ failed.",
};

describe("briefingNotes", () => {
  it("leaves Advisories off the Briefing", () => {
    const { notes } = briefingNotes([nearLimit, weightWarning]);
    expect(notes.map((n) => n.message)).toEqual([weightWarning.message]);
  });

  it("numbers Warnings and Cautions in the order the Briefing prints their sections", () => {
    const { notes } = briefingNotes([landingExtrapolated, arrivalTemp, fetchFailed, weightWarning]);
    expect(notes.map((n) => [n.ref, n.section, n.message])).toEqual([
      [1, "sortie", weightWarning.message],
      [2, "conditions", fetchFailed.message],
      [3, "environment", arrivalTemp.message],
      [4, "told", landingExtrapolated.message],
    ]);
  });

  it("prints a notification raised by more than one producer once", () => {
    const { notes } = briefingNotes([arrivalTemp, { ...arrivalTemp }]);
    expect(notes).toHaveLength(1);
  });

  it("puts every Warning and Caution in some section", () => {
    const odd: Notification = {
      level: "warning",
      subject: valueSubject("something.new", "decision"),
      message: "Something new could not be computed.",
    };
    expect(briefingNotes([odd]).notes[0].section).toBe("general");
  });

  it("gives the reference numbers of the notes about a Subject", () => {
    const b = briefingNotes([arrivalTemp, weightWarning, nearLimit]);
    expect(b.refsOn(fieldSubject("weight"))).toEqual([1]);
    expect(b.refsOn(fieldSubject("temp", 2))).toEqual([2]);
    expect(b.refsOn(fieldSubject("temp", 0))).toEqual([]);
  });

  it("marks a computed value with the reference of the Caution on its input", () => {
    const b = briefingNotes([weightWarning, arrivalTemp]);
    const landing: ComputedValue = {
      status: "computed",
      value: 1450,
      dependsOn: [fieldSubject("acType"), fieldSubject("temp", 2)],
    };
    const departure: ComputedValue = {
      status: "computed",
      value: 1200,
      dependsOn: [fieldSubject("acType"), fieldSubject("temp", 0)],
    };
    expect(b.markersOn(landing)).toEqual([2]);
    expect(b.markersOn(departure)).toEqual([]);
  });

  it("marks a computed value with the reference of a Caution that covers its input", () => {
    const unverified: Notification = {
      level: "caution",
      subject: stepSubject("weather"),
      message: "Weather values came from a shared link",
      covers: [fieldSubject("temp")],
    };
    const b = briefingNotes([weightWarning, unverified]);
    const landing: ComputedValue = {
      status: "computed",
      value: 1450,
      dependsOn: [fieldSubject("acType"), fieldSubject("temp", 2)],
    };
    expect(b.markersOn(landing)).toEqual(b.refsFor([unverified]));
    expect(b.markersOn(landing)).toHaveLength(1);
  });
});

describe("briefingNotes refsFor", () => {
  it("gives the Briefing's reference numbers of the given notifications, in order and once each", () => {
    // weightWarning (sortie) is 1; arrivalTemp (environment) is 2; landingExtrapolated (told) is 3.
    const b = briefingNotes([landingExtrapolated, arrivalTemp, weightWarning]);
    expect(b.refsFor([landingExtrapolated, arrivalTemp, landingExtrapolated])).toEqual([2, 3]);
  });

  it("leaves out notifications the Briefing doesn't print", () => {
    const b = briefingNotes([arrivalTemp, nearLimit]);
    expect(b.refsFor([nearLimit, landingExtrapolated])).toEqual([]);
  });
});
