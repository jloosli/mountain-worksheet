"use client";

import { Fragment, type ReactNode } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function SlideOver({
  isOpen,
  onClose,
  title,
  children,
}: SlideOverProps) {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        onClose={onClose}
        // `static` keeps the panel mounted even when closed so a print
        // stylesheet can re-position it as a static appendix. Transition's
        // `show` controls visibility (transform + opacity).
        static
        className="relative z-40 print:static"
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-slate-900/40 print:hidden"
          />
        </Transition.Child>

        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
        >
          <Dialog.Panel
            className="
              fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col
              border-l border-slate-200 bg-white shadow-2xl
              dark:border-slate-700 dark:bg-slate-900
              print:static print:max-w-none print:w-full print:border-l-0
              print:shadow-none print:break-before-page
            "
          >
            <header
              className="
                flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4
                dark:border-slate-700 dark:bg-slate-800
                print:hidden
              "
            >
              <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </Dialog.Title>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300 print:overflow-visible print:p-0">
              {children}
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}
