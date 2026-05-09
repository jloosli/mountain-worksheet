import { render, screen, fireEvent } from "@testing-library/react";
import SortieInfo from "./SortieInfo";
import type { WorksheetData } from "@/utils/types";

const defaultInitialData: WorksheetData = {
  pilot: "",
  date: "",
  time: "",
  acType: "",
  tailN: "",
  airport: ["", ""],
  route: "",
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
});
