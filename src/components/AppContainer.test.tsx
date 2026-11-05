import { render, screen, fireEvent, waitFor } from "../test-utils/test-utils";
import AppContainer from "./AppContainer";
import { fetchWorksheetWeather } from "@/utils/weatherFetch";
import { useSearchParams } from "next/navigation";

jest.mock("@/utils/weatherFetch");
// Same as jest.setup.ts, but with a controllable query string so a test can
// open the worksheet from a shared link.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: () => "",
}));
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

describe("AppContainer — performance notifications (#222)", () => {
  it("shows a weight Warning at the weight input, marks Sortie Details, and clears when fixed", () => {
    const { container } = render(<AppContainer />);
    fireEvent.change(screen.getByLabelText("Aircraft Model"), {
      target: { value: "C182T" },
    });
    const weight = screen.getByLabelText("Aircraft Takeoff Weight (lbs)");
    fireEvent.change(weight, { target: { value: "3200" } });

    expect(
      screen.getByText(/Weight 3,200 lbs exceeds the C182T maximum gross weight/)
    ).toBeInTheDocument();
    expect(weight).toHaveAttribute("aria-invalid", "true");
    expect(container.querySelector("#step-sortie header")).toHaveTextContent("1 warning");

    fireEvent.change(weight, { target: { value: "2976" } });
    expect(
      screen.getByText(/Weight 2,976 lbs is 96% of the C182T maximum gross weight/)
    ).toBeInTheDocument();
    expect(weight).not.toHaveAttribute("aria-invalid");
    expect(container.querySelector("#step-sortie header")).not.toHaveTextContent("warning");
  });
});

describe("AppContainer — unverified weather (#224)", () => {
  const mockFetch = fetchWorksheetWeather as jest.MockedFunction<
    typeof fetchWorksheetWeather
  >;
  const unverified = /came from a shared link/i;

  const mockSearchParams = useSearchParams as jest.MockedFunction<
    typeof useSearchParams
  >;
  const openSharedLink = (query: string) =>
    mockSearchParams.mockReturnValue(
      new URLSearchParams(query) as unknown as ReturnType<typeof useSearchParams>
    );

  beforeEach(() => {
    mockFetch.mockImplementation(async (worksheet) => ({
      data: { temp: [18, null, null] },
      result: {
        fetchedFor: {
          airport: [worksheet.airport[0], worksheet.airport[1]],
          date: worksheet.date,
          time: worksheet.time,
        },
        applied: { temp: [18, null, null] },
        notifications: [],
      },
    }));
  });

  afterEach(() =>
    mockSearchParams.mockImplementation(
      () => new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>
    )
  );

  it("shows a Caution on the weather step when a shared link carries weather values", () => {
    openSharedLink("airport=KORD,KBOI&temp=21,,");
    const { container } = render(<AppContainer />);

    const caution = screen.getByText(unverified);
    expect(container.querySelector("#step-weather")).toContainElement(caution);
    expect(container.querySelector("#step-weather header")).toHaveTextContent(
      "1 caution"
    );
    // A Caution never blocks: fetching stays available.
    expect(screen.getByRole("button", { name: /Re-fetch/i })).toBeEnabled();
  });

  it("removes the Caution after weather is fetched this session", async () => {
    openSharedLink("airport=KORD,KBOI&temp=21,,");
    const { container } = render(<AppContainer />);
    expect(screen.getByText(unverified)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Re-fetch/i }));

    await waitFor(() =>
      expect(screen.queryByText(unverified)).not.toBeInTheDocument()
    );
    expect(
      container.querySelector("#step-weather header")
    ).not.toHaveTextContent("caution");
  });

  it("shows no Caution on a fresh worksheet with no weather values", () => {
    render(<AppContainer />);
    expect(screen.queryByText(unverified)).not.toBeInTheDocument();
  });
});
