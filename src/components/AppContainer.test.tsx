import { render, screen, fireEvent, waitFor, within } from "../test-utils/test-utils";
import AppContainer from "./AppContainer";
import { fetchWorksheetWeather } from "@/utils/weatherFetch";
import { useSearchParams } from "next/navigation";
import {
  useAirportRunwayLookup,
  type RunwayLookup,
} from "@/utils/useAirportRunways";

jest.mock("@/utils/weatherFetch");
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "",
  useSearchParams: jest.fn(),
}));
jest.mock("@/utils/useAirportRunways", () => ({
  useAirportRunwayLookup: jest.fn(),
}));

const mockRunwayLookup = useAirportRunwayLookup as jest.MockedFunction<
  typeof useAirportRunwayLookup
>;
const idleLookup: RunwayLookup = {
  runways: [null, null],
  status: ["idle", "idle"],
  notifications: [],
};

const mockSearchParams = useSearchParams as jest.Mock;

/**
 * Queries scoped to the on-screen worksheet. The print-only Briefing is in
 * the DOM too and repeats every Warning and Caution.
 */
const onScreen = () => within(screen.getByRole("main"));

beforeEach(() => {
  mockRunwayLookup.mockReturnValue(idleLookup);
  mockSearchParams.mockReturnValue(new URLSearchParams());
});

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

describe("AppContainer — malformed link (#225)", () => {
  it.each([
    ["a short altimeter list", "altimeter=29.92", /altimeter.*1 value instead of 3/],
    ["a temperature that isn't a list", "temp[a]=1", /temperature.*isn't a list/],
  ])("renders %s and explains it instead of crashing", (_, query, message) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockSearchParams.mockReturnValue(new URLSearchParams(query));
    render(<AppContainer />);
    expect(onScreen().getByText(message)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Print briefing/i })).toBeInTheDocument();
    jest.restoreAllMocks();
  });
});

