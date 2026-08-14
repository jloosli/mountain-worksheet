import { fireEvent, render, screen } from "../test-utils/test-utils";
import WorksheetHeader from "./WorksheetHeader";

const defaultProps = {
  onReset: jest.fn(),
  onShare: jest.fn(),
  useFahrenheit: false,
  onToggleTempUnit: jest.fn(),
  onOpenInstructions: jest.fn(),
};

describe("WorksheetHeader", () => {
  function getInnerWrapper(banner: HTMLElement): HTMLElement {
    // Inner flex container: the `<div>` carrying `max-w-5xl`
    const el = banner.querySelector(".max-w-5xl");
    if (!el) throw new Error("inner wrapper not found");
    return el as HTMLElement;
  }

  it('renders "Current Time" instead of "Current UTC"', () => {
    render(<WorksheetHeader {...defaultProps} />);

    expect(screen.getByText("Current Time")).toBeInTheDocument();
    expect(screen.queryByText("Current UTC")).not.toBeInTheDocument();
  });

  it("header inner container uses max-w-5xl consistent with main content width", () => {
    render(<WorksheetHeader {...defaultProps} />);

    const banner = screen.getByRole("banner");
    expect(banner.querySelector(".max-w-6xl")).not.toBeInTheDocument();
    expect(banner.querySelector(".max-w-5xl")).toBeInTheDocument();
  });

  it("does not render a Fetch Weather button (moved to the action bar)", () => {
    render(<WorksheetHeader {...defaultProps} />);
    expect(
      screen.queryByRole("button", { name: /Fetch Weather/i })
    ).not.toBeInTheDocument();
  });

  it("stacks the title above the controls below the sm breakpoint", () => {
    render(<WorksheetHeader {...defaultProps} />);

    const wrapper = getInnerWrapper(screen.getByRole("banner"));
    expect(wrapper.className).toMatch(/\bflex-col\b/);
    expect(wrapper.className).toMatch(/\bsm:flex-row\b/);
  });

  it("only truncates the title from sm up, so mobile shows the full name", () => {
    render(<WorksheetHeader {...defaultProps} />);

    const title = screen.getByRole("heading", {
      name: "Mountain Flying Worksheet",
    });
    expect(title).toHaveClass("sm:truncate");
    expect(title).not.toHaveClass("truncate");
  });

  it("renders an instructions trigger button and calls onOpenInstructions when clicked", () => {
    render(<WorksheetHeader {...defaultProps} />);
    const trigger = screen.getByRole("button", { name: /instructions/i });
    fireEvent.click(trigger);
    expect(defaultProps.onOpenInstructions).toHaveBeenCalled();
  });
});
