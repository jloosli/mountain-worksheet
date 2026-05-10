import { render, screen, within } from "../test-utils/test-utils";
import InstructionsAndNotes from "./InstructionsAndNotes";

describe("InstructionsAndNotes", () => {
  it("renders a collapsible summary titled 'Instructions and Notes'", () => {
    render(<InstructionsAndNotes />);
    const summary = screen.getByText("Instructions and Notes");
    expect(summary).toBeInTheDocument();
    expect(summary.tagName).toBe("SUMMARY");
  });

  it("links to AviationWeather.gov", () => {
    render(<InstructionsAndNotes />);
    const link = screen.getByRole("link", { name: /aviationweather\.gov/i });
    expect(link).toHaveAttribute("href", "https://aviationweather.gov/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("documents departure/arrival airports use 4-letter ICAO codes", () => {
    render(<InstructionsAndNotes />);
    expect(
      screen.getByText(/Enter the 4-letter ICAO code/i)
    ).toBeInTheDocument();
  });

  it("includes a table of supported Area-of-Operations formats with examples", () => {
    render(<InstructionsAndNotes />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("36.01N/75.50W")).toBeInTheDocument();
    expect(within(table).getByText("360051N/0753004W")).toBeInTheDocument();
    expect(within(table).getByText("3600.86N/07530.07W")).toBeInTheDocument();
    expect(within(table).getByText("KOGD/285/34")).toBeInTheDocument();
    expect(within(table).getByText("OGD/285/34")).toBeInTheDocument();
  });

  it("calls out the tool-is-for-reference disclaimer", () => {
    render(<InstructionsAndNotes />);
    expect(
      screen.getByText(/This tool is for reference purposes only\./i)
    ).toBeInTheDocument();
  });

  it("mentions key operational notes", () => {
    render(<InstructionsAndNotes />);
    expect(screen.getByText(/CAPF 70-5/i)).toBeInTheDocument();
    expect(screen.getByText(/CAPF 70-91/i)).toBeInTheDocument();
    expect(screen.getByText(/16,000' altitude limit/i)).toBeInTheDocument();
    expect(screen.getByText(/dry air approximation/i)).toBeInTheDocument();
  });

  it("explains UTC time handling and link sharing for the tool", () => {
    render(<InstructionsAndNotes />);
    expect(screen.getByText(/All times are entered in UTC/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy Link/i)).toBeInTheDocument();
  });

  it("clarifies that the °C/°F preference is local and not part of the share link", () => {
    render(<InstructionsAndNotes />);
    expect(
      screen.getByText(/UI preferences such as the °C\/°F unit are stored locally/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the °C\/°F preference is preserved/i)
    ).toBeInTheDocument();
  });

  it("marks the decorative chevron as aria-hidden", () => {
    const { container } = render(<InstructionsAndNotes />);
    const chevron = container.querySelector('span[aria-hidden="true"]');
    expect(chevron).not.toBeNull();
    expect(chevron).toHaveTextContent("▼");
  });
});
