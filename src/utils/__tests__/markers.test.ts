import { inputCautions } from "../markers";
import { fieldSubject, type Notification } from "../notifications";
import type { ComputedValue } from "../derived";

const arrivalTempSubstitution: Notification = {
  level: "caution",
  subject: fieldSubject("temp", 2),
  message: "KXYZ: no forecast period covers the arrival time; using current observation",
};

const landing: ComputedValue = {
  status: "computed",
  value: 1450,
  dependsOn: [
    fieldSubject("acType"),
    fieldSubject("altitude", 2),
    fieldSubject("altimeter", 2),
    fieldSubject("temp", 2),
  ],
};

describe("inputCautions", () => {
  it("returns the Caution on an input the value was computed from", () => {
    expect(inputCautions([arrivalTempSubstitution], landing)).toEqual([
      arrivalTempSubstitution,
    ]);
  });

  it("ignores Cautions on inputs the value does not depend on", () => {
    const departure: ComputedValue = {
      status: "computed",
      value: 1200,
      dependsOn: [fieldSubject("acType"), fieldSubject("temp", 0)],
    };
    expect(inputCautions([arrivalTempSubstitution], departure)).toEqual([]);
  });

  it("ignores Warnings and Advisories on the value's inputs", () => {
    const others: Notification[] = [
      { ...arrivalTempSubstitution, level: "warning" },
      { ...arrivalTempSubstitution, level: "advisory" },
    ];
    expect(inputCautions(others, landing)).toEqual([]);
  });

  it("has nothing to mark on a withheld or unavailable value", () => {
    expect(
      inputCautions([arrivalTempSubstitution], { status: "withheld", reason: "needs weight" })
    ).toEqual([]);
    expect(inputCautions([arrivalTempSubstitution], { status: "unavailable" })).toEqual([]);
  });
});
