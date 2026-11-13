/**
 * A Non-reporting departure airport (#226), through the real weather fetch
 * with only the network mocked: its altimeter comes from a Substitute
 * station with a Caution that marks the values computed from it, and its
 * temperature from the field's model forecast.
 */
import { render, screen, fireEvent, within } from "../test-utils/test-utils";
import AppContainer from "./AppContainer";
import { useSearchParams } from "next/navigation";
import { useAirportRunwayLookup } from "@/utils/useAirportRunways";
import { getWeatherDataBatch, getWeatherInBox } from "@/utils/aviationWeatherApi";
import { fetchFieldForecast, fetchPointForecast } from "@/utils/openMeteoApi";
import { fetchGAirmets } from "@/utils/gairmetApi";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "",
  useSearchParams: jest.fn(),
}));
jest.mock("@/utils/useAirportRunways", () => ({ useAirportRunwayLookup: jest.fn() }));
jest.mock("@/utils/aviationWeatherApi", () => ({
  ...jest.requireActual("@/utils/aviationWeatherApi"),
  getWeatherDataBatch: jest.fn(),
  getWeatherInBox: jest.fn(),
}));
jest.mock("@/utils/openMeteoApi", () => ({
  ...jest.requireActual("@/utils/openMeteoApi"),
  fetchPointForecast: jest.fn(),
  fetchFieldForecast: jest.fn(),
}));
jest.mock("@/utils/gairmetApi", () => ({
  ...jest.requireActual("@/utils/gairmetApi"),
  fetchGAirmets: jest.fn(),
}));

const onScreen = () => within(screen.getByRole("main"));

const kxnrAirport = {
  icaoId: "KXNR",
  lat: 44,
  lon: -115,
  elev: 1500,
  runway: [{ id: "16/34", length: 4200, alignment: 160 }],
};
const kogdAirport = {
  icaoId: "KOGD",
  lat: 41.2,
  lon: -112.01,
  elev: 1362,
  runway: [{ id: "03/21", length: 8103, alignment: 30 }],
};
const kogdMetar = {
  icaoId: "KOGD",
  obsTime: "2026-05-12T16:00:00Z",
  temp: 15,
  altim: 1013.2,
};
// ~16 nm NE of KXNR; 1016.9 hPa is 30.03 inHg.
const kneaMetar = {
  icaoId: "KNEA",
  lat: 44.2,
  lon: -114.75,
  obsTime: "2026-05-12T16:00:00Z",
  temp: 12,
  altim: 1016.9,
};

beforeEach(() => {
  (useAirportRunwayLookup as jest.Mock).mockReturnValue({
    runways: [null, null],
    status: ["idle", "idle"],
    notifications: [],
  });
  (useSearchParams as jest.Mock).mockReturnValue(
    new URLSearchParams("acType=T182T&weight=3000&airport=KXNR,KOGD&date=2026-05-12&time=16:00"),
  );
  (getWeatherDataBatch as jest.Mock).mockImplementation(async (ids: string[]) => ({
    metar: ids.includes("KOGD") ? [kogdMetar] : [],
    taf: [],
    airport: [kxnrAirport, kogdAirport].filter((a) => ids.includes(a.icaoId)),
    notifications: [],
  }));
  (getWeatherInBox as jest.Mock).mockResolvedValue({ metar: [kneaMetar], taf: [] });
  (fetchFieldForecast as jest.Mock).mockResolvedValue({
    hourly: { time: ["2026-05-12T16:00"], temperature_2m: [8.4] },
  });
  (fetchPointForecast as jest.Mock).mockRejectedValue(new Error("not needed"));
  (fetchGAirmets as jest.Mock).mockResolvedValue([]);
});

describe("AppContainer — Non-reporting airport (#226)", () => {
  it("fills the departure weather and marks pressure altitude with the Substitute station's Caution", async () => {
    const { container } = render(<AppContainer />);
    fireEvent.click(screen.getByRole("button", { name: /Fetch weather/i }));

    const caution = /KXNR: altimeter from Substitute station KNEA, 16 nm NE/;
    await onScreen().findByText(caution);
    expect(onScreen().getAllByLabelText("Temperature")[0]).toHaveValue(8);
    expect(onScreen().getAllByLabelText(/Altimeter/)[0]).toHaveValue(30.03);
    expect(
      onScreen().getByText(/KXNR doesn't report weather; altimeter from Substitute station/),
    ).toBeInTheDocument();

    const pressureAltitude = Array.from(container.querySelectorAll("tr")).find(
      (tr) => tr.querySelector("td")?.textContent?.trim() === "Pressure Altitude (feet)",
    )!;
    const departureCell = pressureAltitude.querySelectorAll("td")[1];
    expect(departureCell.querySelector('a[data-marker="caution"]')).toHaveAttribute(
      "href",
      "#notifications-field-altimeter-0",
    );

    const briefing = screen.getByLabelText("Print briefing");
    expect(within(briefing).getAllByText(caution).length).toBeGreaterThan(0);
  });
});
