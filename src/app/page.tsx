"use client";

import { Suspense } from "react";
import WorksheetForm from "@/components/WorksheetForm";

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-2 md:p-8 pb-20 gap-16">
        <WorksheetForm />
      </div>
    </Suspense>
  );
}
