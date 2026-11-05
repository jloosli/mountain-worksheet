import { render, screen, fireEvent, waitFor } from "../test-utils/test-utils";
import AppContainer from "./AppContainer";
import { fetchWorksheetWeather } from "@/utils/weatherFetch";

jest.mock("@/utils/weatherFetch");
jest.mock("@/utils/useAirportRunways", () => ({
  useAirportRunways: () => [null, null],
}));

describe("AppContainer", () => {
  it("renders without crashing", () => {
    render(<AppContainer />);
    expect(screen.getByText("Mountain Flying Worksheet")).toBeInTheDocument();
  });

  it("renders the worksheet Stepper above the inputs", () => {
    render(<AppContainer />);
    expect(screen.getByRole("navigation", { name: /worksheet steps/i })).toBeInTheDocument();
  });

  it("wraps Calculations in the step-decision anchor", () => {
    const { container } = render(<AppContainer />);
    const anchor = container.querySelector("#step-decision");
    expect(anchor).not.toBeNull();
  });

  it("renders the slide-over triggers (instructions in header, checklist on action bar)", () => {
    render(<AppContainer />);
    expect(
      screen.getByRole("button", { name: /Open instructions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Checklist/i })
    ).toBeInTheDocument();
  });

  it("renders the sticky ActionBar region", () => {
    render(<AppContainer />);
    // ActionBar always renders a Fetch weather button (disabled in incomplete state)
    expect(
      screen.getByRole("button", { name: /Fetch weather/i })
    ).toBeInTheDocument();
  });
});

describe("AppContainer — print wiring", () => {
  it("renders the Print briefing button", () => {
    render(<AppContainer />);
    expect(
      screen.getByRole("button", { name: /Print briefing/i }),
    ).toBeInTheDocument();
  });

  it("calls window.print when Print briefing is clicked", () => {
    const spy = jest.spyOn(window, "print").mockImplementation(() => {});
    render(<AppContainer />);
    fireEvent.click(screen.getByRole("button", { name: /Print briefing/i }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders the PrintBriefing region in the tree", () => {
    render(<AppContainer />);
    expect(
      screen.getByRole("region", { name: /Print briefing/i }),
    ).toBeInTheDocument();
  });
});

describe("AppContainer — notifications (#221)", () => {
  const mockFetch = fetchWorksheetWeather as jest.MockedFunction<
    typeof fetchWorksheetWeather
  >;

  const enterAirports = () => {
    fireEvent.change(screen.getByLabelText("Departure Airport"), {
      target: { value: "KORD" },
    });
    fireEvent.change(screen.getByLabelText("Arrival Airport"), {
      target: { value: "BOI" },
    });
  };

  beforeEach(() => {
    mockFetch.mockImplementation(async (worksheet) => ({
      data: { temp: [21, null, null] },
      result: {
        fetchedFor: {
          airport: [worksheet.airport[0], worksheet.airport[1]],
          date: worksheet.date,
          time: worksheet.time,
        },
        applied: { temp: [21, null, null] },
        notifications: [
          {
            level: "warning",
            subject: { kind: "field", field: "temp", index: 2 },
            message: "BOI: no METAR or TAF data available",
          },
        ],
      },
    }));
  });

  const arrivalTemperature = () => screen.getAllByLabelText("Temperature")[2];

  it("shows a fetch Warning inline, marks the step, and clears it when the pilot enters a value", async () => {
    const { container } = render(<AppContainer />);
    enterAirports();
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));

    expect(
      await screen.findByText(/BOI: no METAR or TAF data available/)
    ).toBeInTheDocument();
    expect(arrivalTemperature()).toHaveAttribute("aria-invalid", "true");
    expect(container.querySelector("#step-weather header")).toHaveTextContent(
      "1 warning"
    );
    expect(
      screen.getByRole("link", { name: /Weather.*1 warning/ })
    ).toBeInTheDocument();

    fireEvent.change(arrivalTemperature(), { target: { value: "12" } });

    expect(
      screen.queryByText(/BOI: no METAR or TAF data available/)
    ).not.toBeInTheDocument();
    expect(arrivalTemperature()).not.toHaveAttribute("aria-invalid");
    expect(container.querySelector("#step-weather header")).not.toHaveTextContent(
      "warning"
    );
  });

  it("drops the fetch's Warnings when the airport they were about changes", async () => {
    render(<AppContainer />);
    enterAirports();
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));
    await screen.findByText(/BOI: no METAR or TAF data available/);

    fireEvent.change(screen.getByLabelText("Arrival Airport"), {
      target: { value: "KSLC" },
    });

    expect(
      screen.queryByText(/BOI: no METAR or TAF data available/)
    ).not.toBeInTheDocument();
  });

  it("keeps the worksheet usable and shows no modal after a total failure", async () => {
    mockFetch.mockImplementation(async (worksheet) => ({
      data: null,
      result: {
        fetchedFor: {
          airport: [worksheet.airport[0], worksheet.airport[1]],
          date: worksheet.date,
          time: worksheet.time,
        },
        applied: {},
        notifications: [
          {
            level: "warning",
            subject: { kind: "step", step: "weather" },
            message: "Weather fetch failed (boom)",
          },
        ],
      },
    }));
    const { container } = render(<AppContainer />);
    enterAirports();
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));

    const message = await screen.findByText(/Weather fetch failed \(boom\)/);
    expect(container.querySelector("#step-weather")).toContainElement(message);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    // Other steps and actions remain available.
    expect(screen.getByRole("button", { name: /Fetch weather/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Print briefing/i })).toBeEnabled();
    fireEvent.change(arrivalTemperature(), { target: { value: "12" } });
    expect(arrivalTemperature()).toHaveValue(12);
  });
});
