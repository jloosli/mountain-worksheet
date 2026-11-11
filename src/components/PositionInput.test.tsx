import { render, screen, fireEvent, act } from "@testing-library/react";
import PositionInput, { POSITION_FORMATS } from "./PositionInput";
import { getAirportInfo, getNavaidInfo } from "@/utils/aviationWeatherApi";
import { magneticVariation } from "@/utils/magvar";

jest.mock("@/utils/aviationWeatherApi");
jest.mock("@/utils/magvar");

describe("PositionInput - synchronous paths", () => {
  it("renders empty input with no hint when value is empty", () => {
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
  });

  it("shows parsed coords beneath input on decimal input", async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />);
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
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />);
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
      />,
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
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />);
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
      expect.arrayContaining([expect.any(Number), expect.any(Number)]),
    );
    expect(screen.getByText(/Read as airport KOGD, 285° radial, 34 NM → \d/)).toBeInTheDocument();
  });

  it("calls getNavaidInfo for 3-letter station ids", async () => {
    (getNavaidInfo as jest.Mock).mockResolvedValueOnce([{ id: "OGD", lat: 41.5, lon: -112.76 }]);
    const onChange = jest.fn();
    jest.useFakeTimers();
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />);
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
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />);
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
    expect(screen.getByText(/Could not find airport KZZZ/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith("KZZZ/285/34", [null, null]);
  });

  it("ignores stale lookup results when input changes mid-flight (race protection)", async () => {
    // PAMC is uncached (KOGD is cached by the prior test); we need both
    // stations to actually trigger a network fetch so the slow-promise
    // mock is consumed and the race is real.
    let resolveFirst: (v: unknown) => void = () => {};
    (getAirportInfo as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([{ icaoId: "KSLC", lat: 40.79, lon: -111.97 }]);

    const onChange = jest.fn();
    jest.useFakeTimers();
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />);

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

describe("PositionInput - format chips and hints", () => {
  const chip = (label: string) =>
    screen.getByRole("button", { name: new RegExp(`^Use ${label} example`) });
  const activeChips = () =>
    screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-current") === "true")
      .map((b) => b.getAttribute("aria-label"));

  afterEach(() => jest.useRealTimers());

  it("shows a chip with an example for every accepted format", () => {
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={() => {}} />);
    for (const f of POSITION_FORMATS) {
      expect(chip(f.label)).toHaveTextContent(f.example);
    }
    expect(activeChips()).toEqual([]);
  });

  it("fills the field with a chip's example and saves it", () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={onChange} />);
    fireEvent.click(chip("Lat/Long"));
    expect(screen.getByRole("textbox")).toHaveValue("41.43/-112.70");
    expect(screen.getByRole("textbox")).toHaveFocus();
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(onChange).toHaveBeenCalledWith("41.43/-112.70", [41.43, -112.7]);
    expect(activeChips()).toEqual(["Use Lat/Long example 41.43/-112.70"]);
  });

  it("names the recognised format and lights its chip as the user types", () => {
    jest.useFakeTimers();
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "360051N/0753004W" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(
      screen.getByText(/Read as degrees, minutes, seconds → 36\.0142, -75\.5011/),
    ).toBeInTheDocument();
    expect(activeChips()).toEqual([expect.stringMatching(/^Use Deg Min Sec example/)]);
  });

  it("points an unrecognised entry back at the formats and lights no chip", () => {
    jest.useFakeTimers();
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "OGDEN 285 34" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(
      screen.getByText(
        /not used as the operating position \(area weather falls back to the departure–arrival midpoint\)\. Use one of the formats above/,
      ),
    ).toBeInTheDocument();
    expect(activeChips()).toEqual([]);
  });

  it("describes a hydrated radial/distance entry from the link", () => {
    render(
      <PositionInput rawValue="OGD/285/34" cachedPosition={[41.5, -112.76]} onChange={() => {}} />,
    );
    expect(
      screen.getByText("✓ Read as VOR OGD, 285° radial, 34 NM → 41.5000, -112.7600"),
    ).toBeInTheDocument();
    expect(activeChips()).toEqual([expect.stringMatching(/^Use VOR\/Radial\/NM example/)]);
  });

  it("describes the input by the format list as well as its notifications", () => {
    render(
      <PositionInput
        rawValue=""
        cachedPosition={[null, null]}
        onChange={() => {}}
        inputA11yProps={{ "aria-invalid": true, "aria-describedby": "notes-position" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-describedby",
      "notes-position route-hint route-formats",
    );
  });

  it("shows cached coordinates, not a warning, for a free-text route from a link", () => {
    render(
      <PositionInput
        rawValue="CACHE VALLEY"
        cachedPosition={[41.73, -111.83]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("→ 41.7300, -111.8300")).toBeInTheDocument();
    expect(screen.queryByText(/Unrecognized format/)).not.toBeInTheDocument();
    expect(activeChips()).toEqual([]);
  });

  it("announces the hint and includes it in the input's description", () => {
    jest.useFakeTimers();
    render(<PositionInput rawValue="" cachedPosition={[null, null]} onChange={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "41.43/-112.70" } });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    const hint = screen.getByText(/Read as decimal lat\/long/);
    expect(hint).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription(/Read as decimal lat\/long/);
  });
});
