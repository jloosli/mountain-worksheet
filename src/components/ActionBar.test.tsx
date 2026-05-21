// src/components/ActionBar.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import ActionBar from "./ActionBar";
import type { WorksheetData } from "@/utils/types";

const empty: WorksheetData = {
  pilot: "",
  date: "",
  time: "",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)] as [
    (number | null)[],
    (number | null)[],
    (number | null)[],
  ],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [null, null, null],
  altimeter: [null, null, null],
  altitude: [null, null, null],
  rwy: [null, null],
  weight: null,
  mtnEndorse: false,
  mtnCert: false,
};

const baseProps = {
  worksheetData: empty,
  onFetch: jest.fn(),
  fetchDisabled: false,
  isFetching: false,
  onOpenChecklist: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ActionBar — incomplete state", () => {
  it("renders the incomplete title and a disabled Fetch weather button", () => {
    render(<ActionBar {...baseProps} state="incomplete" fetchDisabled={true} />);
    expect(
      screen.getByText(/Add departure airport, arrival airport, date, and time/i)
    ).toBeInTheDocument();
    const fetchBtn = screen.getByRole("button", { name: /Fetch weather/i });
    expect(fetchBtn).toBeDisabled();
  });

  it("disabled Fetch weather click does not call onFetch", () => {
    render(<ActionBar {...baseProps} state="incomplete" fetchDisabled={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));
    expect(baseProps.onFetch).not.toHaveBeenCalled();
  });
});

describe("ActionBar — ready state", () => {
  const ready = {
    ...baseProps,
    state: "ready" as const,
    worksheetData: {
      ...empty,
      airport: ["KOGD", "KLGU"] as [string, string],
      date: "2026-05-12",
      time: "18:00",
    },
  };

  it("renders the ready title and an enabled Fetch weather button", () => {
    render(<ActionBar {...ready} />);
    expect(screen.getByText(/Sortie details ready/i)).toBeInTheDocument();
    const fetchBtn = screen.getByRole("button", { name: /Fetch weather/i });
    expect(fetchBtn).not.toBeDisabled();
  });

  it("subtext summarises departure / arrival / time", () => {
    render(<ActionBar {...ready} />);
    expect(screen.getByText(/KOGD/)).toBeInTheDocument();
    expect(screen.getByText(/KLGU/)).toBeInTheDocument();
    expect(screen.getByText(/18:00z/)).toBeInTheDocument();
  });

  it("clicking Fetch weather calls onFetch", () => {
    render(<ActionBar {...ready} />);
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));
    expect(ready.onFetch).toHaveBeenCalledTimes(1);
  });
});

describe("ActionBar — fetched state", () => {
  const fetched = {
    ...baseProps,
    state: "fetched" as const,
    weatherLastUpdated: new Date("2026-05-12T14:31:00Z"),
  };

  it("renders the fetched title with the fetch timestamp", () => {
    render(<ActionBar {...fetched} />);
    expect(screen.getByText(/Weather fetched/i)).toBeInTheDocument();
    expect(screen.getByText(/14:31z/)).toBeInTheDocument();
  });

  it("renders a Re-fetch button that calls onFetch", () => {
    render(<ActionBar {...fetched} />);
    const refetch = screen.getByRole("button", { name: /Re-fetch/i });
    fireEvent.click(refetch);
    expect(fetched.onFetch).toHaveBeenCalledTimes(1);
  });

  it("renders a Review decision link pointing to #step-decision", () => {
    render(<ActionBar {...fetched} />);
    const link = screen.getByRole("link", { name: /Review decision/i });
    expect(link).toHaveAttribute("href", "#step-decision");
  });
});

describe("ActionBar — all-done state", () => {
  it("renders the all-done title and the Print + Acknowledge buttons", () => {
    render(<ActionBar {...baseProps} state="all-done" />);
    expect(screen.getByText(/All checks complete/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print briefing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acknowledge/i })).toBeInTheDocument();
  });
});

describe("ActionBar — isFetching", () => {
  it("shows a Loading… label while fetching", () => {
    render(
      <ActionBar
        {...baseProps}
        state="ready"
        worksheetData={{
          ...empty,
          airport: ["KOGD", "KLGU"],
          date: "2026-05-12",
          time: "18:00",
        }}
        isFetching={true}
      />
    );
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("reflects isFetching even in the incomplete state (race: fields cleared mid-fetch)", () => {
    render(
      <ActionBar
        {...baseProps}
        state="incomplete"
        fetchDisabled={true}
        isFetching={true}
      />
    );
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
});

describe("ActionBar — Checklist trigger", () => {
  it("renders a Checklist button visible across all states", () => {
    for (const state of ["incomplete", "ready", "fetched", "all-done"] as const) {
      const { unmount } = render(
        <ActionBar
          {...baseProps}
          state={state}
        />
      );
      expect(
        screen.getByRole("button", { name: /Checklist/i })
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("calls onOpenChecklist when the Checklist button is clicked", () => {
    render(<ActionBar {...baseProps} state="incomplete" fetchDisabled={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Checklist/i }));
    expect(baseProps.onOpenChecklist).toHaveBeenCalled();
  });
});

describe("ActionBar — responsive mobile layout (issue #120)", () => {
  const fetched = {
    ...baseProps,
    state: "fetched" as const,
    weatherLastUpdated: new Date("2026-05-12T14:31:00Z"),
  };
  const ready = {
    ...baseProps,
    state: "ready" as const,
    worksheetData: {
      ...empty,
      airport: ["KOGD", "KLGU"] as [string, string],
      date: "2026-05-12",
      time: "18:00",
    },
  };

  function getInnerWrapper(container: HTMLElement): HTMLElement {
    // Inner flex container: the `<div>` carrying `max-w-5xl`
    const el = container.querySelector(".max-w-5xl");
    if (!el) throw new Error("inner wrapper not found");
    return el as HTMLElement;
  }

  it("outer wrapper stacks on mobile and rows on sm+", () => {
    const { container } = render(<ActionBar {...fetched} />);
    const wrapper = getInnerWrapper(container);
    expect(wrapper.className).toMatch(/\bflex-col\b/);
    expect(wrapper.className).toMatch(/\bsm:flex-row\b/);
  });

  it("fetched subtitle is hidden on mobile", () => {
    render(<ActionBar {...fetched} />);
    const subtitle = screen.getByText(
      /Review the weather below, then proceed to the decision/i
    );
    expect(subtitle.className).toMatch(/\bhidden\b/);
    expect(subtitle.className).toMatch(/\bsm:block\b/);
  });

  it("ready subtitle is hidden on mobile", () => {
    render(<ActionBar {...ready} />);
    const subtitle = screen.getByText(/ready to fetch weather/i);
    expect(subtitle.className).toMatch(/\bhidden\b/);
    expect(subtitle.className).toMatch(/\bsm:block\b/);
  });

  it("Checklist divider is sm:-only", () => {
    render(<ActionBar {...baseProps} state="incomplete" fetchDisabled={true} />);
    const checklistBtn = screen.getByRole("button", { name: /Checklist/i });
    const slot = checklistBtn.parentElement;
    if (!slot) throw new Error("Checklist slot not found");
    expect(slot.className).toMatch(/\bsm:border-l\b/);
    // Plain `border-l` must NOT appear unprefixed — the divider is gated by sm:.
    expect(slot.className).not.toMatch(/(^|\s)border-l(\s|$)/);
  });
});
