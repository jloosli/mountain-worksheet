import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeatherDataIntegration from "./WeatherDataIntegration";
import { fetchWorksheetWeather } from "@/utils/weatherFetch";
import type { WeatherFetchResult } from "@/utils/notifications";
import type { WorksheetData } from "@/utils/types";

jest.mock("@/utils/weatherFetch");

const mockFetch = fetchWorksheetWeather as jest.MockedFunction<typeof fetchWorksheetWeather>;

const worksheetData = {
  airport: ["KORD", "KLAX"],
  date: "2024-01-15",
  time: "12:00",
} as WorksheetData;

const fetchResult: WeatherFetchResult = {
  fetchedFor: {
    airport: ["KORD", "KLAX"],
    date: "2024-01-15",
    time: "12:00",
    duration: null,
    position: [null, null],
  },
  applied: { temp: [20, null, null] },
  notifications: [
    {
      level: "warning",
      subject: { kind: "field", field: "temp", index: 2 },
      message: "KLAX: no METAR or TAF",
    },
  ],
};

const renderWith = (
  props: Partial<React.ComponentProps<typeof WeatherDataIntegration>> = {}
) =>
  render(
    <WeatherDataIntegration
      worksheetData={worksheetData}
      canFetch
      onFetched={jest.fn()}
      renderButton={({ onClick, disabled }) => (
        <button type="button" onClick={onClick} disabled={disabled}>
          Fetch
        </button>
      )}
      {...props}
    />
  );

describe("WeatherDataIntegration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports a fetch as one event with what it applies, its result and when it arrived", async () => {
    mockFetch.mockResolvedValue({ data: { temp: [20, null, null] }, result: fetchResult });
    const onFetched = jest.fn();
    renderWith({ onFetched });

    fireEvent.click(screen.getByText("Fetch"));

    await waitFor(() =>
      expect(onFetched).toHaveBeenCalledWith({
        type: "fetchApplied",
        data: { temp: [20, null, null] },
        result: fetchResult,
        at: expect.any(Date),
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(worksheetData);
  });

  it("reports a total failure with nothing to apply, and shows no dialog of its own", async () => {
    const failed: WeatherFetchResult = {
      ...fetchResult,
      applied: {},
      notifications: [
        { level: "warning", subject: { kind: "step", step: "weather" }, message: "Weather fetch failed (boom)" },
      ],
    };
    mockFetch.mockResolvedValue({ data: null, result: failed });
    const onFetched = jest.fn();
    renderWith({ onFetched });

    fireEvent.click(screen.getByText("Fetch"));

    await waitFor(() =>
      expect(onFetched).toHaveBeenCalledWith(expect.objectContaining({ data: null, result: failed }))
    );
    // Only the loading indicator was ever a dialog, and it closes.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText(/fetch failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/KLAX: no METAR or TAF/)).not.toBeInTheDocument();
  });

  it("disables the button and doesn't fetch when the worksheet can't be fetched for", () => {
    renderWith({ canFetch: false });
    const button = screen.getByText("Fetch");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
