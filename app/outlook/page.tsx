import type { Metadata } from "next";
import { Suspense } from "react";
import OutlookSync from "@/components/OutlookSync";
import { getOutlookStatus } from "@/lib/outlook";

export const metadata: Metadata = {
  title: "Outlook · AtmosOne CRM",
  description: "Sync Outlook mail, past meetings, and contacts",
};

export default async function OutlookPage() {
  const initialStatus = await getOutlookStatus();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-3xl">
        <Suspense fallback={<p className="text-gray-500 dark:text-gray-400">Loading Outlook…</p>}>
          <OutlookSync initialStatus={initialStatus} />
        </Suspense>
      </div>
    </div>
  );
}
