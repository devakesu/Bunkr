import { Metadata } from "next";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import dynamic from "next/dynamic";

const NotificationsClient = dynamic(() => import("./NotificationsClient"), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "Notifications",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotificationsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <NotificationsClient />
    </Suspense>
  );
}