import { render, screen } from "../test-utils/test-utils";
import WorksheetHeader from "./WorksheetHeader";

jest.mock("./WeatherDataIntegration", () => ({
  __esModule: true,
  default: () => null,
}));

describe("WorksheetHeader", () => {
  it('renders "Current Time" instead of "Current UTC"', () => {
    render(
      <WorksheetHeader
        onReset={jest.fn()}
        onShare={jest.fn()}
        worksheetData={{}}
        onWeatherDataUpdate={jest.fn()}
        onWeatherTimestampUpdate={jest.fn()}
      />
    );

    expect(screen.getByText("Current Time")).toBeInTheDocument();
    expect(screen.queryByText("Current UTC")).not.toBeInTheDocument();
  });

  it("header inner container uses max-w-5xl consistent with main content width", () => {
    const { container } = render(
      <WorksheetHeader
        onReset={jest.fn()}
        onShare={jest.fn()}
        worksheetData={{}}
        onWeatherDataUpdate={jest.fn()}
        onWeatherTimestampUpdate={jest.fn()}
      />
    );

    expect(container.querySelector(".max-w-6xl")).not.toBeInTheDocument();
    expect(container.querySelector(".max-w-5xl")).toBeInTheDocument();
  });
});
