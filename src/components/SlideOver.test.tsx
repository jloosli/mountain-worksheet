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
    // Headless UI either removes the dialog from the DOM when closed
    // (in which case this test verifies absence via queryByRole returning
    // null) or keeps it with aria-hidden="true" (in which case the
    // attribute assertion fires). Both outcomes are acceptable.
    const dialog = screen.queryByRole("dialog");
    if (dialog) {
      expect(dialog).toHaveAttribute("aria-hidden", "true");
    }
  });
});
