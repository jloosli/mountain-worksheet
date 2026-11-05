/**
 * Unit tests for Weather Modal Components
 */

import "@testing-library/jest-dom";
import * as WeatherModalModule from "./WeatherModal";
import WeatherModal, {
  WeatherLoadingModal,
  type WeatherModalProps,
  type WeatherLoadingModalProps,
} from "./WeatherModal";

// Mock Headless UI components for testing
jest.mock("@headlessui/react", () => ({
  Dialog: ({ children, show }: { children: React.ReactNode; show: boolean }) =>
    show ? <div data-testid="modal">{children}</div> : null,
  Transition: {
    Root: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Child: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  },
}));

describe("WeatherModal Components", () => {
  it("should export all modal components", () => {
    expect(WeatherModal).toBeDefined();
    expect(WeatherLoadingModal).toBeDefined();
  });

  it("no longer offers blocking modals for data problems (ADR 0001)", () => {
    expect(WeatherModalModule).not.toHaveProperty("WeatherErrorModal");
    expect(WeatherModalModule).not.toHaveProperty("AirportNotFoundModal");
  });

  it("should have correct prop types", () => {
    const weatherModalProps: WeatherModalProps = {
      isOpen: true,
      onClose: jest.fn(),
      title: "Test",
      children: <div>Test</div>,
    };

    const loadingModalProps: WeatherLoadingModalProps = {
      isOpen: true,
      title: "Loading",
      message: "Please wait",
    };

    expect(weatherModalProps).toBeDefined();
    expect(loadingModalProps).toBeDefined();
  });
});
