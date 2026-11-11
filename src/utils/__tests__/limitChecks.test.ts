import {
  computeClimbViewModel,
  computePressureColumns,
  computeTOLDViewModel,
  derivePerformanceNotifications,
} from "../derived";
import {
  deriveLimitChecks,
  limitCheckSummary,
  bySeverity,
  worstState,
  type LimitCheck,
} from "../limitChecks";
import { fieldSubject, type Notification } from "../notifications";
import type { WorksheetData } from "../types";

const baseState = (): WorksheetData => ({
  pilot: "",
  date: "2026-01-01",
  time: "10:00",
  duration: null,
  acType: "C182T", // max gross 3,100 lbs, empty 2,300 lbs
  tailN: "",
  airport: ["KABC", "KXYZ"],
  route: "",
  position: [null, null],
  wind: [
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [20, 10, 20],
  altimeter: [29.92, 29.92, 29.92],
  altitude: [1000, 8000, 1000],
  rwy: [3000, 3000],
  weight: 2700,
  mtnEndorse: false,
  mtnCert: false,
});

/**
 * The checks for `state`, with the notifications AppContainer would derive
 * for it (performance notifications plus any `extra`).
 */
function checksFor(state: WorksheetData, extra: Notification[] = []): LimitCheck[] {
  const notifications = [...derivePerformanceNotifications(state), ...extra];
  const { PAs } = computePressureColumns(state.altitude, state.altimeter, state.temp);
  return deriveLimitChecks({
    state,
    notifications,
    climb: computeClimbViewModel(state, notifications),
    told: computeTOLDViewModel(state, PAs, notifications),
  });
}

const weightCheck = (state: WorksheetData, extra: Notification[] = []) => {
  const check = checksFor(state, extra).find((c) => c.id === "weight");
  if (!check) throw new Error("no weight check");
  return check;
};

describe("worstState", () => {
  it("orders Exceeded > Not checked > Near limit > Within limit", () => {
    expect(worstState(["within", "near"])).toBe("near");
    expect(worstState(["near", "not-checked", "within"])).toBe("not-checked");
    expect(worstState(["not-checked", "exceeded"])).toBe("exceeded");
    expect(worstState(["within"])).toBe("within");
  });

  it("is Within limit with no points", () => {
    expect(worstState([])).toBe("within");
  });
});

describe("Weight limit check", () => {
  it("describes the worksheet limit and belongs to Sortie Details", () => {
    const check = weightCheck(baseState());
    expect(check).toMatchObject({
      id: "weight",
      name: "Weight",
      limit: "under 90% of maximum gross weight",
      caveat: null,
      step: "sortie",
    });
  });

  it("is Within limit at 89.9% of maximum gross", () => {
    const check = weightCheck({ ...baseState(), weight: 2787 }); // 89.90%
    expect(check.state).toBe("within");
    expect(check.points).toEqual([
      {
        label: "Weight",
        state: "within",
        value: "2,787 / 3,100 lbs (89.9%)",
        substitutions: [],
      },
    ]);
  });

  it("is Exceeded at exactly 90.0% of maximum gross", () => {
    const check = weightCheck({ ...baseState(), weight: 2790 });
    expect(check.state).toBe("exceeded");
    expect(check.points[0]).toMatchObject({
      state: "exceeded",
      value: "2,790 / 3,100 lbs (90%)",
    });
  });

  it("never rounds a percentage just under 90% up to 90%", () => {
    const check = weightCheck({ ...baseState(), weight: 2789 }); // 89.97%
    expect(check.state).toBe("within");
    expect(check.points[0].value).toBe("2,789 / 3,100 lbs (89.9%)");
  });

  it("is still Exceeded above maximum gross despite the over-max-gross Warning", () => {
    const state = { ...baseState(), weight: 3255 }; // 105%
    expect(derivePerformanceNotifications(state)).toContainEqual(
      expect.objectContaining({ level: "warning", subject: fieldSubject("weight") }),
    );
    const check = weightCheck(state);
    expect(check.state).toBe("exceeded");
    expect(check.points[0]).toMatchObject({
      state: "exceeded",
      value: "3,255 / 3,100 lbs (105%)",
    });
  });

  it("is Not checked when the weight is blank, naming it", () => {
    const check = weightCheck({ ...baseState(), weight: null });
    expect(check.state).toBe("not-checked");
    expect(check.points).toEqual([
      { label: "Weight", state: "not-checked", waitingFor: "needs weight", substitutions: [] },
    ]);
  });

  it("is Not checked when the aircraft is blank, naming it", () => {
    const check = weightCheck({ ...baseState(), acType: "" });
    expect(check.state).toBe("not-checked");
    expect(check.points[0].waitingFor).toBe("needs aircraft type");
  });

  it("names both when the aircraft and weight are blank", () => {
    const check = weightCheck({ ...baseState(), acType: "", weight: null });
    expect(check.points[0].waitingFor).toBe("needs aircraft type and weight");
  });

  it("is Not checked for an aircraft without POH data", () => {
    const check = weightCheck({ ...baseState(), acType: "XYZ" });
    expect(check.state).toBe("not-checked");
    expect(check.points[0].waitingFor).toBe("needs a supported aircraft type");
  });

  it("is Not checked when the weight is below empty weight (withheld)", () => {
    const check = weightCheck({ ...baseState(), weight: 2000 });
    expect(check.state).toBe("not-checked");
    expect(check.points[0].waitingFor).toBe("needs valid weight");
  });

  it("is Not checked when another Warning makes the weight untrusted", () => {
    const linkWarning: Notification = {
      level: "warning",
      subject: fieldSubject("weight"),
      message: "The shared link's weight could not be read.",
    };
    expect(weightCheck({ ...baseState(), weight: 2900 }, [linkWarning]).state).toBe(
      "not-checked",
    );
    // Above max gross the extra Warning still makes it untrusted.
    const over = weightCheck({ ...baseState(), weight: 3255 }, [linkWarning]);
    expect(over.state).toBe("not-checked");
    expect(over.points[0].waitingFor).toBe("needs weight checked (Warning)");
  });

  it("carries the Caution of a substituted input as a marker and still evaluates", () => {
    const caution: Notification = {
      level: "caution",
      subject: fieldSubject("weight"),
      message: "Weight came from a shared link.",
    };
    const check = weightCheck({ ...baseState(), weight: 2900 }, [caution]);
    expect(check.state).toBe("exceeded");
    expect(check.points[0].substitutions).toEqual([caution]);
  });

  it("no longer raises an Advisory near maximum gross weight", () => {
    const notifications = derivePerformanceNotifications({ ...baseState(), weight: 3000 });
    expect(notifications.filter((n) => n.level === "advisory")).toEqual([]);
  });
});

const check = (id: string, state: LimitCheck["state"]): LimitCheck => ({
  id: id as LimitCheck["id"],
  name: id,
  limit: "",
  caveat: null,
  step: "sortie",
  state,
  points: [],
});

describe("limitCheckSummary", () => {
  it("counts each state and omits parts with a count of zero", () => {
    const checks = [
      check("a", "exceeded"),
      check("b", "within"),
      check("c", "not-checked"),
      check("d", "exceeded"),
      check("e", "within"),
    ];
    expect(limitCheckSummary(checks)).toBe(
      "2 of 5 worksheet limits exceeded · 1 not checked · 2 within limit",
    );
  });

  it("leaves out the exceeded part when nothing is exceeded", () => {
    expect(limitCheckSummary([check("a", "near"), check("b", "within")])).toBe(
      "1 near limit · 1 within limit",
    );
  });

  it("uses the singular for one worksheet limit", () => {
    expect(limitCheckSummary([check("a", "exceeded")])).toBe(
      "1 of 1 worksheet limit exceeded",
    );
  });
});

describe("bySeverity", () => {
  it("orders checks worst first, keeping the original order within a state", () => {
    const checks = [
      check("a", "within"),
      check("b", "not-checked"),
      check("c", "exceeded"),
      check("d", "near"),
      check("e", "exceeded"),
    ];
    expect(bySeverity(checks).map((c) => c.id)).toEqual(["c", "e", "b", "d", "a"]);
  });
});
