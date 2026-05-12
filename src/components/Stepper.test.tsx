// src/components/Stepper.test.tsx
import { render, screen } from "@testing-library/react";
import Stepper from "./Stepper";

const defaultSteps = [
  { id: "step-sortie",   number: 1, label: "Sortie Details", status: "active"   as const },
  { id: "step-weather",  number: 2, label: "Weather",        status: "pending"  as const },
  { id: "step-decision", number: 3, label: "Decision",       status: "pending"  as const },
];

describe("Stepper", () => {
  it("renders all step labels and numbers", () => {
    render(<Stepper steps={defaultSteps} />);
    expect(screen.getByText("Sortie Details")).toBeInTheDocument();
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders each step as an anchor pointing to its section id", () => {
    render(<Stepper steps={defaultSteps} />);
    expect(screen.getByRole("link", { name: /Sortie Details/ })).toHaveAttribute("href", "#step-sortie");
    expect(screen.getByRole("link", { name: /Weather/ })).toHaveAttribute("href", "#step-weather");
    expect(screen.getByRole("link", { name: /Decision/ })).toHaveAttribute("href", "#step-decision");
  });

  it("uses the active-step className when activeId is explicitly set", () => {
    render(<Stepper steps={defaultSteps} activeId="step-weather" />);
    const weather = screen.getByRole("link", { name: /Weather/ });
    expect(weather).toHaveAttribute("data-active", "true");
  });
});
