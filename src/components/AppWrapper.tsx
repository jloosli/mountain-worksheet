"use client";

import { Suspense } from "react";
import AppContainer from "./AppContainer";

export default function AppWrapper() {
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
