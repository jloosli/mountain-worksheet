import { renderHook, act } from "@testing-library/react";
import { useUrlReducer } from "../useUrlReducer";

type Update<T> = T | ((prev: T) => T);
interface Opened<T, R> {
  value: T;
  check: R | null;
}
const setValue = <T, R>(s: Opened<T, R>, update: Update<T>): Opened<T, R> => ({
  ...s,
  value: typeof update === "function" ? (update as (prev: T) => T)(s.value) : update,
});
const opened = <T, R>(value: T, check: R | null): Opened<T, R> => ({ value, check });
const valueOf = <T, R>(s: Opened<T, R>): T => s.value;

/** A plain value persisted to the URL: [value, set, check result]. */
function useUrlValue<T, R extends { state: T } = { state: T }>(
  initialState: T,
  check?: (state: T, query: string) => R
) {
  const [s, dispatch] = useUrlReducer<Opened<T, R>, Update<T>, T, R>(
    setValue,
    initialState,
    opened,
    valueOf,
    check
  );
  return [s.value, dispatch, s.check] as const;
}
import * as nextNavigation from "next/navigation";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

describe("useUrlReducer", () => {
  // Setup common mocks
  const mockRouter = { push: jest.fn() };
  const mockPathname = "/test";
  let mockSearchParams: URLSearchParams;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();

    // Setup default mock implementations
    (nextNavigation.useRouter as jest.Mock).mockReturnValue(mockRouter);
    (nextNavigation.usePathname as jest.Mock).mockReturnValue(mockPathname);
    (nextNavigation.useSearchParams as jest.Mock).mockReturnValue(
      mockSearchParams
    );
  });

  it("should initialize with default state when no URL params exist", () => {
    const initialState = { count: 0, name: "test" };

    const { result } = renderHook(() => useUrlValue(initialState));

    expect(result.current[0]).toEqual(initialState);
  });

  it("should initialize with URL params when they exist", () => {
    const initialState = { count: 0, name: "" };
    mockSearchParams = new URLSearchParams("count=42&name=John");
    (nextNavigation.useSearchParams as jest.Mock).mockReturnValue(
      mockSearchParams
    );

    const { result } = renderHook(() => useUrlValue(initialState));

    expect(result.current[0]).toEqual({
      count: 42,
      name: "John",
    });
  });

  it("should update state and URL when setState is called", () => {
    const initialState = { count: 0, name: "test" };
    const { result } = renderHook(() => useUrlValue(initialState));

    act(() => {
      result.current[1]({ count: 42, name: "updated" });
      // Simulate focus event to trigger URL update
      document.dispatchEvent(new Event("focusin"));
    });

    expect(result.current[0]).toEqual({
      count: 42,
      name: "updated",
    });
    expect(mockRouter.push).toHaveBeenCalledWith(
      "/test?count=42&name=updated",
      { scroll: false }
    );
  });

  it("should support functional updates", () => {
    const initialState = { count: 0, name: "test" };
    const { result } = renderHook(() => useUrlValue(initialState));

    act(() => {
      result.current[1]((prev) => ({
        ...prev,
        count: prev.count + 1,
      }));
    });

    expect(result.current[0]).toEqual({
      count: 1,
      name: "test",
    });
  });

  it("should not include empty query string when state is empty", () => {
    const initialState = { value: "" };
    const { result } = renderHook(() => useUrlValue(initialState));

    act(() => {
      result.current[1]({ value: "" });
      document.dispatchEvent(new Event("focusin"));
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/test", { scroll: false });
  });

  it("should update URL on focus/blur events", async () => {
    const initialState = { count: 0 };
    const { result } = renderHook(() => useUrlValue(initialState));

    // Update state
    act(() => {
      result.current[1]({ count: 42 });
    });

    // First verify state was updated
    expect(result.current[0]).toEqual({ count: 42 });

    // Simulate focus event
    act(() => {
      result.current[1]({ count: 42 });
      document.dispatchEvent(new Event("focusin"));
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/test?count=42", {
      scroll: false,
    });

    // Clear mock calls
    mockRouter.push.mockClear();

    // Simulate another state update and blur
    act(() => {
      result.current[1]({ count: 43 });
      document.dispatchEvent(new Event("focusout"));
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/test?count=43", {
      scroll: false,
    });
  });

  it("should cleanup focus/blur event listeners on unmount", () => {
    const removeEventListenerSpy = jest.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useUrlValue({ count: 0 }));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "focusin",
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "focusout",
      expect.any(Function)
    );
  });

  it("should handle complex state with arrays", () => {
    const initialState = {
      numbers: [1, 2, 3],
      nested: [
        [0, 0],
        [0, 0],
      ],
    };
    const { result } = renderHook(() => useUrlValue(initialState));

    act(() => {
      result.current[1]({
        numbers: [4, 5, 6],
        nested: [
          [1, 2],
          [3, 4],
        ],
      });
      document.dispatchEvent(new Event("focusin"));
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      "/test?numbers=4,5,6&nested=1,2||3,4",
      { scroll: false }
    );
  });

  it("runs a load check over the state opened from the link and returns its result", () => {
    const initialState = { count: 0 };
    (nextNavigation.useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams("count=abc")
    );
    const check = jest.fn((state: { count: unknown }, query: string) => ({
      state: { count: 0 },
      problem: `${query} -> ${String(state.count)}`,
    }));

    const { result } = renderHook(() => useUrlValue(initialState, check));

    expect(result.current[0]).toEqual({ count: 0 });
    expect(result.current[2]).toEqual({
      state: { count: 0 },
      problem: "count=abc -> NaN",
    });
  });

  describe("with its own reducer state", () => {
    interface Counter {
      value: { count: number };
      events: number;
    }
    const reducer = (s: Counter, by: number): Counter => ({
      value: { count: s.value.count + by },
      events: s.events + 1,
    });
    const init = (value: { count: number }): Counter => ({ value, events: 0 });
    const toUrl = (s: Counter) => s.value;

    it("applies events dispatched before a render to the latest state, and writes only the URL value", () => {
      (nextNavigation.useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams("count=2")
      );
      const { result } = renderHook(() =>
        useUrlReducer(reducer, { count: 0 }, init, toUrl)
      );
      expect(result.current[0]).toEqual({ value: { count: 2 }, events: 0 });

      act(() => {
        result.current[1](1);
        result.current[1](10);
        document.dispatchEvent(new Event("focusin"));
      });

      expect(result.current[0]).toEqual({ value: { count: 13 }, events: 2 });
      expect(mockRouter.push).toHaveBeenCalledWith("/test?count=13", { scroll: false });
    });
  });
});
