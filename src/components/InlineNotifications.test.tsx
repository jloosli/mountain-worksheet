import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InlineNotifications, {
  notificationA11yProps,
} from "./InlineNotifications";
import {
  fieldSubject,
  stepSubject,
  type Notification,
} from "@/utils/notifications";

const warning: Notification = {
  level: "warning",
  subject: fieldSubject("temp", 2),
  message: "BOI: no METAR or TAF",
};
const caution: Notification = {
  level: "caution",
  subject: fieldSubject("temp", 2),
  message: "using nearest TAF period",
};
const advisory: Notification = {
  level: "advisory",
  subject: fieldSubject("temp", 2),
  message: "observation time could not be parsed",
};
const elsewhere: Notification = {
  level: "warning",
  subject: stepSubject("weather"),
  message: "G-AIRMET request failed",
};

function Field({ notifications }: { notifications: Notification[] }) {
  const subject = fieldSubject("temp", 2);
  return (
    <>
      <label htmlFor="t">Arrival temperature</label>
      <input id="t" {...notificationA11yProps(notifications, subject)} />
      <InlineNotifications notifications={notifications} subject={subject} />
    </>
  );
}

describe("InlineNotifications", () => {
  it("renders nothing when its Subject has no notifications", () => {
    const { container } = render(
      <InlineNotifications
        notifications={[elsewhere]}
        subject={fieldSubject("temp", 2)}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the notifications about its Subject, labelled by level", () => {
    render(
      <InlineNotifications
        notifications={[warning, caution, advisory, elsewhere]}
        subject={fieldSubject("temp", 2)}
      />
    );
    expect(screen.getByText(/BOI: no METAR or TAF/)).toBeInTheDocument();
    expect(screen.getByText(/using nearest TAF period/)).toBeInTheDocument();
    expect(screen.getByText(/could not be parsed/)).toBeInTheDocument();
    expect(screen.queryByText(/G-AIRMET/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.dataset.level)).toEqual([
      "warning",
      "caution",
      "advisory",
    ]);
    expect(screen.getByText("Warning:")).toBeInTheDocument();
    expect(screen.getByText("Caution:")).toBeInTheDocument();
    expect(screen.getByText("Advisory:")).toBeInTheDocument();
  });

  it("styles each level red / amber / neutral", () => {
    render(
      <InlineNotifications
        notifications={[warning, caution, advisory]}
        subject={fieldSubject("temp", 2)}
      />
    );
    const [w, c, a] = screen.getAllByRole("listitem");
    expect(w.className).toMatch(/red/);
    expect(c.className).toMatch(/amber/);
    expect(a.className).toMatch(/slate/);
  });

  it("marks a field with a Warning invalid and describes it by its notifications", () => {
    render(<Field notifications={[warning]} />);
    const input = screen.getByLabelText("Arrival temperature");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/BOI: no METAR or TAF/);
  });

  it("describes but does not invalidate a field with only a Caution", () => {
    render(<Field notifications={[caution]} />);
    const input = screen.getByLabelText("Arrival temperature");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription(/using nearest TAF period/);
  });

  it("adds no ARIA attributes to a field without notifications", () => {
    render(<Field notifications={[elsewhere]} />);
    const input = screen.getByLabelText("Arrival temperature");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});
