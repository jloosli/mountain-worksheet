import { render, screen, within } from "@testing-library/react";
import LimitCheckCallout, { LimitCheckCallouts, limitPointClass } from "./LimitCheckCallout";
import type { LimitCheck } from "@/utils/limitChecks";
import { fieldSubject, type Notification } from "@/utils/notifications";

const weight = (overrides: Partial<LimitCheck> = {}): LimitCheck => ({
  id: "weight",
  name: "Weight",
  limit: "under 90% of maximum gross weight",
  caveat: null,
  step: "sortie",
  state: "exceeded",
  points: [
    {
      label: "Weight",
      state: "exceeded",
      value: "2,900 / 3,100 lbs (93.5%)",
      substitutions: [],
    },
  ],
  ...overrides,
});

describe("LimitCheckCallout", () => {
  it("shows a check's guidance note when it has one", () => {
    render(
      <LimitCheckCallout
        check={weight({ state: "near", note: "Near limit from 20 kt: proceed with caution." })}
      />,
    );
    expect(screen.getByRole("region", { name: "Limit check: Weight" })).toHaveTextContent(
      "Near limit from 20 kt: proceed with caution.",
    );
  });

  it("shows the name, state chip, worksheet limit and point", () => {
    render(<LimitCheckCallout check={weight()} />);
    const callout = screen.getByRole("region", { name: "Limit check: Weight" });
    expect(callout).toHaveAttribute("id", "limit-check-weight");
    expect(within(callout).getByText("Exceeded")).toBeInTheDocument();
    expect(callout).toHaveTextContent("Worksheet limit: under 90% of maximum gross weight");
    expect(callout).toHaveTextContent("Weight2,900 / 3,100 lbs (93.5%)");
  });

  it("names what a Not checked point is waiting for, in a dashed neutral style", () => {
    render(
      <LimitCheckCallout
        check={weight({
          state: "not-checked",
          points: [
            { label: "Weight", state: "not-checked", waitingFor: "needs weight", substitutions: [] },
          ],
        })}
      />,
    );
    const callout = screen.getByRole("region", { name: "Limit check: Weight" });
    expect(within(callout).getByText("Not checked")).toBeInTheDocument();
    expect(within(callout).getByText("needs weight")).toBeInTheDocument();
    expect(callout.className).toContain("border-dashed");
    expect(callout.className).not.toMatch(/red|amber/);
  });

  it("uses the glossary names for each state", () => {
    const { rerender } = render(<LimitCheckCallout check={weight({ state: "within" })} />);
    expect(screen.getByText("Within limit")).toBeInTheDocument();
    rerender(<LimitCheckCallout check={weight({ state: "near" })} />);
    expect(screen.getByText("Near limit")).toBeInTheDocument();
  });

  it("marks a point that rests on a substitution, linking to its Caution", () => {
    const caution: Notification = {
      level: "caution",
      subject: fieldSubject("weight"),
      message: "Weight came from a shared link.",
    };
    const check = weight();
    check.points[0].substitutions = [caution];
    const { container } = render(<LimitCheckCallout check={check} />);
    const marker = container.querySelector('[data-marker="caution"]');
    expect(marker).toHaveAttribute("title", "Caution on an input: Weight came from a shared link.");
  });

  it("shows the fixed caveat when there is one", () => {
    render(<LimitCheckCallout check={weight({ caveat: "Surface wind and gusts are not checked." })} />);
    expect(screen.getByText("Surface wind and gusts are not checked.")).toBeInTheDocument();
  });
});

describe("LimitCheckCallouts", () => {
  it("shows only the checks the step owns", () => {
    const { container, rerender } = render(
      <LimitCheckCallouts checks={[weight()]} step="sortie" />,
    );
    expect(screen.getByRole("region", { name: "Limit check: Weight" })).toBeInTheDocument();
    rerender(<LimitCheckCallouts checks={[weight()]} step="weather" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("limitPointClass", () => {
  it("styles only Exceeded and Near limit points", () => {
    expect(limitPointClass("exceeded")).toContain("text-red");
    expect(limitPointClass("near")).toContain("text-amber");
    expect(limitPointClass("within")).toBe("");
    expect(limitPointClass("not-checked")).toBe("");
    expect(limitPointClass(undefined)).toBe("");
  });
});

describe("LimitCheckCallout — anchor offset", () => {
  it("scrolls below the sticky action bar's published bottom edge", () => {
    render(<LimitCheckCallout check={weight()} />);
    expect(screen.getByRole("region", { name: "Limit check: Weight" }).className).toContain(
      "scroll-mt-[calc(var(--action-bar-bottom,13rem)+0.75rem)]",
    );
  });
});
