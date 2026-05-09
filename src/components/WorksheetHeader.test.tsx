import { render, screen } from "../test-utils/test-utils";
import WorksheetHeader from "./WorksheetHeader";

jest.mock("./WeatherDataIntegration", () => ({
  __esModule: true,
  default: () => null,
}));

const defaultProps = {
  onReset: jest.fn(),
  onShare: jest.fn(),
  worksheetData: {},
  onWeatherDataUpdate: jest.fn(),
  onWeatherTimestampUpdate: jest.fn(),
  useFahrenheit: false,
  onToggleTempUnit: jest.fn(),
};

describe("WorksheetHeader", () => {
  it('renders "Current Time" instead of "Current UTC"', () => {
    render(<WorksheetHeader {...defaultProps} />);

    expect(screen.getByText("Current Time")).toBeInTheDocument();
    expect(screen.queryByText("Current UTC")).not.toBeInTheDocument();
  });

  it("header inner container uses max-w-5xl consistent with main content width", () => {
    render(<WorksheetHeader {...defaultProps} />);

    const banner = screen.getByRole("banner");
    expect(banner.querySelector(".max-w-6xl")).not.toBeInTheDocument();
    expect(banner.querySelector(".max-w-5xl")).toBeInTheDocument();
  });
});
