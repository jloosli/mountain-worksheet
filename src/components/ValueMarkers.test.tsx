import React from "react";
import { render, screen } from "@/test-utils/test-utils";
import ValueMarkers from "./ValueMarkers";
import { fieldSubject, type Notification } from "@/utils/notifications";
import type { ComputedValue } from "@/utils/derived";

const arrivalLanding: ComputedValue = {
  status: "computed",
  value: 1200,
  dependsOn: [fieldSubject("acType"), fieldSubject("altitude", 2), fieldSubject("temp", 2)],
};

const tempCaution: Notification = {
  level: "caution",
  subject: fieldSubject("temp", 2),
  message: "KXYZ: using nearest TAF period",
};

function renderMarkers(notifications: Notification[], value: ComputedValue = arrivalLanding) {
  return render(
    <span>
      <ValueMarkers notifications={notifications} value={value} />
    </span>
  );
}

describe("ValueMarkers", () => {
  it("links a Caution on an input to where that Caution is shown", () => {
    renderMarkers([tempCaution]);
    const marker = screen.getByRole("link", { name: /KXYZ: using nearest TAF period/ });
    expect(marker).toHaveAttribute("href", "#notifications-field-temp-2");
    expect(marker).toHaveAttribute("title", expect.stringContaining("KXYZ: using nearest TAF period"));
  });

  it("shows no marker when no input of the value has a Caution", () => {
    const { container } = renderMarkers([
      { ...tempCaution, subject: fieldSubject("temp", 0) },
    ]);
    expect(container.querySelector("[data-marker]")).toBeNull();
  });

  it("ignores Warnings and Advisories on inputs", () => {
    const { container } = renderMarkers([
      { ...tempCaution, level: "warning" },
      { ...tempCaution, level: "advisory" },
    ]);
    expect(container.querySelector("[data-marker]")).toBeNull();
  });

  it("shares one marker between several Cautions on the same input", () => {
    renderMarkers([tempCaution, { ...tempCaution, message: "Second reason" }]);
    const markers = screen.getAllByRole("link");
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAccessibleName(expect.stringContaining("Second reason"));
  });

  it("gives each input with a Caution its own marker", () => {
    renderMarkers([
      tempCaution,
      { level: "caution", subject: fieldSubject("altitude", 2), message: "Elevation snapped" },
    ]);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows nothing for a withheld value", () => {
    const { container } = renderMarkers([tempCaution], {
      status: "withheld",
      reason: "needs arrival temperature",
    });
    expect(container.querySelector("[data-marker]")).toBeNull();
  });
});
