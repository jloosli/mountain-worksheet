import WorksheetWrapper from "@/components/WorksheetWrapper";

export default function Home() {
  return (
    <div className="siteWrapper font-sans flex flex-col min-h-screen p-2 md:p-8 pb-20 gap-16 max-w-5xl mx-auto">
      <WorksheetWrapper />
    </div>
  );
}
