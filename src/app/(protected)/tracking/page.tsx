import { Suspense, lazy } from "react";
import { Metadata } from "next";
import { LoadingSkeleton } from "@/components/loading-skeleton";

const TrackingClient = lazy(() => import("./TrackingClient"));

export const metadata: Metadata = {
  title: "Tracking",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TrackingPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <TrackingClient />
    </Suspense>
  );
}