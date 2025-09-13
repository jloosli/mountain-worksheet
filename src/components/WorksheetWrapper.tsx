"use client";

import { Suspense } from "react";
import AppContainer from "./AppContainer";

export default function WorksheetWrapper() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <AppContainer />
    </Suspense>
  );
}
