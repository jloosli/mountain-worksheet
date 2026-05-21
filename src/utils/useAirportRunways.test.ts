import { act, renderHook, waitFor } from "@testing-library/react";
import { useAirportRunways } from "./useAirportRunways";
import { getAirportInfo } from "./aviationWeatherApi";
import type { AirportResponse } from "./aviationWeatherApi";

jest.mock("./aviationWeatherApi", () => ({
  getAirportInfo: jest.fn(),
}));

const mockedGetAirportInfo = getAirportInfo as jest.MockedFunction<
  typeof getAirportInfo
>;

const fakeAirport = (icaoId: string, runways: Array<{ id: string; length: number; alignment: number | null }>) => ({
  icaoId,
  name: icaoId,
  country: "US",
  lat: 0,
  lon: 0,
  elev: 0,
  priority: 1,
  tz: "UTC",
  runway: runways.map((r) => ({
    id: r.id,
    length: r.length,
    width: 100,
    surface: "ASPH",
    alignment: r.alignment,
    lighted: true,
    closed: false,
  })),
});

describe("useAirportRunways", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedGetAirportInfo.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns [null, null] without calling API when both codes are empty", () => {
    const { result } = renderHook(() => useAirportRunways(["", ""]));
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(mockedGetAirportInfo).not.toHaveBeenCalled();
    expect(result.current).toEqual([null, null]);
  });

  it("fetches both codes once after debounce when both are valid on mount", async () => {
    mockedGetAirportInfo.mockResolvedValue([
      fakeAirport("KDEN", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
      fakeAirport("KSLC", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { result } = renderHook(() => useAirportRunways(["KDEN", "KSLC"]));

    expect(mockedGetAirportInfo).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(1);
    });
    expect(mockedGetAirportInfo).toHaveBeenCalledWith(["KDEN", "KSLC"]);

    await waitFor(() => {
      expect(result.current[0]).not.toBeNull();
    });
    expect(result.current[0]).toEqual([
      { id: "16L/34R", length: 12000, alignment: 160 },
    ]);
    expect(result.current[1]).toEqual([
      { id: "16L/34R", length: 12000, alignment: 160 },
    ]);
  });

  it("debounces rapid changes into a single fetch with the final value", async () => {
    mockedGetAirportInfo.mockResolvedValue([
      fakeAirport("KASE", [{ id: "15/33", length: 8000, alignment: 150 }]),
      fakeAirport("KSLC", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { rerender } = renderHook(
      ({ airports }: { airports: [string, string] }) => useAirportRunways(airports),
      { initialProps: { airports: ["K", ""] as [string, string] } }
    );
    rerender({ airports: ["KA", ""] });
    rerender({ airports: ["KAS", ""] });
    rerender({ airports: ["KASE", "KSLC"] });

    act(() => {
      jest.advanceTimersByTime(399);
    });
    expect(mockedGetAirportInfo).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(1);
    });
    expect(mockedGetAirportInfo).toHaveBeenCalledWith(["KASE", "KSLC"]);
  });

  it("skips invalid dep code but still fetches valid arr code", async () => {
    mockedGetAirportInfo.mockResolvedValue([
      fakeAirport("KSLC", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { result } = renderHook(() => useAirportRunways(["K", "KSLC"]));
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledWith(["KSLC"]);
    });
    await waitFor(() => {
      expect(result.current[1]).not.toBeNull();
    });
    expect(result.current[0]).toBeNull();
  });

  it("dedupes when dep === arr and fans the result to both slots", async () => {
    mockedGetAirportInfo.mockResolvedValue([
      fakeAirport("KDEN", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { result } = renderHook(() => useAirportRunways(["KDEN", "KDEN"]));
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledWith(["KDEN"]);
    });
    await waitFor(() => {
      expect(result.current[0]).not.toBeNull();
    });
    expect(result.current[0]).toEqual(result.current[1]);
  });

  it("returns null for both slots when the API rejects", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockedGetAirportInfo.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useAirportRunways(["KDEN", "KSLC"]));
    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });
    expect(result.current).toEqual([null, null]);
    warnSpy.mockRestore();
  });

  it("ignores a stale response when the codes change mid-flight", async () => {
    let resolveFirst: (v: AirportResponse[] | PromiseLike<AirportResponse[]>) => void = () => {};
    mockedGetAirportInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }) as ReturnType<typeof getAirportInfo>
    );
    mockedGetAirportInfo.mockResolvedValueOnce([
      fakeAirport("KASE", [{ id: "15/33", length: 8000, alignment: 150 }]),
      fakeAirport("KSLC", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
    ]);

    const { result, rerender } = renderHook(
      ({ airports }: { airports: [string, string] }) => useAirportRunways(airports),
      { initialProps: { airports: ["KDEN", "KSLC"] as [string, string] } }
    );

    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(1);
    });

    rerender({ airports: ["KASE", "KSLC"] });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(2);
    });

    // Now resolve the first (stale) request with data for the old codes.
    await act(async () => {
      resolveFirst([
        fakeAirport("KDEN", [{ id: "OLD/OLD", length: 1, alignment: 0 }]),
        fakeAirport("KSLC", [{ id: "OLD/OLD", length: 1, alignment: 0 }]),
      ]);
    });

    await waitFor(() => {
      expect(result.current[0]).not.toBeNull();
    });
    // The fresh response, not the stale one, wins.
    expect(result.current[0]).toEqual([
      { id: "15/33", length: 8000, alignment: 150 },
    ]);
  });

  it("does not setRunways after unmount when fetch resolves late", async () => {
    let resolveLate: (v: AirportResponse[] | PromiseLike<AirportResponse[]>) => void = () => {};
    mockedGetAirportInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLate = resolve;
        }) as ReturnType<typeof getAirportInfo>
    );

    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderHook(() => useAirportRunways(["KDEN", "KSLC"]));

    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Resolve the in-flight request after the hook unmounted.
    await act(async () => {
      resolveLate([
        fakeAirport("KDEN", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
        fakeAirport("KSLC", [{ id: "16L/34R", length: 12000, alignment: 160 }]),
      ]);
    });

    // React would log a "state update on unmounted component" warning via
    // console.error if setRunways ran post-unmount. Assert it stayed quiet.
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("preserves the unchanged slot's runways when only one code changes", async () => {
    const kdenRunways = [{ id: "16L/34R", length: 12000, alignment: 160 }];
    const kslcRunways = [{ id: "16L/34R", length: 12000, alignment: 160 }];
    const kaseRunways = [{ id: "15/33", length: 8000, alignment: 150 }];

    mockedGetAirportInfo.mockResolvedValueOnce([
      fakeAirport("KDEN", kdenRunways),
      fakeAirport("KSLC", kslcRunways),
    ]);

    const { result, rerender } = renderHook(
      ({ airports }: { airports: [string, string] }) => useAirportRunways(airports),
      { initialProps: { airports: ["KDEN", "KSLC"] as [string, string] } }
    );

    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(result.current[0]).toEqual(kdenRunways);
    });
    expect(result.current[1]).toEqual(kslcRunways);

    // Now queue the second response (dep changes to KASE, arr stays KSLC).
    let resolveSecond: (v: AirportResponse[] | PromiseLike<AirportResponse[]>) => void = () => {};
    mockedGetAirportInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }) as ReturnType<typeof getAirportInfo>
    );

    rerender({ airports: ["KASE", "KSLC"] });

    // Debounce window — dep slot should be cleared immediately, arr preserved.
    expect(result.current[0]).toBeNull();
    expect(result.current[1]).toEqual(kslcRunways);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(mockedGetAirportInfo).toHaveBeenCalledTimes(2);
    });

    // Fetch in flight; arr should still be preserved.
    expect(result.current[1]).toEqual(kslcRunways);

    await act(async () => {
      resolveSecond([
        fakeAirport("KASE", kaseRunways),
        fakeAirport("KSLC", kslcRunways),
      ]);
    });

    await waitFor(() => {
      expect(result.current[0]).toEqual(kaseRunways);
    });
    expect(result.current[1]).toEqual(kslcRunways);
  });

  it("masks stale runways at render time before the effect fires", async () => {
    const kdenRunways = [{ id: "16L/34R", length: 12000, alignment: 160 }];
    const kslcRunways = [{ id: "16L/34R", length: 12000, alignment: 160 }];

    mockedGetAirportInfo.mockResolvedValueOnce([
      fakeAirport("KDEN", kdenRunways),
      fakeAirport("KSLC", kslcRunways),
    ]);

    const { result, rerender } = renderHook(
      ({ airports }: { airports: [string, string] }) => useAirportRunways(airports),
      { initialProps: { airports: ["KDEN", "KSLC"] as [string, string] } }
    );

    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(result.current[0]).toEqual(kdenRunways);
    });

    // Hold the second fetch so we can observe the synchronous render result
    // before the effect's fetch can possibly resolve.
    mockedGetAirportInfo.mockImplementationOnce(
      () => new Promise(() => {}) as ReturnType<typeof getAirportInfo>
    );

    // Synchronous: rerender with a different dep code. Without render-time
    // masking, result.current[0] would still hold the KDEN runways for one
    // render until the effect fired.
    rerender({ airports: ["KASE", "KSLC"] });

    expect(result.current[0]).toBeNull();
    expect(result.current[1]).toEqual(kslcRunways);
  });
});
