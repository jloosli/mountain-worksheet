import { render } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import GlobalError from "./global-error";

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

jest.mock("next/error", () => ({
  __esModule: true,
  default: () => <div>Something went wrong</div>,
}));

describe("GlobalError", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports the error to Sentry", () => {
    const error = new Error("boom");
    render(<GlobalError error={error} />);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
