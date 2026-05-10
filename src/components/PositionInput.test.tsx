import { render, screen, fireEvent, act } from "@testing-library/react";
import PositionInput from "./PositionInput";

describe("PositionInput - synchronous paths", () => {
  it("renders empty input with no hint when value is empty", () => {
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={() => {}} />
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
  });

  it("shows parsed coords beneath input on decimal input", async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "36.01N/75.50W" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(onChange).toHaveBeenCalledWith("36.01N/75.50W", [36.01, -75.5]);
    expect(screen.getByText(/36\.0100, -75\.5000/)).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("shows warning for unrecognized input and calls onChange with null position", async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Cache Valley" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(onChange).toHaveBeenCalledWith("CACHE VALLEY", [null, null]);
    expect(screen.getByText(/Unrecognized format/)).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("renders cached position immediately without re-parsing", () => {
    render(
      <PositionInput
        rawValue="KOGD/285/34"
        cachedPosition={[41.4321, -112.7042]}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("textbox")).toHaveValue("KOGD/285/34");
    expect(screen.getByText(/41\.4321, -112\.7042/)).toBeInTheDocument();
  });
});
