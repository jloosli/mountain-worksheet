import { render, screen, fireEvent, act } from "@testing-library/react";
import SortieInfo from "./SortieInfo";
import type { WorksheetData } from "@/utils/types";

const defaultInitialData: WorksheetData = {
  pilot: "",
  date: "",
  time: "",
  duration: null,
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
  position: [null, null],
  weight: null,
  altitude: [null, null, null],
  wind: [Array(5).fill(null), Array(5).fill(null), Array(5).fill(null)],
  turb: false,
  cielVis: false,
  mtnObsc: false,
  temp: [null, null, null],
  altimeter: [null, null, null],
  rwy: [null, null],
  mtnEndorse: false,
  mtnCert: false,
};

describe("SortieInfo", () => {
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the operating altitude input", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    expect(screen.getByLabelText(/Operating Altitude/i)).toBeInTheDocument();
  });

  it("displays operating altitude label as 'Area of Operations (position)'", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    expect(screen.getByLabelText("Area of Operations (position)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Area of Operations/Route")).not.toBeInTheDocument();
  });

  it("populates operating altitude from initialData", () => {
    const initialData = { ...defaultInitialData, altitude: [4471, 9000, 4229] as [number | null, number | null, number | null] };
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={initialData} />);
    const input = screen.getByLabelText(/Operating Altitude/i) as HTMLInputElement;
    expect(input.value).toBe("9000");
  });

  it("calls onUpdate with updated altitude[1] when operating altitude changes", () => {
    const initialData = { ...defaultInitialData, altitude: [4471, null, 4229] as [number | null, number | null, number | null] };
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={initialData} />);
    const input = screen.getByLabelText(/Operating Altitude/i);
    fireEvent.change(input, { target: { value: "9000" } });
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ altitude: [4471, 9000, 4229] })
    );
  });

  it("preserves departure and arrival altitude when operating altitude changes", () => {
    const initialData = { ...defaultInitialData, altitude: [5000, 8000, 3500] as [number | null, number | null, number | null] };
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={initialData} />);
    const input = screen.getByLabelText(/Operating Altitude/i);
    fireEvent.change(input, { target: { value: "10000" } });
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ altitude: [5000, 10000, 3500] })
    );
  });

  it("clears operating altitude when input is empty", () => {
    const initialData = { ...defaultInitialData, altitude: [4471, 9000, 4229] as [number | null, number | null, number | null] };
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={initialData} />);
    const input = screen.getByLabelText(/Operating Altitude/i);
    fireEvent.change(input, { target: { value: "" } });
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ altitude: [4471, null, 4229] })
    );
  });

  it("renders the Expected Duration select", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    expect(screen.getByLabelText(/Expected Duration/i)).toBeInTheDocument();
  });

  it("populates duration from initialData", () => {
    const initialData = { ...defaultInitialData, duration: 2.5 };
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={initialData} />);
    const select = screen.getByLabelText(/Expected Duration/i) as HTMLSelectElement;
    expect(select.value).toBe("2.5");
  });

  it("populates duration: 0 from initialData without treating it as falsy", () => {
    const initialData = { ...defaultInitialData, duration: 0 };
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={initialData} />);
    const select = screen.getByLabelText(/Expected Duration/i) as HTMLSelectElement;
    expect(select.value).toBe("0");
  });

  it("calls onUpdate with numeric duration when a value is selected", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    const select = screen.getByLabelText(/Expected Duration/i);
    fireEvent.change(select, { target: { value: "1.5" } });
    expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({ duration: 1.5 }));
  });

  it("calls onUpdate with null duration when selection is cleared", () => {
    const initialData = { ...defaultInitialData, duration: 2 };
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={initialData} />);
    const select = screen.getByLabelText(/Expected Duration/i);
    fireEvent.change(select, { target: { value: "" } });
    expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({ duration: null }));
  });

  it("renders the four sub-heading groups", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    expect(screen.getByRole("heading", { name: "Pilot & Aircraft", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "When", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Where", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pilot Qualifications", level: 3 })).toBeInTheDocument();
  });

  it("renders the mountain qualification checkboxes", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    expect(
      screen.getByLabelText(/Current CAPF 70-5 Mountain Flight Endorsement/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Current CAPF 70-91 and Mountain Flying Certification/i)
    ).toBeInTheDocument();
  });

  it("calls onUpdate with mtnEndorse when the endorsement checkbox is toggled", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    fireEvent.click(screen.getByLabelText(/Current CAPF 70-5 Mountain Flight Endorsement/i));
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ mtnEndorse: true })
    );
  });

  it("calls onUpdate with mtnCert when the certification checkbox is toggled", () => {
    render(<SortieInfo onUpdate={mockOnUpdate} initialData={defaultInitialData} />);
    fireEvent.click(screen.getByLabelText(/Current CAPF 70-91 and Mountain Flying Certification/i));
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ mtnCert: true })
    );
  });
});

