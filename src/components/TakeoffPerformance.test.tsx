import React from "react";
import { render, screen, within } from "@/test-utils/test-utils";
import TakeoffPerformance from "./TakeoffPerformance";
import {
  TOLD_VALUE_KEYS,
  toldSubject,
  type AirportSlot,
  type ComputedValue,
  type TOLDValueKey,
  type TOLDViewModel,
} from "@/utils/derived";
import { fieldSubject, valueSubject, type Notification } from "@/utils/notifications";

const computed = (value: number, dependsOn = [fieldSubject("acType")]): ComputedValue => ({
  status: "computed",
  value,
  dependsOn,
});

function airport(slot: AirportSlot, overrides: Partial<Record<TOLDValueKey, ComputedValue>> = {}) {
  const values = Object.fromEntries(
    TOLD_VALUE_KEYS.map((key, i) => [key, computed((slot === "departure" ? 1000 : 2000) + i)]),
  ) as Record<TOLDValueKey, ComputedValue>;
  return { slot, values: { ...values, ...overrides }, notifications: [] };
}

function viewModel(
  overrides: {
    departure?: Partial<Record<TOLDValueKey, ComputedValue>>;
    arrival?: Partial<Record<TOLDValueKey, ComputedValue>>;
  } = {},
  notifications: Notification[] = [],
): TOLDViewModel {
  return {
    departure: airport("departure", overrides.departure),
    arrival: airport("arrival", overrides.arrival),
    notifications,
  };
}

function row(name: RegExp) {
  return screen.getByRole("row", { name });
}

describe("TakeoffPerformance", () => {
  it("renders nothing without an aircraft", () => {
    const { container } = render(
      <TakeoffPerformance airports={["KSLC", "KPVU"]} told={viewModel()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each airport's distances under its column", () => {
    render(
      <TakeoffPerformance aircraftModel="C182T" airports={["KSLC", "KPVU"]} told={viewModel()} />,
    );
    expect(screen.getByRole("table", { name: /TOLD.*C182T/ })).toBeInTheDocument();
    const cells = within(row(/Take Off Ground Roll/)).getAllByRole("cell");
    // label, dep short, arr short, dep obstacle, arr obstacle
    expect(cells.map((c) => c.textContent)).toEqual([
      "Take Off Ground Roll",
      (1000).toLocaleString(),
      (2000).toLocaleString(),
      (1001).toLocaleString(),
      (2001).toLocaleString(),
    ]);
  });

  it("shows what a withheld value is waiting for and a dash for an unavailable one", () => {
    render(
      <TakeoffPerformance
        aircraftModel="C182T"
        airports={["KSLC", "KPVU"]}
        told={viewModel({
          arrival: {
            landingGroundRoll: { status: "withheld", reason: "needs arrival temperature" },
            landing50ftObstacle: { status: "unavailable" },
          },
        })}
      />,
    );
    const cells = within(row(/Landing Ground Roll/)).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("needs arrival temperature");
    expect(cells[4]).toHaveTextContent("—");
  });

  it("styles ground-roll runway remaining with the Runway check's point states", () => {
    render(
      <TakeoffPerformance
        aircraftModel="C182T"
        airports={["KSLC", "KPVU"]}
        told={viewModel({ departure: { runwayRemainingGroundRoll: computed(0) } })}
        runwayStates={{ departure: "exceeded", arrival: "within" }}
      />,
    );
    const cells = within(row(/runway remaining/)).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent(/^0$/);
    expect(cells[1].className).toMatch(/text-red/);
    expect(cells[2].className).not.toMatch(/text-red/);
  });

  it("never styles the over-50-ft-obstacle runway remaining, even when negative", () => {
    render(
      <TakeoffPerformance
        aircraftModel="C182T"
        airports={["KSLC", "KPVU"]}
        told={viewModel({ departure: { runwayRemaining50ft: computed(-150) } })}
        runwayStates={{ departure: "exceeded", arrival: "exceeded" }}
      />,
    );
    const cells = within(row(/runway remaining/)).getAllByRole("cell");
    expect(cells[3]).toHaveTextContent((-150).toLocaleString());
    expect(cells[3].className).not.toMatch(/text-red/);
    expect(cells[4].className).not.toMatch(/text-red/);
  });

  it("shows airport, takeoff and landing notifications under the table", () => {
    const notifications: Notification[] = [
      {
        level: "advisory",
        subject: valueSubject("told.departure", "decision"),
        message: "Departure pressure altitude is above 15,000 ft",
      },
      {
        level: "caution",
        subject: toldSubject("arrival", "takeoff"),
        message: "Arrival takeoff distances extrapolated",
      },
      {
        level: "warning",
        subject: toldSubject("arrival", "landing"),
        message: "Arrival landing distances could not be computed",
      },
    ];
    render(
      <TakeoffPerformance
        aircraftModel="C182T"
        airports={["KSLC", "KPVU"]}
        told={viewModel({}, notifications)}
      />,
    );
    for (const n of notifications) {
      expect(screen.getByText(n.message)).toBeInTheDocument();
    }
  });

  it("marks values whose inputs carry a Caution", () => {
    render(
      <TakeoffPerformance
        aircraftModel="C182T"
        airports={["KSLC", "KPVU"]}
        told={viewModel({
          arrival: { landingGroundRoll: computed(2100, [fieldSubject("temp", 2)]) },
        })}
        inputNotifications={[
          { level: "caution", subject: fieldSubject("temp", 2), message: "Nearest TAF period" },
        ]}
      />,
    );
    const cells = within(row(/Landing Ground Roll/)).getAllByRole("cell");
    expect(within(cells[2]).getByRole("link", { name: /Nearest TAF period/ })).toBeInTheDocument();
    expect(within(cells[1]).queryByRole("link")).toBeNull();
  });
});
