import { render, screen, fireEvent } from "@testing-library/react";
import SlideOver from "./SlideOver";

describe("SlideOver — open state", () => {
  it("renders the title and body when open", () => {
    render(
      <SlideOver isOpen={true} onClose={() => {}} title="Test title">
        <p>Body content</p>
      </SlideOver>
    );
    expect(screen.getByText("Test title")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("renders a Close button with an accessible label", () => {
    render(
      <SlideOver isOpen={true} onClose={() => {}} title="Test title">
        <p>Body</p>
      </SlideOver>
    );
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = jest.fn();
    render(
      <SlideOver isOpen={true} onClose={onClose} title="Test title">
        <p>Body</p>
      </SlideOver>
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("SlideOver — closed state", () => {
  it("does not show the body content visibly when closed", () => {
    render(
      <SlideOver isOpen={false} onClose={() => {}} title="Hidden title">
        <p>Hidden body</p>
      </SlideOver>
    );
    // With unmount={false} on the root Transition and its children, the
    // dialog must stay in the DOM when closed so the print stylesheet can
    // reposition it as a static appendix. Headless UI v2 marks the closed
    // dialog with the `hidden` attribute (and a `display: none` inline
    // style); the print CSS in globals.css overrides both. Assert the
    // dialog is mounted and properly hidden on screen.
    const title = screen.getByText("Hidden title");
    const dialog = title.closest("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAttribute("hidden");
  });
});