describe("SortieInfo - sortie timing relative display", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 4, 15, 0, 0)));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows hours when less than 24 hours in the future", () => {
    const initialData = { ...defaultInitialData, date: "2026-05-15", time: "12:00" };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    expect(screen.getByText(/12 hours from now/)).toBeInTheDocument();
  });

  it("shows days when more than 24 hours and within a week in the future", () => {
    const initialData = { ...defaultInitialData, date: "2026-05-20", time: "02:00" };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    expect(screen.getByText(/5 days from now/)).toBeInTheDocument();
  });

  it("uses singular 'day' for exactly 24 hours away", () => {
    const initialData = { ...defaultInitialData, date: "2026-05-16", time: "00:00" };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    expect(screen.getByText(/1 day from now/)).toBeInTheDocument();
  });

  it("shows days when in the past within a week", () => {
    const initialData = { ...defaultInitialData, date: "2026-05-12", time: "00:00" };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    expect(screen.getByText(/3 days ago/)).toBeInTheDocument();
  });

  it("shows 'more than a week from now' when more than 7 days in the future", () => {
    const initialData = { ...defaultInitialData, date: "2026-05-23", time: "00:00" };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    expect(screen.getByText(/more than a week from now/)).toBeInTheDocument();
  });

  it("shows 'more than a week ago' when more than 7 days in the past", () => {
    const initialData = { ...defaultInitialData, date: "2026-05-07", time: "00:00" };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    expect(screen.getByText(/more than a week ago/)).toBeInTheDocument();
  });

  it("still shows days at exactly 7 days away", () => {
    const initialData = { ...defaultInitialData, date: "2026-05-22", time: "00:00" };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    expect(screen.getByText(/7 days from now/)).toBeInTheDocument();
  });
});

describe("SortieInfo — SkyVector button", () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the button disabled when both airports are blank", () => {
    render(<SortieInfo onUpdate={jest.fn()} initialData={defaultInitialData} />);
    const button = screen.getByRole("button", { name: /open in skyvector/i });
    expect(button).toBeDisabled();
  });

  it("renders the button disabled when only departure is set", () => {
    const initialData = { ...defaultInitialData, airport: ["KPVU", ""] as [string, string] };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    const button = screen.getByRole("button", { name: /open in skyvector/i });
    expect(button).toBeDisabled();
  });

  it("renders the button disabled when only arrival is set", () => {
    const initialData = { ...defaultInitialData, airport: ["", "KSGU"] as [string, string] };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);
    const button = screen.getByRole("button", { name: /open in skyvector/i });
    expect(button).toBeDisabled();
  });

  it("is enabled and opens a two-waypoint URL when only airports are set", () => {
    const initialData = {
      ...defaultInitialData,
      airport: ["KPVU", "KSGU"] as [string, string],
    };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);

    const button = screen.getByRole("button", { name: /open in skyvector/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(openSpy).toHaveBeenCalledWith(
      "https://skyvector.com/?fpl=KPVU%20KSGU",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("opens a three-waypoint URL when operating coordinates are set", () => {
    const initialData = {
      ...defaultInitialData,
      airport: ["KPVU", "KSGU"] as [string, string],
      position: [40.5023, -110.7456] as [number | null, number | null],
    };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: /open in skyvector/i }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://skyvector.com/?fpl=KPVU%20403008N1104444W%20KSGU",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("falls back to two-waypoint URL when operating position has nulls", () => {
    const initialData = {
      ...defaultInitialData,
      airport: ["KPVU", "KSGU"] as [string, string],
      position: [null, null] as [number | null, number | null],
    };
    render(<SortieInfo onUpdate={jest.fn()} initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: /open in skyvector/i }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://skyvector.com/?fpl=KPVU%20KSGU",
      "_blank",
      "noopener,noreferrer"
    );
  });
});

describe("SortieInfo - position field wiring", () => {
  it("calls onUpdate with both route and position when valid coords are entered", async () => {
    jest.useFakeTimers();
    const onUpdate = jest.fn();
    render(<SortieInfo onUpdate={onUpdate} />);
    const input = screen.getByLabelText(/Area of Operations/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "36.01N/75.50W" } });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall.route).toBe("36.01N/75.50W");
    expect(lastCall.position).toEqual([36.01, -75.5]);
    jest.useRealTimers();
  });

  it("hydrates initial position from initialData without re-parsing", () => {
    const initialData = {
      route: "KOGD/285/34",
      position: [41.4321, -112.7042] as [number | null, number | null],
    };
    render(
      <SortieInfo
        initialData={initialData as never}
        onUpdate={() => {}}
      />
    );
    expect(screen.getByDisplayValue("KOGD/285/34")).toBeInTheDocument();
    expect(screen.getByText(/41\.4321, -112\.7042/)).toBeInTheDocument();
  });
});
