"use client";

import { Fragment, type ReactNode } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";

export interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  type?: "error" | "warning" | "info" | "success";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
}

export default function WeatherModal({
  isOpen,
  onClose,
  title,
  children,
  type = "info",
  showCloseButton = true,
  closeOnOverlayClick = true,
}: WeatherModalProps) {
  const getIcon = () => {
    switch (type) {
      case "error":
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <ExclamationTriangleIcon
              className="h-6 w-6 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
          </div>
        );
      case "warning":
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
            <ExclamationTriangleIcon
              className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
              aria-hidden="true"
            />
          </div>
        );
      case "success":
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <svg
              className="h-6 w-6 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
            <svg
              className="h-6 w-6 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
          </div>
        );
    }
  };

  const getTitleColor = () => {
    switch (type) {
      case "error":
        return "text-red-900 dark:text-red-100";
      case "warning":
        return "text-yellow-900 dark:text-yellow-100";
      case "success":
        return "text-green-900 dark:text-green-100";
      default:
        return "text-gray-900 dark:text-gray-100";
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={closeOnOverlayClick ? onClose : () => {}}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="sm:flex sm:items-start">
                  {getIcon()}
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title
                      as="h3"
                      className={`text-base font-semibold leading-6 ${getTitleColor()}`}
                    >
                      {title}
                    </Dialog.Title>
                    <div className="mt-2">{children}</div>
                  </div>
                </div>
                {showCloseButton && (
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600 dark:hover:bg-gray-600 sm:ml-3 sm:w-auto"
                      onClick={onClose}
                    >
                      Close
                    </button>
                  </div>
                )}
                {showCloseButton && (
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 dark:bg-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
                      onClick={onClose}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

// Specialized modal components for common weather-related scenarios

export interface WeatherErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  error: {
    title: string;
    message: string;
    details?: string;
    retryable?: boolean;
  };
}

export function WeatherErrorModal({
  isOpen,
  onClose,
  onRetry,
  error,
}: WeatherErrorModalProps) {
  return (
    <WeatherModal
      isOpen={isOpen}
      onClose={onClose}
      title={error.title}
      type="error"
      closeOnOverlayClick={false}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {error.message}
        </p>
        {error.details && (
          <details className="text-xs text-gray-500 dark:text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              Technical Details
            </summary>
            <pre className="mt-2 whitespace-pre-wrap bg-gray-50 p-2 rounded dark:bg-gray-700">
              {error.details}
            </pre>
          </details>
        )}
        {error.retryable && onRetry && (
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400"
              onClick={onRetry}
            >
              Retry
            </button>
            <button
              type="button"
              className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600 dark:hover:bg-gray-600"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </WeatherModal>
  );
}

export interface WeatherLoadingModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  progress?: number; // 0-100
}

export function WeatherLoadingModal({
  isOpen,
  title,
  message,
  progress,
}: WeatherLoadingModalProps) {
  return (
    <WeatherModal
      isOpen={isOpen}
      onClose={() => {}} // Prevent closing during loading
      title={title}
      type="info"
      showCloseButton={false}
      closeOnOverlayClick={false}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          {message}
        </p>
        {progress !== undefined && (
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 dark:bg-blue-400"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            ></div>
          </div>
        )}
      </div>
    </WeatherModal>
  );
}

export interface AirportNotFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  airportCode: string;
  onRetry?: () => void;
}

export function AirportNotFoundModal({
  isOpen,
  onClose,
  airportCode,
  onRetry,
}: AirportNotFoundModalProps) {
  return (
    <WeatherModal
      isOpen={isOpen}
      onClose={onClose}
      title="Airport Not Found"
      type="warning"
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The airport code <strong>{airportCode}</strong> was not found in the aviation weather database.
        </p>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium mb-2">Possible reasons:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Airport code may be incorrect</li>
            <li>Airport may not report weather data</li>
            <li>Airport may be temporarily unavailable</li>
            <li>Airport may use a different ICAO code</li>
          </ul>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-500">
          <p className="font-medium mb-1">Suggestions:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Verify the airport code spelling</li>
            <li>Check if the airport uses IATA codes instead</li>
            <li>Try nearby airports that report weather</li>
            <li>Enter weather data manually</li>
          </ul>
        </div>
        {onRetry && (
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              className="inline-flex justify-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-400"
              onClick={onRetry}
            >
              Try Again
            </button>
            <button
              type="button"
              className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600 dark:hover:bg-gray-600"
              onClick={onClose}
            >
              Continue Manually
            </button>
          </div>
        )}
      </div>
    </WeatherModal>
  );
}
