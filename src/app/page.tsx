"use client";

import { Suspense } from "react";
import WorksheetForm from "@/components/WorksheetForm";

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WorksheetForm />
    </Suspense>
  );
}
