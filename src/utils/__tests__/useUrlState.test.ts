import { renderHook, act } from "@testing-library/react";
import { useUrlState } from "../useUrlState";
import * as nextNavigation from "next/navigation";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

describe("useUrlState", () => {
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

    const { result } = renderHook(() => useUrlState(initialState));

    expect(result.current[0]).toEqual(initialState);
  });

  it("should initialize with URL params when they exist", () => {
    const initialState = { count: 0, name: "" };
    mockSearchParams = new URLSearchParams("count=42&name=John");
    (nextNavigation.useSearchParams as jest.Mock).mockReturnValue(
      mockSearchParams
    );

    const { result } = renderHook(() => useUrlState(initialState));

    expect(result.current[0]).toEqual({
      count: 42,
      name: "John",
    });
  });

  it("should update state and URL when setState is called", () => {
    const initialState = { count: 0, name: "test" };
    const { result } = renderHook(() => useUrlState(initialState));

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
    const { result } = renderHook(() => useUrlState(initialState));

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
    const { result } = renderHook(() => useUrlState(initialState));

    act(() => {
      result.current[1]({ value: "" });
      document.dispatchEvent(new Event("focusin"));
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/test", { scroll: false });
  });

  it("should update URL on focus/blur events", async () => {
    const initialState = { count: 0 };
    const { result } = renderHook(() => useUrlState(initialState));

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
    const { unmount } = renderHook(() => useUrlState({ count: 0 }));

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
    const { result } = renderHook(() => useUrlState(initialState));

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
      "/test?numbers=4%2C5%2C6&nested=1%2C2%2C3%2C4",
      { scroll: false }
    );
  });
});
