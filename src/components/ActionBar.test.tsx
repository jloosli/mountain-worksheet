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
});
