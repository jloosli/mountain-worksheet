import { render, screen, fireEvent, act } from "@testing-library/react";
import PositionInput from "./PositionInput";
import { getAirportInfo, getNavaidInfo } from "@/utils/aviationWeatherApi";
import { magneticVariation } from "@/utils/magvar";

jest.mock("@/utils/aviationWeatherApi");
jest.mock("@/utils/magvar");

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

describe("PositionInput - async lookup paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (magneticVariation as jest.Mock).mockReturnValue(12); // east declination
  });

  it("shows loading hint then resolved coords for airport-rd", async () => {
    (getAirportInfo as jest.Mock).mockResolvedValueOnce([
      { icaoId: "KOGD", lat: 41.2, lon: -112.01 },
    ]);
    const onChange = jest.fn();
    jest.useFakeTimers();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "KOGD/285/34" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(screen.getByText(/looking up KOGD/)).toBeInTheDocument();

    jest.useRealTimers();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getAirportInfo).toHaveBeenCalledWith(["KOGD"]);
    expect(onChange).toHaveBeenLastCalledWith(
      "KOGD/285/34",
      expect.arrayContaining([expect.any(Number), expect.any(Number)])
    );
    expect(screen.getByText(/\(KOGD\/285\/34\)/)).toBeInTheDocument();
  });

  it("calls getNavaidInfo for 3-letter station ids", async () => {
    (getNavaidInfo as jest.Mock).mockResolvedValueOnce([
      { id: "OGD", lat: 41.5, lon: -112.76 },
    ]);
    const onChange = jest.fn();
    jest.useFakeTimers();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "OGD/285/34" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    jest.useRealTimers();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getNavaidInfo).toHaveBeenCalledWith(["OGD"]);
  });

  it("shows error hint when lookup fails", async () => {
    (getAirportInfo as jest.Mock).mockRejectedValueOnce(new Error("not found"));
    const onChange = jest.fn();
    jest.useFakeTimers();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "KZZZ/285/34" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    jest.useRealTimers();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Could not find KZZZ/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith("KZZZ/285/34", [null, null]);
  });

  it("ignores stale lookup results when input changes mid-flight (race protection)", async () => {
    // PAMC is uncached (KOGD is cached by the prior test); we need both
    // stations to actually trigger a network fetch so the slow-promise
    // mock is consumed and the race is real.
    let resolveFirst: (v: unknown) => void = () => {};
    (getAirportInfo as jest.Mock)
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; })
      )
      .mockResolvedValueOnce([{ icaoId: "KSLC", lat: 40.79, lon: -111.97 }]);

    const onChange = jest.fn();
    jest.useFakeTimers();
    render(
      <PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "PAMC/285/34" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "KSLC/090/10" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    jest.useRealTimers();
    // Resolve the stale (first) lookup AFTER the second was issued
    resolveFirst([{ icaoId: "PAMC", lat: 62.95, lon: -155.6 }]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Final hint should reference KSLC, not PAMC
    expect(screen.queryByText(/PAMC/)).not.toBeInTheDocument();
    expect(screen.getByText(/KSLC/)).toBeInTheDocument();
  });
});
