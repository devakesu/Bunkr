import { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import dynamic from "next/dynamic";

const TrackingClient = dynamic(() => import("./TrackingClient"), {
  ssr: false,
});

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