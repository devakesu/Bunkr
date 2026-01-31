import { Metadata } from "next";
import { lazy, Suspense } from "react";
import { Loading } from "@/components/loading";

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
    <Suspense fallback={<Loading />}>
      <TrackingClient />
    </Suspense>
  );
}