import { render, screen } from "@testing-library/react";
import AppWrapper from "../AppWrapper";

let shouldSuspend = false;

jest.mock("../AppContainer", () => {
  return function MockAppContainer() {
    if (shouldSuspend) {
      throw new Promise(() => {});
    }
    return <div data-testid="app-container">App Container Content</div>;
  };
});

describe("AppWrapper", () => {
  beforeEach(() => {
    shouldSuspend = false;
  });

  it("should show loading state initially", () => {
    shouldSuspend = true;
    render(<AppWrapper />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should render AppContainer after loading", async () => {
    render(<AppWrapper />);
    const appContainer = await screen.findByTestId("app-container");
    expect(appContainer).toBeInTheDocument();
    expect(appContainer).toHaveTextContent("App Container Content");
  });
});
