// src/components/StepShell.test.tsx
import { render, screen } from "@testing-library/react";
import StepShell from "./StepShell";

describe("StepShell", () => {
  it("renders the section element with the provided id", () => {
    const { container } = render(
      <StepShell id="step-sortie" number={1} status="active" title="Sortie Details">
        <p>body</p>
      </StepShell>
    );
    expect(container.querySelector("section#step-sortie")).not.toBeNull();
  });

  it("renders the step number, title, and children", () => {
    render(
      <StepShell id="step-weather" number={2} status="pending" title="Weather">
        <p data-testid="body">child content</p>
      </StepShell>
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weather", level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId("body")).toBeInTheDocument();
  });

  it("renders an optional subtitle when provided", () => {
    render(
      <StepShell
        id="step-sortie"
        number={1}
        status="active"
        title="Sortie Details"
        subtitle="Who's flying, when, and where"
      >
        body
      </StepShell>
    );
    expect(screen.getByText("Who's flying, when, and where")).toBeInTheDocument();
  });

  it("renders an optional badge when provided", () => {
    render(
      <StepShell
        id="step-weather"
        number={2}
        status="complete"
        title="Weather"
        badge="Fetched 14:31 UTC"
      >
        body
      </StepShell>
    );
    expect(screen.getByText("Fetched 14:31 UTC")).toBeInTheDocument();
  });

  it("renders a spine connector by default and omits it when showSpine={false}", () => {
    const { container, rerender } = render(
      <StepShell id="step-sortie" number={1} status="active" title="Sortie Details">
        body
      </StepShell>
    );
    expect(container.querySelector('[data-testid="step-spine"]')).not.toBeNull();

    rerender(
      <StepShell
        id="step-decision"
        number={3}
        status="pending"
        title="Decision"
        showSpine={false}
      >
        body
      </StepShell>
    );
    expect(container.querySelector('[data-testid="step-spine"]')).toBeNull();
  });
});
