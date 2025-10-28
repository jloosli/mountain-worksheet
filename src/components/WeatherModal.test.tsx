/**
 * Unit tests for Weather Modal Components
 */

import "@testing-library/jest-dom";
import WeatherModal, {
  WeatherErrorModal,
  WeatherLoadingModal,
  AirportNotFoundModal,
  type WeatherModalProps,
  type WeatherErrorModalProps,
  type WeatherLoadingModalProps,
  type AirportNotFoundModalProps,
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
    expect(WeatherErrorModal).toBeDefined();
    expect(WeatherLoadingModal).toBeDefined();
    expect(AirportNotFoundModal).toBeDefined();
  });

  it("should have correct prop types", () => {
    const weatherModalProps: WeatherModalProps = {
      isOpen: true,
      onClose: jest.fn(),
      title: "Test",
      children: <div>Test</div>,
    };

    const errorModalProps: WeatherErrorModalProps = {
      isOpen: true,
      onClose: jest.fn(),
      onRetry: jest.fn(),
      error: {
        title: "Error",
        message: "Test error",
        retryable: true,
      },
    };

    const loadingModalProps: WeatherLoadingModalProps = {
      isOpen: true,
      title: "Loading",
      message: "Please wait",
    };

    const airportNotFoundProps: AirportNotFoundModalProps = {
      isOpen: true,
      onClose: jest.fn(),
      airportCode: "KXYZ",
      onRetry: jest.fn(),
    };

    expect(weatherModalProps).toBeDefined();
    expect(errorModalProps).toBeDefined();
    expect(loadingModalProps).toBeDefined();
    expect(airportNotFoundProps).toBeDefined();
  });
});
