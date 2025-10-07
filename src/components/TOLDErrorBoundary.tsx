"use client";

import React, { Component, ReactNode } from "react";

interface TOLDErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface TOLDErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * Error boundary component specifically for TOLD calculation failures
 * Provides graceful fallback when TOLD calculations encounter unexpected errors
 */
export default class TOLDErrorBoundary extends Component<
  TOLDErrorBoundaryProps,
  TOLDErrorBoundaryState
> {
  constructor(props: TOLDErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): TOLDErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error("TOLD Error Boundary caught an error:", error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                TOLD Calculation Error
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>
                  An unexpected error occurred while calculating takeoff and
                  landing distances. This may be due to invalid input data or
                  missing aircraft performance information.
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">
                      Technical Details
                    </summary>
                    <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-auto">
                      {this.state.error.message}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                )}
              </div>
              <div className="mt-4">
                <button
                  onClick={this.handleRetry}
                  className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                >
                  Retry Calculation
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