describe("AppContainer — link Warnings retire for good", () => {
  it("doesn't bring back a link's weight Warning after the pilot replaces and then clears the weight", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("weight=abc"));
    render(<AppContainer />);
    const weight = screen.getByLabelText("Aircraft Takeoff Weight (lbs)");
    expect(onScreen().getByText(/"abc" isn't a number/)).toBeInTheDocument();
    fireEvent.change(weight, { target: { value: "2300" } });
    expect(onScreen().queryByText(/"abc" isn't a number/)).not.toBeInTheDocument();
    fireEvent.change(weight, { target: { value: "" } });
    expect(onScreen().queryByText(/"abc" isn't a number/)).not.toBeInTheDocument();
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
          duration: worksheet.duration,
          position: worksheet.position,
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
      await onScreen().findByText(/BOI: no METAR or TAF data available/)
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
      onScreen().queryByText(/BOI: no METAR or TAF data available/)
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
    await onScreen().findByText(/BOI: no METAR or TAF data available/);

    fireEvent.change(screen.getByLabelText("Arrival Airport"), {
      target: { value: "KSLC" },
    });

    expect(
      onScreen().queryByText(/BOI: no METAR or TAF data available/)
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
          duration: worksheet.duration,
          position: worksheet.position,
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

    const message = await onScreen().findByText(/Weather fetch failed \(boom\)/);
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

describe("AppContainer — rejected entries and weather fetches", () => {
  const mockFetch = fetchWorksheetWeather as jest.MockedFunction<
    typeof fetchWorksheetWeather
  >;

  it("clears a rejected altimeter entry when a fetch fills that field, even with the same value", async () => {
    // The fetch couldn't get the departure altimeter: it writes blank, which
    // is what was stored when the pilot's entry was rejected.
    mockFetch.mockImplementation(async (worksheet) => ({
      data: { altimeter: [null, null, null] },
      result: {
        fetchedFor: {
          airport: [worksheet.airport[0], worksheet.airport[1]],
          date: worksheet.date,
          time: worksheet.time,
          duration: worksheet.duration,
          position: worksheet.position,
        },
        applied: { altimeter: [null, null, null] },
        notifications: [],
      },
    }));
    render(<AppContainer />);
    fireEvent.change(screen.getByLabelText("Departure Airport"), {
      target: { value: "KORD" },
    });
    fireEvent.change(screen.getByLabelText("Arrival Airport"), {
      target: { value: "KBOI" },
    });
    const altimeter = () => screen.getAllByLabelText("Altimeter")[0];
    fireEvent.change(altimeter(), { target: { value: "35.00" } });
    expect(onScreen().getByText(/Altimeter 35.00 is not valid/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));

    await waitFor(() =>
      expect(onScreen().queryByText(/Altimeter 35.00 is not valid/)).not.toBeInTheDocument()
    );
    expect(altimeter()).toHaveValue(null);
  });
});

describe("AppContainer — rejected entry across two fetches", () => {
  const mockFetch = fetchWorksheetWeather as jest.MockedFunction<
    typeof fetchWorksheetWeather
  >;
  const fetchReturning = (altimeter: [number | null, null, null]) =>
    (async (worksheet: Parameters<typeof fetchWorksheetWeather>[0]) => ({
      data: { altimeter },
      result: {
        fetchedFor: {
          airport: [worksheet.airport[0], worksheet.airport[1]] as [string, string],
          date: worksheet.date,
          time: worksheet.time,
          duration: worksheet.duration,
          position: worksheet.position,
        },
        applied: { altimeter },
        notifications: [],
      },
    })) as typeof fetchWorksheetWeather;

  it("doesn't bring a rejection back when a later fetch restores the value it was rejected against", async () => {
    render(<AppContainer />);
    fireEvent.change(screen.getByLabelText("Departure Airport"), {
      target: { value: "KORD" },
    });
    fireEvent.change(screen.getByLabelText("Arrival Airport"), {
      target: { value: "KBOI" },
    });
    const altimeter = () => screen.getAllByLabelText("Altimeter")[0];
    fireEvent.change(altimeter(), { target: { value: "35.00" } });
    expect(onScreen().getByText(/Altimeter 35.00 is not valid/)).toBeInTheDocument();

    mockFetch.mockImplementationOnce(fetchReturning([30.01, null, null]));
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));
    await waitFor(() => expect(altimeter()).toHaveValue(30.01));

    // A partial fetch can't get the altimeter: blank again, as when rejected.
    mockFetch.mockImplementationOnce(fetchReturning([null, null, null]));
    fireEvent.click(screen.getByRole("button", { name: /Re-fetch|Fetch weather/i }));
    await waitFor(() => expect(altimeter()).toHaveValue(null));
    expect(onScreen().queryByText(/Altimeter 35.00 is not valid/)).not.toBeInTheDocument();
  });
});

describe("AppContainer — results from stale fetched weather (#222)", () => {
  const mockFetch = fetchWorksheetWeather as jest.MockedFunction<
    typeof fetchWorksheetWeather
  >;

  it("withholds departure results, including runway remaining, once the departure airport changes", async () => {
    const data = {
      temp: [20, null, null],
      altimeter: [29.92, null, null],
      altitude: [4473, -1, null],
      rwy: [5500, null],
    } as Partial<import("@/utils/types").WorksheetData>;
    mockFetch.mockImplementation(async (worksheet) => ({
      data,
      result: {
        fetchedFor: {
          airport: [worksheet.airport[0], worksheet.airport[1]],
          date: worksheet.date,
          time: worksheet.time,
          duration: worksheet.duration,
          position: worksheet.position,
        },
        applied: data,
        notifications: [],
      },
    }));
    render(<AppContainer />);
    fireEvent.change(screen.getByLabelText("Aircraft Model"), {
      target: { value: "C182T" },
    });
    fireEvent.change(screen.getByLabelText("Aircraft Takeoff Weight (lbs)"), {
      target: { value: "2800" },
    });
    fireEvent.change(screen.getByLabelText("Departure Airport"), {
      target: { value: "KOGD" },
    });
    fireEvent.change(screen.getByLabelText("Arrival Airport"), {
      target: { value: "KLGU" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));
    await waitFor(() =>
      expect(screen.getAllByLabelText("Temperature")[0]).toHaveValue(20)
    );
    expect(onScreen().queryAllByText(/checked \(Warning\)/)).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Departure Airport"), {
      target: { value: "KSLC" },
    });
    const withheld = onScreen().getAllByText(/checked \(Warning\)/);
    expect(withheld.length).toBeGreaterThan(0);
    expect(withheld.map((e) => e.textContent).join(" ")).toMatch(/departure runway length/);
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
      onScreen().getByText(/Weight 3,200 lbs exceeds the C182T maximum gross weight/)
    ).toBeInTheDocument();
    expect(weight).toHaveAttribute("aria-invalid", "true");
    expect(container.querySelector("#step-sortie header")).toHaveTextContent("1 warning");

    fireEvent.change(weight, { target: { value: "2976" } });
    expect(
      onScreen().getByText(/Weight 2,976 lbs is 96% of the C182T maximum gross weight/)
    ).toBeInTheDocument();
    expect(weight).not.toHaveAttribute("aria-invalid");
    expect(container.querySelector("#step-sortie header")).not.toHaveTextContent("warning");
  });
});

describe("AppContainer — runway lookup (#225)", () => {
  it("shows a failed runway lookup as a Warning on the runway and counts it on the weather step", () => {
    mockRunwayLookup.mockReturnValue({
      runways: [null, null],
      status: ["failed", "idle"],
      notifications: [
        {
          level: "warning",
          subject: { kind: "field", field: "rwy", index: 0 },
          message: "Couldn't look up runways for KDEN (network down)",
        },
      ],
    });
    const { container } = render(<AppContainer />);
    expect(
      onScreen().getByText(/Couldn't look up runways for KDEN \(network down\)/)
    ).toBeInTheDocument();
    expect(onScreen().getByText(/Runway lookup failed/)).toBeInTheDocument();
    expect(container.querySelector("#step-weather header")).toHaveTextContent(
      "1 warning"
    );
  });
});

describe("AppContainer — share (#225)", () => {
  const setClipboard = (writeText: jest.Mock) =>
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

  it("confirms a copied link inline without window.alert", async () => {
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    setClipboard(jest.fn().mockResolvedValue(undefined));
    render(<AppContainer />);
    fireEvent.click(screen.getByRole("button", { name: /Copy link/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Link copied/i);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("shows a copy failure with the link to copy by hand", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    setClipboard(jest.fn().mockRejectedValue(new Error("denied")));
    render(<AppContainer />);
    fireEvent.click(screen.getByRole("button", { name: /Copy link/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Couldn't copy the link \(denied\)/);
    expect(screen.getByLabelText(/Worksheet link/i)).toHaveValue(
      window.location.href
    );
    jest.restoreAllMocks();
  });
});

describe("AppContainer — operating temperature re-derivation (#225)", () => {
  const enterAloftTemps = (temps: number[]) => {
    ["3,000", "6,000", "9,000", "12,000", "15,000"].forEach((alt, i) => {
      fireEvent.change(screen.getByLabelText(`Temperature at ${alt} ft`), {
        target: { value: String(temps[i]) },
      });
    });
  };
  const operatingTemperature = () => screen.getAllByLabelText("Temperature")[1];
  const operatingAltitude = () =>
    screen.getByLabelText("Operating Altitude (MSL ft)");

  it("announces a Caution when an altitude change replaces the pilot's operating temperature", () => {
    render(<AppContainer />);
    enterAloftTemps([20, 14, 8, 2, -10]);
    fireEvent.change(operatingTemperature(), { target: { value: "5" } });
    fireEvent.change(operatingAltitude(), { target: { value: "9000" } });

    expect(operatingTemperature()).toHaveValue(8);
    expect(
      onScreen().getByText(/replacing your entry of 5°C/)
    ).toBeInTheDocument();

    fireEvent.change(operatingTemperature(), { target: { value: "5" } });
    expect(onScreen().queryByText(/replacing your entry/)).not.toBeInTheDocument();
  });

  it("announces a Caution when the operating altitude is outside the winds-aloft temperatures", () => {
    render(<AppContainer />);
    enterAloftTemps([20, 14, 8, 2, -10]);
    fireEvent.change(operatingAltitude(), { target: { value: "17000" } });
    expect(
      onScreen().getByText(/17,000 ft is above the winds-aloft temperatures/)
    ).toBeInTheDocument();
  });
});

describe("AppContainer — malformed link values (#225)", () => {
  it("clears a malformed value from a shared link and shows a Warning on its field until the pilot fixes it", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("weight=heavy"));
    const { container } = render(<AppContainer />);
    const weight = screen.getByLabelText(/Aircraft Takeoff Weight/i);
    expect(weight).toHaveValue(null);
    expect(onScreen().getByText(/"heavy" isn't a number/)).toBeInTheDocument();
    expect(container.querySelector("#step-sortie header")).toHaveTextContent(
      "1 warning"
    );

    fireEvent.change(weight, { target: { value: "2300" } });
    expect(onScreen().queryByText(/"heavy" isn't a number/)).not.toBeInTheDocument();
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
          duration: worksheet.duration,
          position: worksheet.position,
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

    const caution = onScreen().getByText(unverified);
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
    expect(onScreen().getByText(unverified)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Re-fetch/i }));

    await waitFor(() =>
      expect(onScreen().queryByText(unverified)).not.toBeInTheDocument()
    );
    expect(
      container.querySelector("#step-weather header")
    ).not.toHaveTextContent("caution");
  });

  it("shows no Caution on a fresh worksheet with no weather values", () => {
    render(<AppContainer />);
    expect(onScreen().queryByText(unverified)).not.toBeInTheDocument();
  });
});

describe("AppContainer — markers from a Substitution (#223)", () => {
  const mockFetch = fetchWorksheetWeather as jest.MockedFunction<
    typeof fetchWorksheetWeather
  >;
  const substitution = "KLGU: forecast period has no temperature; using current observation";

  beforeEach(() => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams(
        "acType=T182T&weight=3000&airport=KOGD,KLGU&altitude=4000,8000,4500" +
          "&altimeter=29.92,29.92,29.92&temp=20,10,15&rwy=4000,6500"
      )
    );
    mockFetch.mockImplementation(async (worksheet) => ({
      data: { temp: [20, 10, 15] },
      result: {
        fetchedFor: {
          airport: [worksheet.airport[0], worksheet.airport[1]],
          date: worksheet.date,
          time: worksheet.time,
          duration: worksheet.duration,
          position: worksheet.position,
        },
        applied: { temp: [20, 10, 15] },
        notifications: [
          { level: "caution", subject: { kind: "field", field: "temp", index: 2 }, message: substitution },
        ],
      },
    }));
  });

  it("marks the arrival landing distance on screen and on the Briefing, linked to the arrival temperature Caution", async () => {
    const { container } = render(<AppContainer />);
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather|Re-fetch/i }));
    await screen.findAllByText(substitution);

    const toldTable = screen.getByRole("table", { name: /take off and landing distances/i });
    const screenLanding = Array.from(toldTable.querySelectorAll("tr"))
      .find((tr) => tr.querySelector("td")?.textContent === "Landing Ground Roll")!
      .querySelectorAll("td");
    const marker = screenLanding[2].querySelector("a[data-marker]");
    expect(marker).toHaveAttribute("href", "#notifications-field-temp-2");
    expect(container.querySelector("#notifications-field-temp-2")).toHaveTextContent(substitution);
    expect(screenLanding[1].querySelector("a[data-marker]")).toBeNull();

    const briefing = screen.getByLabelText("Print briefing");
    const note = Array.from(briefing.querySelectorAll("li[data-ref]")).find((li) =>
      li.textContent?.includes(substitution)
    )!;
    const printedLanding = Array.from(briefing.querySelectorAll("tr"))
      .find((tr) => tr.querySelector("td")?.textContent === "Landing Ground Roll")!
      .querySelectorAll("td");
    expect(printedLanding[2].querySelector(`[data-ref="${note.getAttribute("data-ref")}"]`)).not.toBeNull();
    expect(printedLanding[1].querySelector("[data-ref]")).toBeNull();
  });
});

describe("AppContainer — rejected weather entries", () => {
  it("counts an out-of-range wind entry on the weather step and prints it on the Briefing", () => {
    const { container } = render(<AppContainer />);
    const header = () => container.querySelector("#step-weather header");
    expect(header()).not.toHaveTextContent(/warning/);

    fireEvent.change(onScreen().getByLabelText("Wind direction at 9,000 ft"), {
      target: { value: "400" },
    });

    const message = /Wind direction 400 at 9,000 ft is not valid/;
    expect(onScreen().getByText(message)).toBeInTheDocument();
    expect(header()).toHaveTextContent("1 warning");
    expect(container.querySelector("#step-weather .bg-red-600")).not.toBeNull();
    expect(
      within(screen.getByLabelText("Print briefing")).getByText(message)
    ).toBeInTheDocument();
  });
});

describe("AppContainer — weather fetched for other inputs", () => {
  const mockFetch = fetchWorksheetWeather as jest.MockedFunction<
    typeof fetchWorksheetWeather
  >;
  const fetched = {
    temp: [21, null, 15] as [number | null, number | null, number | null],
    altimeter: [30.01, null, 29.95] as [number | null, number | null, number | null],
  };

  beforeEach(() => {
    mockFetch.mockImplementation(async (worksheet) => ({
      data: fetched,
      result: {
        fetchedFor: {
          airport: [worksheet.airport[0], worksheet.airport[1]],
          date: worksheet.date,
          time: worksheet.time,
          duration: worksheet.duration,
          position: worksheet.position,
        },
        applied: fetched,
        notifications: [],
      },
    }));
  });

  const stale = /Fetched for BOI at .*; refetch weather/;
  const arrivalTemperature = () => onScreen().getAllByLabelText("Temperature")[2];
  const departureTemperature = () => onScreen().getAllByLabelText("Temperature")[0];
  const weatherHeader = (container: HTMLElement) =>
    container.querySelector("#step-weather header");

  async function fetchThenChangeArrival() {
    const utils = render(<AppContainer />);
    fireEvent.change(screen.getByLabelText("Departure Airport"), { target: { value: "KORD" } });
    fireEvent.change(screen.getByLabelText("Arrival Airport"), { target: { value: "BOI" } });
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));
    await waitFor(() => expect(arrivalTemperature()).toHaveValue(15));
    fireEvent.change(screen.getByLabelText("Arrival Airport"), { target: { value: "KSLC" } });
    return utils;
  }

  it("warns on the arrival weather fields, counts on the step and prints on the Briefing", async () => {
    const { container } = await fetchThenChangeArrival();
    expect(onScreen().getAllByText(stale)).toHaveLength(2); // temperature + altimeter
    expect(arrivalTemperature()).toHaveAttribute("aria-invalid", "true");
    expect(arrivalTemperature()).toHaveValue(15); // data kept
    expect(departureTemperature()).not.toHaveAttribute("aria-invalid");
    expect(weatherHeader(container)).toHaveTextContent("2 warnings");
    expect(
      within(screen.getByLabelText("Print briefing")).getAllByText(stale).length
    ).toBeGreaterThan(0);
  });

  it("clears once the pilot enters their own value", async () => {
    const { container } = await fetchThenChangeArrival();
    fireEvent.change(arrivalTemperature(), { target: { value: "12" } });
    expect(arrivalTemperature()).not.toHaveAttribute("aria-invalid");
    expect(weatherHeader(container)).toHaveTextContent("1 warning");
  });

  it("clears on a refetch", async () => {
    const { container } = await fetchThenChangeArrival();
    fireEvent.click(screen.getByRole("button", { name: /Re-fetch|Fetch weather/i }));
    await waitFor(() => expect(onScreen().queryByText(stale)).not.toBeInTheDocument());
    expect(weatherHeader(container)).not.toHaveTextContent("warning");
  });
});
